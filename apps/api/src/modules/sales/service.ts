import mongoose, { ClientSession, Types } from 'mongoose';
import { Batch } from '../batches/model';
import { Medicine } from '../medicines/model';
import { Sale, ISale } from './model';
import { StockMovement } from '../stock/movementModel';
import { Customer } from '../customers/model';
import { CustomerLedger } from '../customers/ledgerModel';
import { nextInvoiceNo } from './counterModel';
import { AppError } from '../../common/errors';
import { mulDiv, pct, roundToHundred } from '@hs-pharma/shared';
import { todayUtc } from '../../common/dates';
import type { CreateSaleSchema } from '@hs-pharma/shared';
import { z } from 'zod';
import type { IUser } from '../users/model';

type CreateSaleInput = z.infer<typeof import('@hs-pharma/shared').CreateSaleSchema>;

export interface AuthUser {
  _id: Types.ObjectId;
  name: string;
  role: 'owner' | 'manager' | 'cashier';
}

// ─── FEFO Allocation ─────────────────────────────────────────────────────────

interface Allocation {
  batchId: Types.ObjectId;
  qty: number;
  packPrice: number;
  costPrice: number;
  packSize: number;
  batchNo: string;
  expiryDate: Date;
}

async function allocateFefo(
  medicineId: Types.ObjectId,
  qtyBase: number,
  session: ClientSession,
  specificBatchId?: Types.ObjectId
): Promise<Allocation[]> {
  const today = todayUtc();

  let batches;
  if (specificBatchId) {
    // Cashier override: use a specific batch
    batches = await Batch.find({
      _id: specificBatchId,
      medicineId,
      status: 'active',
      qtyOnHand: { $gt: 0 },
    }).session(session);
    if (!batches.length)
      throw new AppError('BATCH_NOT_AVAILABLE', 400, 'Specified batch is not available');
  } else {
    // FEFO: earliest expiry first, skip expired and depleted
    batches = await Batch.find({
      medicineId,
      status: 'active',
      qtyOnHand: { $gt: 0 },
      expiryDate: { $gte: new Date(today) },
    })
      .sort({ expiryDate: 1, createdAt: 1 })
      .session(session);
  }

  const medicine = await Medicine.findById(medicineId).session(session);
  if (!medicine) throw new AppError('MEDICINE_NOT_FOUND', 404, 'Medicine not found');

  const out: Allocation[] = [];
  let remaining = qtyBase;

  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.qtyOnHand, remaining);
    out.push({
      batchId: b._id as Types.ObjectId,
      qty: take,
      packPrice: b.salePricePerPack,
      costPrice: b.purchasePricePerPack,
      packSize: medicine.packSize,
      batchNo: b.batchNo,
      expiryDate: b.expiryDate,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new AppError(
      'INSUFFICIENT_STOCK',
      409,
      `${medicine.name}: only ${qtyBase - remaining} units available (non-expired)`
    );
  }

  return out;
}

// ─── Compute Totals ──────────────────────────────────────────────────────────

interface SaleLine {
  medicineId: Types.ObjectId;
  batchId: Types.ObjectId;
  nameSnapshot: string;
  batchNoSnapshot: string;
  expirySnapshot: string;
  qty: number;
  unitLabel: string;
  packPrice: number;
  lineTotal: number;
  costSnapshot: number;
}

interface Totals {
  subtotal: number;
  discountBP: number;
  discount: number;
  roundOff: number;
  total: number;
  cashPaid: number;
  cardPaid: number;
  creditAmount: number;
  paidAmount: number;
}

function computeTotals(
  lines: SaleLine[],
  discountBP: number,
  mode: string,
  cashPaid: number,
  cardPaid: number
): Totals {
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const discount = pct(subtotal, discountBP);
  const raw = subtotal - discount;
  const total = roundToHundred(raw);
  const roundOff = total - raw;

  let cash = 0, card = 0;
  if (mode === 'cash') { cash = total; }
  else if (mode === 'card') { card = total; }
  else if (mode === 'credit') { /* all goes to udhaar */ }
  else if (mode === 'split') {
    card = Math.min(cardPaid, total);
    cash = Math.min(cashPaid, total - card);
  }

  const paidAmount = cash + card;
  const creditAmount = total - paidAmount;

  return { subtotal, discountBP, discount, roundOff, total, cashPaid: cash, cardPaid: card, creditAmount, paidAmount };
}

// ─── Build Sale Lines ────────────────────────────────────────────────────────

async function buildSaleLines(
  items: Array<{ medicineId: string; quantity: number; batchId?: string }>,
  session: ClientSession
): Promise<SaleLine[]> {
  const lines: SaleLine[] = [];

  for (const item of items) {
    const medId = new Types.ObjectId(item.medicineId);
    const batId = item.batchId ? new Types.ObjectId(item.batchId) : undefined;
    const allocs = await allocateFefo(medId, item.quantity, session, batId);

    const med = await Medicine.findById(medId).session(session);
    if (!med) throw new AppError('MEDICINE_NOT_FOUND', 404, `Medicine ${item.medicineId} not found`);

    for (const alloc of allocs) {
      const lineTotal = mulDiv(alloc.qty, alloc.packPrice, alloc.packSize);
      const costTotal = mulDiv(alloc.qty, alloc.costPrice, alloc.packSize);
      // Build human-readable unit label e.g. "2 strips + 3 tabs"
      const packs = Math.floor(alloc.qty / med.packSize);
      const loose = alloc.qty % med.packSize;
      let unitLabel = '';
      if (packs) unitLabel += `${packs} ${med.packUnit}${packs > 1 ? 's' : ''}`;
      if (packs && loose) unitLabel += ' + ';
      if (loose) unitLabel += `${loose} ${med.looseUnit}${loose > 1 ? 's' : ''}`;

      lines.push({
        medicineId: medId,
        batchId: alloc.batchId,
        nameSnapshot: `${med.name}${med.strength ? ' ' + med.strength : ''}`,
        batchNoSnapshot: alloc.batchNo,
        expirySnapshot: alloc.expiryDate.toISOString().slice(0, 10),
        qty: alloc.qty,
        unitLabel,
        packPrice: alloc.packPrice,
        lineTotal,
        costSnapshot: alloc.costPrice,
      });
    }
  }

  return lines;
}

// ─── Get Discount Limit for Role ────────────────────────────────────────────

async function getDiscountLimit(role: string): Promise<number> {
  const Settings = (await import('../settings/model')).Settings;
  const settings = await Settings.findOne();
  if (!settings) return 0;
  if (role === 'owner') return 10000; // unlimited
  if (role === 'manager') return settings.managerMaxDiscountBP;
  return settings.cashierMaxDiscountBP;
}

// ─── Create Sale Transaction ─────────────────────────────────────────────────

export async function createSale(
  input: CreateSaleInput,
  user: AuthUser
): Promise<ISale> {
  // Validate discount against role limit
  const limit = await getDiscountLimit(user.role);
  if ((input.discountBP ?? 0) > limit) {
    throw new AppError(
      'DISCOUNT_LIMIT',
      403,
      `Discount of ${(input.discountBP ?? 0) / 100}% exceeds your limit of ${limit / 100}%`
    );
  }

  const sale = await mongoose.connection.transaction(async (session) => {
    // 1. Idempotency — same clientRequestId returns the same bill
    const dup = await Sale.findOne({ clientRequestId: input.clientRequestId }).session(session);
    if (dup) return dup;

    // 2. Build lines with FEFO allocation
    const lines = await buildSaleLines(input.items, session);

    // 3. Conditional stock deduction — prevents overselling under concurrency
    for (const line of lines) {
      const r = await Batch.updateOne(
        { _id: line.batchId, qtyOnHand: { $gte: line.qty } },
        { $inc: { qtyOnHand: -line.qty } },
        { session }
      );
      if (r.modifiedCount !== 1) {
        throw new AppError('INSUFFICIENT_STOCK', 409, `Stock changed for batch — please retry`);
      }
    }

    // 4. Server-side totals — never trust client prices
    const totals = computeTotals(
      lines,
      input.discountBP ?? 0,
      input.paymentMode ?? 'cash',
      input.cashPaid ?? 0,
      input.cardPaid ?? 0
    );

    // 5. Controlled drug check
    const meds = await Medicine.find({ _id: { $in: lines.map(l => l.medicineId) } }).session(session);
    const hasControlled = meds.some(m => m.isControlled || m.prescriptionType === 'controlled_narcotic');
    if (hasControlled && !(input.prescription?.trim() || input.narcoticDetails)) {
      throw new AppError('PRESCRIPTION_REQUIRED', 400, 'Controlled drug: prescription/doctor details required (Form-9)');
    }

    // 6. Gap-free invoice number
    const invoiceNo = await nextInvoiceNo(session);

    // 7. Resolve customer
    let customer = null;
    let balBefore = 0;
    if (input.customerId) {
      customer = await Customer.findById(input.customerId).session(session);
      if (!customer) throw new AppError('CUSTOMER_NOT_FOUND', 404, 'Customer not found');
      balBefore = customer.balance;
    }

    // 8. Credit limit check
    if (totals.creditAmount > 0) {
      if (!customer) throw new AppError('UDHAAR_REQUIRES_CUSTOMER', 400, 'Udhaar requires a registered customer');
      if (customer.balance + totals.creditAmount > customer.creditLimit) {
        throw new AppError(
          'CREDIT_LIMIT_EXCEEDED',
          409,
          `Credit limit of Rs ${customer.creditLimit / 100} would be exceeded`
        );
      }
    }

    // 9. Create sale
    const today = todayUtc();
    const [created] = await Sale.create(
      [{
        invoiceNo,
        clientRequestId: input.clientRequestId,
        customerId: customer?._id,
        customerNameSnapshot: customer?.name ?? 'Walk-in',
        items: lines,
        ...totals,
        soldBy: user._id,
        soldByName: user.name,
        prescription: input.prescription ?? (input.narcoticDetails ? `Dr. ${input.narcoticDetails.doctorName} (PMDC: ${input.narcoticDetails.doctorRegNo})` : undefined),
        narcoticDetails: input.narcoticDetails,
        customerBalanceBefore: balBefore,
        customerBalanceAfter: customer ? balBefore + totals.creditAmount : undefined,
      }],
      { session }
    );

    // 10. Stock movements
    await StockMovement.insertMany(
      lines.map(l => ({
        batchId: l.batchId,
        medicineId: l.medicineId,
        type: 'SALE',
        qty: -l.qty,
        unitCost: Math.round(l.costSnapshot / (meds.find(m => m._id.equals(l.medicineId))?.packSize ?? 1)),
        refType: 'Sale',
        refId: invoiceNo,
        userId: user._id,
      })),
      { session }
    );

    // 11. Udhaar ledger
    if (totals.creditAmount > 0 && customer) {
      await CustomerLedger.create(
        [{
          customerId: customer._id,
          type: 'CREDIT_SALE',
          amount: totals.creditAmount,
          refType: 'Sale',
          refId: invoiceNo,
          userId: user._id,
          date: today,
        }],
        { session }
      );
      await Customer.updateOne(
        { _id: customer._id },
        { $inc: { balance: totals.creditAmount } },
        { session }
      );
    }

    return created;
  });

  return sale;
}

// ─── Void Sale ───────────────────────────────────────────────────────────────

export async function voidSale(
  saleId: string,
  reason: string,
  user: AuthUser
): Promise<ISale> {
  const today = todayUtc();

  return mongoose.connection.transaction(async (session) => {
    const sale = await Sale.findById(saleId).session(session);
    if (!sale) throw new AppError('SALE_NOT_FOUND', 404, 'Sale not found');
    if (sale.status === 'void') throw new AppError('ALREADY_VOID', 400, 'Sale is already voided');

    // Restock all batches
    for (const item of sale.items) {
      await Batch.updateOne(
        { _id: item.batchId },
        { $inc: { qtyOnHand: item.qty } },
        { session }
      );
      await StockMovement.create(
        [{
          batchId: item.batchId,
          medicineId: item.medicineId,
          type: 'VOID',
          qty: item.qty,
          refType: 'Sale',
          refId: sale.invoiceNo,
          userId: user._id,
          note: reason,
        }],
        { session }
      );
    }

    // Reverse udhaar if any
    if (sale.creditAmount > 0 && sale.customerId) {
      await CustomerLedger.create(
        [{
          customerId: sale.customerId,
          type: 'RETURN_ADJUST',
          amount: -sale.creditAmount,
          refType: 'Sale',
          refId: sale.invoiceNo,
          userId: user._id,
          note: `Void: ${reason}`,
          date: today,
        }],
        { session }
      );
      await Customer.updateOne(
        { _id: sale.customerId },
        { $inc: { balance: -sale.creditAmount } },
        { session }
      );
    }

    sale.status = 'void';
    sale.voidReason = reason;
    await sale.save({ session });

    return sale;
  });
}

// ─── Get Sales List ──────────────────────────────────────────────────────────

export async function getSales(filters: {
  page?: number;
  limit?: number;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const query: Record<string, any> = {};
  if (filters.customerId) query.customerId = new Types.ObjectId(filters.customerId);
  if (filters.status) query.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setDate(to.getDate() + 1);
      query.createdAt.$lt = to;
    }
  }

  const [sales, total] = await Promise.all([
    Sale.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Sale.countDocuments(query),
  ]);

  return { sales, total, page, pages: Math.ceil(total / limit) };
}

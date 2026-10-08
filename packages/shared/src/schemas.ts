import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const PinUnlockSchema = z.object({
  pin: z.string().min(4).max(8),
});

// ─── Users ───────────────────────────────────────────────────────────────────

export const UserRole = z.enum(['owner', 'manager', 'cashier']);
export type UserRole = z.infer<typeof UserRole>;

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(3).max(50).regex(/^[a-z0-9_]+$/),
  password: z.string().min(6),
  role: UserRole,
  pin: z.string().length(4).regex(/^\d+$/).optional(),
});

// ─── Medicines ───────────────────────────────────────────────────────────────

export const LooseUnit = z.enum(['tab', 'cap', 'ml', 'pc', 'sachet', 'amp', 'vial']);
export const PackUnit = z.enum(['strip', 'bottle', 'tube', 'pack', 'box', 'vial']);

export const MedicineCategory = z.enum([
  'Antibiotics & Anti-infectives',
  'Cardiovascular & Antihypertensives',
  'Analgesics & Pain Relief (NSAIDs)',
  'Gastrointestinal & Antacids',
  'Antidiabetic & Endocrinology',
  'Respiratory & Anti-allergic',
  'Dermatology & Topicals',
  'Neurology & Psychiatric',
  'Vitamins, Minerals & Supplements',
  'Ophthalmic & Otic (Eye/Ear)',
  'Women Health & Hormones',
  'Medical Devices & Surgical',
  'General & Other',
]);
export type MedicineCategory = z.infer<typeof MedicineCategory>;

export const StorageCondition = z.enum([
  'room_temperature',   // 15°C – 25°C
  'cold_chain_2_8',     // 2°C – 8°C Refrigerator (Insulin, Vaccines, Eye Drops)
  'cool_below_20',      // Cool dry place below 20°C
  'protect_from_light', // Amber glass / foil protected
]);
export type StorageCondition = z.infer<typeof StorageCondition>;

export const PrescriptionType = z.enum([
  'otc',                // Over The Counter
  'rx_general',         // Prescription Required
  'controlled_narcotic',// Schedule B / D Narcotic / Benzodiazepines
]);
export type PrescriptionType = z.infer<typeof PrescriptionType>;

export const OpeningStockSchema = z.object({
  batchNo: z.string().min(1).toUpperCase(),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Must be MM/YY'),
  packs: z.number().int().min(1),
  purchasePricePerPack: z.number().int().min(0), // paisa
  salePricePerPack: z.number().int().min(0),     // paisa
  mrpPerPack: z.number().int().min(0).optional(),
});
export type OpeningStockSchema = z.infer<typeof OpeningStockSchema>;

export const CreateMedicineSchema = z.object({
  name: z.string().min(1).max(200),
  genericName: z.string().min(1).max(200),
  strength: z.string().max(100).optional(),
  form: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  category: MedicineCategory.default('General & Other'),
  storageCondition: StorageCondition.default('room_temperature'),
  prescriptionType: PrescriptionType.default('otc'),
  packSize: z.number().int().min(1),        // units per pack
  packsPerBox: z.number().int().min(1).default(1),
  looseUnit: LooseUnit.default('tab'),
  packUnit: PackUnit.default('strip'),
  minStock: z.number().int().min(0).default(0), // in base units
  rack: z.string().max(50).optional(),
  barcodes: z.array(z.string()).default([]),
  isControlled: z.boolean().default(false),
  gstRateBP: z.number().int().min(0).max(3000).default(0), // basis points (0% to 30%)
  // Pricing (owner only) — stored in paisa
  purchasePricePerPack: z.number().int().min(0).optional(),
  salePricePerPack: z.number().int().min(0).optional(),
  mrpPerPack: z.number().int().min(0).optional(),
  openingStock: OpeningStockSchema.optional(),
});

// ─── Suppliers ───────────────────────────────────────────────────────────────

export const CreateSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  contactPerson: z.string().max(200).optional(),
});

// ─── Purchase ────────────────────────────────────────────────────────────────

export const PurchaseLineSchema = z.object({
  medicineId: z.string(),
  batchNo: z.string().min(1).toUpperCase(),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Must be MM/YY'),
  packs: z.number().int().min(1),
  bonusPacks: z.number().int().min(0).default(0),
  purchasePricePerPack: z.number().int().min(0),  // paisa
  salePricePerPack: z.number().int().min(0),       // paisa
  mrpPerPack: z.number().int().min(0).optional(),
});

export const CreatePurchaseSchema = z.object({
  supplierId: z.string(),
  supplierInvoiceNo: z.string().min(1),
  invoiceDate: z.string().optional(),
  lines: z.array(PurchaseLineSchema).min(1),
});

// ─── Sales ───────────────────────────────────────────────────────────────────

export const SaleItemSchema = z.object({
  medicineId: z.string(),
  quantity: z.number().int().min(1), // base units
  batchId: z.string().optional(),    // cashier override; FEFO used if omitted
});

export const PaymentMode = z.enum(['cash', 'card', 'credit', 'split']);
export type PaymentMode = z.infer<typeof PaymentMode>;

export const CreateSaleSchema = z.object({
  clientRequestId: z.string().uuid(),
  customerId: z.string().optional(),
  items: z.array(SaleItemSchema).min(1),
  discountBP: z.number().int().min(0).max(10000).default(0), // basis points
  paymentMode: PaymentMode.default('cash'),
  cashPaid: z.number().int().min(0).default(0),   // paisa
  cardPaid: z.number().int().min(0).default(0),   // paisa
  prescription: z.string().optional(),
});

// ─── Customers ───────────────────────────────────────────────────────────────

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  creditLimit: z.number().int().min(0).default(0), // paisa
});

// ─── Returns ─────────────────────────────────────────────────────────────────

export const SaleReturnSchema = z.object({
  saleId: z.string(),
  items: z.array(z.object({
    saleItemIndex: z.number().int().min(0),
    quantity: z.number().int().min(1),
    restock: z.boolean().default(true),
  })),
  refundMethod: z.enum(['cash', 'udhaar_reduction']).default('cash'),
  reason: z.string().min(1),
});

// ─── Stock ───────────────────────────────────────────────────────────────────

export const StockAdjustSchema = z.object({
  batchId: z.string(),
  countedQty: z.number().int().min(0),
  reason: z.string().min(1),
});

export const WriteOffSchema = z.object({
  batchId: z.string(),
  reason: z.string().min(1).default('Expiry write-off'),
});

// ─── Customer Payment ────────────────────────────────────────────────────────

export const CustomerPaymentSchema = z.object({
  amount: z.number().int().min(1), // paisa
  method: z.enum(['cash', 'card', 'transfer']).default('cash'),
  note: z.string().optional(),
});

// ─── Expenses ────────────────────────────────────────────────────────────────

export const ExpenseCategory = z.enum([
  'Rent',
  'Salaries',
  'Electricity & utilities',
  'Transport',
  'Maintenance',
  'Licences & taxes',
  'Marketing',
  'Other',
]);

export const CreateExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: ExpenseCategory,
  amount: z.number().int().min(1),
  note: z.string().optional(),
});

// ─── Settings ────────────────────────────────────────────────────────────────

export const UpdateSettingsSchema = z.object({
  shopName: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  billFooter: z.string().optional(),
  nearExpiryDays: z.number().int().min(1).max(365).optional(),
  criticalDays: z.number().int().min(1).max(90).optional(),
  cashierMaxDiscountBP: z.number().int().min(0).max(10000).optional(),
  managerMaxDiscountBP: z.number().int().min(0).max(10000).optional(),
  managerPin: z.string().length(4).regex(/^\d+$/).optional(),
});

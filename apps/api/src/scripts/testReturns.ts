import 'dotenv/config';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connectDB, disconnectDB } from '../config/db';
import { app } from '../app';
import { User } from '../modules/users/model';
import { Medicine } from '../modules/medicines/model';
import { Batch } from '../modules/batches/model';
import { Supplier } from '../modules/suppliers/model';
import { Customer } from '../modules/customers/model';
import { Sale } from '../modules/sales/model';
import { SaleReturn } from '../modules/sales/returnModel';
import { SupplierReturn } from '../modules/purchases/returnModel';
import { StockMovement } from '../modules/stock/movementModel';
import { env } from '../config/env';

async function run() {
  await connectDB();
  console.log('🔗 Connected to MongoDB');

  // Find or create owner user
  let owner = await User.findOne({ role: 'owner' });
  if (!owner) {
    owner = await User.create({
      name: 'Owner Return Test',
      username: 'owner_ret_' + Date.now(),
      passwordHash: 'dummy',
      role: 'owner',
      isActive: true,
    });
  }

  const token = jwt.sign(
    {
      sub: owner._id.toString(),
      _id: owner._id.toString(),
      name: owner.name,
      username: owner.username,
      role: owner.role,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
  const authHeader = `Bearer ${token}`;

  const suffix = Date.now().toString().slice(-4);

  // 1. Setup Test Data: Medicine + Batch + Supplier + Customer
  const supplier = await Supplier.create({
    name: `Test Distributor ${suffix}`,
    balance: 500000, // Rs 5,000 payable balance
  });

  const medicine = await Medicine.create({
    name: `Panadol Ret-${suffix}`,
    genericName: 'Paracetamol',
    strength: '500mg',
    packSize: 10,
    looseUnit: 'tab',
    packUnit: 'strip',
    minStock: 20,
    searchTokens: ['panadol', 'ret'],
  });

  const batch = await Batch.create({
    medicineId: medicine._id,
    batchNo: `BAT-${suffix}`,
    expiryDate: new Date('2028-12-31'),
    purchasePricePerPack: 4000, // Rs 40.00
    salePricePerPack: 5000,     // Rs 50.00
    mrpPerPack: 5000,
    qtyOnHand: 100, // 10 strips of 10 tabs = 100 tabs
    supplierId: supplier._id,
    status: 'active',
  });

  const customer = await Customer.create({
    name: `Ali Customer ${suffix}`,
    balance: 20000, // Rs 200.00 udhaar owed
    creditLimit: 50000,
  });

  // Create an original Sale
  const sale = await Sale.create({
    invoiceNo: `INV-TEST-${suffix}`,
    clientRequestId: `req-${suffix}-${Date.now()}`,
    customerId: customer._id,
    customerNameSnapshot: customer.name,
    items: [
      {
        medicineId: medicine._id,
        batchId: batch._id,
        nameSnapshot: medicine.name,
        batchNoSnapshot: batch.batchNo,
        expirySnapshot: '2028-12-31',
        qty: 30, // 3 strips = 30 tabs sold
        unitLabel: '3 strips',
        packPrice: 5000,
        lineTotal: 15000, // Rs 150.00
        costSnapshot: 4000,
        returnedQty: 0,
      },
    ],
    subtotal: 15000,
    discountBP: 0,
    discount: 0,
    roundOff: 0,
    total: 15000,
    cashPaid: 10000,
    cardPaid: 0,
    creditAmount: 5000,
    paidAmount: 10000,
    soldBy: owner._id,
    soldByName: owner.name,
    status: 'ok',
  });

  console.log(`\n📦 Setup: Sale ${sale.invoiceNo} created for ${customer.name}. Batch stock before returns: ${batch.qtyOnHand} tabs`);

  // ─── TEST 1: Customer Return (Restock to Shelf) ───────────────────────────
  console.log('\n--- Test 1: Customer Return with Restock ---');
  const retRes = await request(app)
    .post('/api/v1/returns/customer')
    .set('Authorization', authHeader)
    .send({
      saleId: sale._id.toString(),
      items: [
        {
          saleItemIndex: 0,
          quantity: 10, // return 10 tabs (1 strip)
          restock: true,
        },
      ],
      refundMethod: 'cash',
      reason: 'Patient doctor changed prescription',
    });

  console.log('Customer Return Status:', retRes.status);
  if (retRes.status !== 201) {
    console.error('Error response:', retRes.body);
    throw new Error('Failed to create customer return');
  }

  const retData = retRes.body.data;
  console.log('✅ Customer Return Created:', retData.returnNo);
  console.log('   Total Refund:', retData.totalRefund, 'paisa (expected: 5000 paisa)');
  if (retData.totalRefund !== 5000) throw new Error('Incorrect refund calculation');

  // Verify Batch stock was topped up
  const updatedBatch = await Batch.findById(batch._id);
  console.log(`✅ Batch stock after restock: ${updatedBatch?.qtyOnHand} tabs (was 100, now 110)`);
  if (updatedBatch?.qtyOnHand !== 110) throw new Error('Batch stock not restocked');

  // Verify StockMovement logged
  const retMovement = await StockMovement.findOne({ batchId: batch._id, type: 'RETURN' });
  if (!retMovement) throw new Error('StockMovement RETURN was not recorded');
  console.log('✅ StockMovement Verified: type =', retMovement.type, 'qty =', retMovement.qty);

  // Test Customer Return Print
  const printRetRes = await request(app)
    .get(`/api/v1/returns/customer/${retData._id}/print`)
    .set('Authorization', authHeader);
  console.log('✅ Return Print Slip HTML status:', printRetRes.status);
  if (printRetRes.status !== 200 || !printRetRes.text.includes(retData.returnNo)) {
    throw new Error('Print slip HTML verification failed');
  }

  // ─── TEST 2: Customer Return (Udhaar Reduction) ───────────────────────────
  console.log('\n--- Test 2: Customer Return with Udhaar Balance Reduction ---');
  const retUdhaarRes = await request(app)
    .post('/api/v1/returns/customer')
    .set('Authorization', authHeader)
    .send({
      saleId: sale._id.toString(),
      items: [
        {
          saleItemIndex: 0,
          quantity: 10, // return another 10 tabs
          restock: false, // damaged foil
        },
      ],
      refundMethod: 'udhaar_reduction',
      reason: 'Damaged strip foil returned',
    });

  console.log('Udhaar Return Status:', retUdhaarRes.status);
  if (retUdhaarRes.status !== 201) throw new Error('Failed udhaar return');

  // Verify Customer balance decreased by Rs 50.00 (5000 paisa)
  const updatedCustomer = await Customer.findById(customer._id);
  console.log(`✅ Customer balance before: 20000, after: ${updatedCustomer?.balance} (expected: 15000)`);
  if (updatedCustomer?.balance !== 15000) throw new Error('Customer udhaar balance was not reduced');

  // ─── TEST 3: Supplier Return & Debit Note ─────────────────────────────────
  console.log('\n--- Test 3: Supplier Return & Debit Note ---');
  const supplierRetRes = await request(app)
    .post('/api/v1/returns/supplier')
    .set('Authorization', authHeader)
    .send({
      supplierId: supplier._id.toString(),
      items: [
        {
          batchId: batch._id.toString(),
          medicineId: medicine._id.toString(),
          packs: 5, // 5 packs = 50 tabs
          unitCreditPricePerPack: 4000, // Rs 40.00
          reason: 'near_expiry',
        },
      ],
      note: 'Returned near expiry batches per distributor policy',
    });

  console.log('Supplier Return Status:', supplierRetRes.status);
  if (supplierRetRes.status !== 201) {
    console.error('Error response:', supplierRetRes.body);
    throw new Error('Failed to create supplier return');
  }

  const debitNoteData = supplierRetRes.body.data;
  console.log('✅ Debit Note Created:', debitNoteData.debitNoteNo);
  console.log('   Total Credit Amount:', debitNoteData.totalCreditAmount, 'paisa (expected: 20000 paisa)');
  if (debitNoteData.totalCreditAmount !== 20000) throw new Error('Incorrect debit note total');

  // Verify Batch stock was deducted by 50 tabs
  const batchAfterDebit = await Batch.findById(batch._id);
  console.log(`✅ Batch stock after supplier return: ${batchAfterDebit?.qtyOnHand} tabs (was 110, now 60)`);
  if (batchAfterDebit?.qtyOnHand !== 60) throw new Error('Batch stock not deducted for supplier return');

  // Verify Supplier balance was reduced
  const updatedSupplier = await Supplier.findById(supplier._id);
  console.log(`✅ Supplier balance before: 500000, after: ${updatedSupplier?.balance} (expected: 480000)`);
  if (updatedSupplier?.balance !== 480000) throw new Error('Supplier balance not reduced');

  // Verify StockMovement PURCHASE_RETURN
  const debitMovement = await StockMovement.findOne({ batchId: batch._id, type: 'PURCHASE_RETURN' });
  if (!debitMovement) throw new Error('StockMovement PURCHASE_RETURN was not recorded');
  console.log('✅ StockMovement Verified: type =', debitMovement.type, 'qty =', debitMovement.qty);

  // Test Debit Note Print
  const printDebitRes = await request(app)
    .get(`/api/v1/returns/supplier/${debitNoteData._id}/print`)
    .set('Authorization', authHeader);
  console.log('✅ Debit Note Print HTML status:', printDebitRes.status);
  if (printDebitRes.status !== 200 || !printDebitRes.text.includes(debitNoteData.debitNoteNo)) {
    throw new Error('Debit note print HTML verification failed');
  }

  // Cleanup test data
  await SaleReturn.deleteMany({ saleId: sale._id });
  await SupplierReturn.deleteOne({ _id: debitNoteData._id });
  await Sale.deleteOne({ _id: sale._id });
  await Customer.deleteOne({ _id: customer._id });
  await Batch.deleteOne({ _id: batch._id });
  await Medicine.deleteOne({ _id: medicine._id });
  await Supplier.deleteOne({ _id: supplier._id });
  await StockMovement.deleteMany({ batchId: batch._id });
  console.log('\n🧹 Test records cleaned up successfully.');

  await disconnectDB();
  console.log('🎉 ALL RETURNS & DEBIT NOTE INTEGRATION TESTS PASSED 100%!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

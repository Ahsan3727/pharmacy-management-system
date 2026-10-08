import 'dotenv/config';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connectDB, disconnectDB } from '../config/db';
import { app } from '../app';
import { User } from '../modules/users/model';
import { Medicine } from '../modules/medicines/model';
import { Batch } from '../modules/batches/model';
import { StockMovement } from '../modules/stock/movementModel';
import { StockAudit } from '../modules/stock/auditModel';
import { env } from '../config/env';

async function run() {
  await connectDB();
  console.log('🔗 Connected to MongoDB');

  let owner = await User.findOne({ role: 'owner' });
  if (!owner) {
    owner = await User.create({
      name: 'Owner Audit Test',
      username: 'owner_aud_' + Date.now(),
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
  const testRack = `RACK-TEST-${suffix}`;

  // 1. Setup Medicine & 2 Batches on specific Rack
  console.log(`\n--- 1. Setting Up Inventory on Shelf ${testRack} ---`);
  const medicine = await Medicine.create({
    name: `Augmentin Aud-${suffix}`,
    genericName: 'Co-Amoxiclav',
    strength: '625mg',
    packSize: 10,
    looseUnit: 'tab',
    packUnit: 'strip',
    rack: testRack,
    category: 'Antibiotics & Anti-infectives',
    storageCondition: 'cool_below_20',
  });

  const future = new Date();
  future.setFullYear(future.getFullYear() + 1);

  const batch1 = await Batch.create({
    medicineId: medicine._id,
    batchNo: `B1-${suffix}`,
    expiryDate: future,
    purchasePricePerPack: 50000, // Rs 500
    salePricePerPack: 65000,     // Rs 650
    qtyOnHand: 20,               // System qty: 20 tabs
  });

  const batch2 = await Batch.create({
    medicineId: medicine._id,
    batchNo: `B2-${suffix}`,
    expiryDate: future,
    purchasePricePerPack: 50000,
    salePricePerPack: 65000,
    qtyOnHand: 15,               // System qty: 15 tabs
  });

  console.log(`✅ Created ${medicine.name}: Batch ${batch1.batchNo} (20 tabs), Batch ${batch2.batchNo} (15 tabs)`);

  // 2. Fetch Interactive Stocktaking Sheet for this Rack
  console.log(`\n--- 2. Fetching Count Sheet for ${testRack} ---`);
  const resSheet = await request(app)
    .get('/api/v1/stock/sheet')
    .set('Authorization', authHeader)
    .query({ rack: testRack });

  if (resSheet.status !== 200) {
    throw new Error(`Sheet fetch failed: ${resSheet.status}`);
  }

  const sheetItems = resSheet.body.data;
  console.log(`✅ Count sheet returned ${sheetItems.length} batches for ${testRack}`);
  if (sheetItems.length < 2) {
    throw new Error(`Expected at least 2 batches in count sheet, got ${sheetItems.length}`);
  }

  // 3. Commit Physical Cycle Count Reconciliation
  console.log('\n--- 3. Committing Physical Count Audit ---');
  // Batch 1: Counted 25 (Surplus +5 tabs)
  // Batch 2: Counted 12 (Shortage -3 tabs)
  const auditPayload = {
    rack: testRack,
    notes: 'Monthly antibiotic shelf audit test',
    items: [
      {
        medicineId: medicine._id.toString(),
        batchId: batch1._id.toString(),
        medicineName: medicine.name,
        batchNo: batch1.batchNo,
        systemQty: 20,
        countedQty: 25, // +5
        unitCost: 5000, // Rs 50 / tab
      },
      {
        medicineId: medicine._id.toString(),
        batchId: batch2._id.toString(),
        medicineName: medicine.name,
        batchNo: batch2.batchNo,
        systemQty: 15,
        countedQty: 12, // -3
        unitCost: 5000, // Rs 50 / tab
      },
    ],
  };

  const resAudit = await request(app)
    .post('/api/v1/stock/audits')
    .set('Authorization', authHeader)
    .send(auditPayload);

  if (resAudit.status !== 201) {
    throw new Error(`Audit creation failed with status ${resAudit.status}: ${JSON.stringify(resAudit.body)}`);
  }

  const audit = resAudit.body.data;
  console.log(`✅ Stock Audit Created! Audit No: ${audit.auditNo}`);
  console.log(`   Total Variance Qty: ${audit.totalVarianceQty} (expected +2)`);
  console.log(`   Total Variance Value: Rs ${(audit.totalVarianceValue / 100).toFixed(2)} (expected +Rs 100.00)`);

  if (audit.totalVarianceQty !== 2) {
    throw new Error(`Expected variance qty 2, got ${audit.totalVarianceQty}`);
  }

  // 4. Verify Database Records: Batch stock updated and StockMovements logged
  console.log('\n--- 4. Verifying Physical Batch Updates & Stock Ledger ---');
  const updatedB1 = await Batch.findById(batch1._id);
  const updatedB2 = await Batch.findById(batch2._id);

  if (updatedB1?.qtyOnHand !== 25) {
    throw new Error(`Expected Batch 1 qty 25, got ${updatedB1?.qtyOnHand}`);
  }
  if (updatedB2?.qtyOnHand !== 12) {
    throw new Error(`Expected Batch 2 qty 12, got ${updatedB2?.qtyOnHand}`);
  }
  console.log(`✅ Batch 1 qtyOnHand correctly updated: 20 → ${updatedB1.qtyOnHand}`);
  console.log(`✅ Batch 2 qtyOnHand correctly updated: 15 → ${updatedB2.qtyOnHand}`);

  const movements = await StockMovement.find({ refId: audit.auditNo });
  console.log(`✅ StockMovements logged: ${movements.length} adjustment records`);
  if (movements.length !== 2) {
    throw new Error(`Expected 2 movements, got ${movements.length}`);
  }

  // 5. Verify Printable Audit Report HTML
  console.log('\n--- 5. Testing Printable Audit Report HTML ---');
  const resPrint = await request(app)
    .get(`/api/v1/stock/audits/${audit._id}/print`)
    .set('Authorization', authHeader);

  if (resPrint.status !== 200 || !resPrint.text.includes(audit.auditNo) || !resPrint.text.includes(testRack)) {
    throw new Error(`Printable audit failed or missing info: ${resPrint.status}`);
  }
  console.log(`✅ Printable Audit Report HTML contains ${audit.auditNo} and shelf ${testRack}`);

  console.log('\n🎉 SPRINT 4: PHYSICAL CYCLE COUNT AUDITS 100% VERIFIED!');
  await disconnectDB();
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

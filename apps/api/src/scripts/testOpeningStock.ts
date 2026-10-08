import 'dotenv/config';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connectDB, disconnectDB } from '../config/db';
import { app } from '../app';
import { User } from '../modules/users/model';
import { Medicine } from '../modules/medicines/model';
import { Batch } from '../modules/batches/model';
import { StockMovement } from '../modules/stock/movementModel';
import { env } from '../config/env';

async function run() {
  await connectDB();
  console.log('🔗 Connected to MongoDB');

  // Find or create owner user
  let owner = await User.findOne({ role: 'owner' });
  if (!owner) {
    owner = await User.create({
      name: 'Owner Test',
      username: 'test_owner_stock_' + Date.now(),
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

  const testSuffix = Date.now().toString().slice(-4);

  // 1. Create a medicine with Opening Stock
  console.log('\n--- Test 1: POST /api/v1/medicines with Opening Stock ---');
  const resWithStock = await request(app)
    .post('/api/v1/medicines')
    .set('Authorization', authHeader)
    .send({
      name: `AmoxiClav-${testSuffix}`,
      genericName: 'Amoxicillin + Clavulanic Acid',
      strength: '625mg',
      form: 'Tablet',
      company: 'GSK Pharma',
      category: 'Antibiotics & Anti-infectives',
      storageCondition: 'cold_chain_2_8',
      prescriptionType: 'rx_general',
      packSize: 6,
      packsPerBox: 10,
      looseUnit: 'tab',
      packUnit: 'strip',
      minStock: 20,
      rack: 'Cold-01',
      barcodes: [`8901234${testSuffix}`],
      openingStock: {
        batchNo: `B${testSuffix}`,
        expiry: '10/28',
        packs: 15,
        purchasePricePerPack: 24000, // Rs 240.00
        salePricePerPack: 29000,     // Rs 290.00
        mrpPerPack: 29000,
      },
    });

  console.log('Status:', resWithStock.status);
  if (resWithStock.status !== 201) {
    console.error('Error creating medicine:', resWithStock.body);
    process.exit(1);
  }

  const createdMed = resWithStock.body.data;
  const createdBatch = resWithStock.body.openingBatch;
  console.log('✅ Medicine Created:', createdMed.name, 'ID:', createdMed._id);
  console.log('✅ Batch Created:', createdBatch.batchNo, 'Qty (base units):', createdBatch.qtyOnHand);
  console.log('   Expected base units: 15 packs * 6 packSize = 90 base units');
  if (createdBatch.qtyOnHand !== 90) throw new Error('Incorrect base units calculation');

  // Check StockMovement
  const movement = await StockMovement.findOne({ batchId: createdBatch._id, type: 'OPENING' });
  if (!movement) throw new Error('StockMovement OPENING was not recorded');
  console.log('✅ StockMovement Verified: type =', movement.type, 'qty =', movement.qty, 'refType =', movement.refType);

  // 2. Search for the medicine
  console.log('\n--- Test 2: GET /api/v1/medicines/search ---');
  const searchRes = await request(app)
    .get(`/api/v1/medicines/search?q=AmoxiClav-${testSuffix}`)
    .set('Authorization', authHeader);

  console.log('Search status:', searchRes.status);
  const found = searchRes.body.data?.[0];
  if (!found) throw new Error('Medicine not found in search');
  console.log('✅ Found in search:', found.name);
  console.log('   Total Stock:', found.totalStock, found.looseUnit + 's');
  console.log('   Storage Condition:', found.storageCondition);
  console.log('   Category:', found.category);
  console.log('   Sale Price:', found.salePrice);
  if (found.totalStock !== 90) throw new Error('Search did not reflect total stock');

  // 3. GET /api/v1/medicines list
  console.log('\n--- Test 3: GET /api/v1/medicines catalog list ---');
  const listRes = await request(app)
    .get('/api/v1/medicines?limit=10')
    .set('Authorization', authHeader);

  console.log('List status:', listRes.status, 'Total items:', listRes.body.data?.total);
  const matched = listRes.body.data?.items?.find((m: any) => m._id === createdMed._id);
  if (matched) {
    console.log('✅ Verified catalog item has totalStock attached:', matched.totalStock);
  }

  // Cleanup test data
  await Medicine.deleteOne({ _id: createdMed._id });
  await Batch.deleteOne({ _id: createdBatch._id });
  await StockMovement.deleteOne({ _id: movement._id });
  console.log('\n🧹 Test records cleaned up successfully.');

  await disconnectDB();
  console.log('🎉 ALL INTEGRATION TESTS PASSED 100%!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

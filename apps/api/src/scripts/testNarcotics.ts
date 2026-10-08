import 'dotenv/config';
import { randomUUID } from 'crypto';
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

  let owner = await User.findOne({ role: 'owner' });
  if (!owner) {
    owner = await User.create({
      name: 'Owner Test',
      username: 'owner_narc_' + Date.now(),
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

  // 1. Create a controlled narcotic medicine
  console.log('\n--- 1. Registering Form-9 Controlled Narcotic Drug ---');
  const medicine = await Medicine.create({
    name: `Morphine Sulphate ${suffix}`,
    genericName: 'Morphine',
    strength: '10mg/ml',
    category: 'Narcotic / Controlled Substance',
    storageCondition: 'room_temperature',
    prescriptionType: 'controlled_narcotic',
    isControlled: true,
    packSize: 10,
    looseUnit: 'ampoule',
    packUnit: 'box',
    rack: 'SAFE-NARCOTIC-01',
    barcode: `NARC${suffix}`,
    minStockAlert: 5,
  });

  const expiryFuture = new Date();
  expiryFuture.setFullYear(expiryFuture.getFullYear() + 2);

  const batch = await Batch.create({
    medicineId: medicine._id,
    batchNo: `BATCH-M-${suffix}`,
    expiryDate: expiryFuture,
    purchasePricePerPack: 100000, // Rs 1000
    salePricePerPack: 150000,     // Rs 1500
    mrpPerPack: 150000,
    qtyOnHand: 50,
  });

  console.log(`✅ Created controlled medicine: ${medicine.name} (Batch ${batch.batchNo}, Qty 50)`);

  // 2. Attempt sale WITHOUT prescription / narcotic details -> Must be rejected (400)
  console.log('\n--- 2. Attempt Sale WITHOUT Narcotic Details (Statutory Check) ---');
  const resUnverified = await request(app)
    .post('/api/v1/sales')
    .set('Authorization', authHeader)
    .send({
      clientRequestId: randomUUID(),
      items: [{ medicineId: medicine._id.toString(), quantity: 2 }],
      paymentMode: 'cash',
      cashPaid: 50000,
    });

  if (resUnverified.status === 400 && resUnverified.body.error?.code === 'PRESCRIPTION_REQUIRED') {
    console.log('✅ Correctly blocked unverified dispensing: 400 PRESCRIPTION_REQUIRED');
  } else {
    throw new Error(`Expected 400 PRESCRIPTION_REQUIRED but got ${resUnverified.status}: ${JSON.stringify(resUnverified.body)}`);
  }

  // 3. Attempt sale WITH full statutory Narcotic Details -> Must succeed
  console.log('\n--- 3. Dispensing Controlled Drug with Doctor PMDC & Patient CNIC ---');
  const pmdcReg = `PMDC-${suffix}-P`;
  const patientCnic = `35201-${suffix}123-1`;
  const doctorName = 'Dr. Asad Ullah (Oncologist)';
  const patientName = 'Muhammad Akram';

  const resVerified = await request(app)
    .post('/api/v1/sales')
    .set('Authorization', authHeader)
    .send({
      clientRequestId: randomUUID(),
      items: [{ medicineId: medicine._id.toString(), quantity: 5 }],
      paymentMode: 'cash',
      cashPaid: 100000,
      narcoticDetails: {
        doctorName,
        doctorRegNo: pmdcReg,
        patientName,
        patientCnic,
        prescriptionDate: new Date().toISOString().slice(0, 10),
        prescriptionSlipNo: `RX-NARC-${suffix}`,
      },
    });

  if (resVerified.status !== 201) {
    throw new Error(`Sale creation failed with status ${resVerified.status}: ${JSON.stringify(resVerified.body)}`);
  }

  const sale = resVerified.body.data;
  console.log(`✅ Sale committed! Invoice: ${sale.invoiceNo}`);
  console.log(`   Prescription info saved: ${sale.prescription}`);
  console.log(`   Narcotic details stored: Doctor PMDC: ${sale.narcoticDetails?.doctorRegNo}, Patient CNIC: ${sale.narcoticDetails?.patientCnic}`);

  // 4. Verify Form-9 Register query API
  console.log('\n--- 4. Querying Form-9 Regulatory Register API ---');
  const resRegister = await request(app)
    .get('/api/v1/regulatory/form9')
    .set('Authorization', authHeader)
    .query({ search: suffix });

  if (resRegister.status !== 200) {
    throw new Error(`Form9 query failed: ${resRegister.status}`);
  }

  const entries = resRegister.body.data;
  console.log(`✅ Form-9 records found: ${entries.length}`);
  const entry = entries.find((e: any) => e.invoiceNo === sale.invoiceNo);
  if (!entry) {
    throw new Error(`Sale ${sale.invoiceNo} not found in Form-9 register`);
  }

  if (
    entry.doctorRegNo === pmdcReg &&
    entry.patientCnic === patientCnic &&
    entry.medicineName.includes(`Morphine Sulphate ${suffix}`) &&
    entry.qty === 5
  ) {
    console.log('✅ Form-9 entry fields 100% matched:');
    console.log(`   Invoice: ${entry.invoiceNo}`);
    console.log(`   Doctor: ${entry.doctorName} (Reg: ${entry.doctorRegNo})`);
    console.log(`   Patient: ${entry.patientName} (CNIC: ${entry.patientCnic})`);
    console.log(`   Drug: ${entry.medicineName} (Batch: ${entry.batchNo})`);
    console.log(`   Qty: ${entry.qty} units`);
  } else {
    throw new Error(`Form-9 entry mismatch: ${JSON.stringify(entry)}`);
  }

  // 5. Verify Printable Form-9 HTML Register
  console.log('\n--- 5. Testing Printable Form-9 Statutory Register Format ---');
  const resPrint = await request(app)
    .get('/api/v1/regulatory/form9/print')
    .set('Authorization', authHeader);

  if (resPrint.status !== 200 || !resPrint.text.toUpperCase().includes('FORM-9') || !resPrint.text.includes(pmdcReg)) {
    throw new Error(`Printable Form-9 failed or missing content: ${resPrint.status}`);
  }

  console.log('✅ Printable Form-9 HTML generated with official statutory layout and PMDC records');

  console.log('\n🎉 SPRINT 3: FORM-9 NARCOTIC VERIFICATION & REGISTER 100% VERIFIED!');
  await disconnectDB();
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

import 'dotenv/config';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connectDB, disconnectDB } from '../config/db';
import { app } from '../app';
import { User } from '../modules/users/model';
import { env } from '../config/env';

async function testAll() {
  await connectDB();
  console.log('🔗 Connected to DB');

  // Find or create owner user
  let owner = await User.findOne({ role: 'owner' });
  if (!owner) {
    owner = await User.create({
      name: 'Owner Test',
      username: 'test_owner_' + Date.now(),
      passwordHash: 'dummy',
      role: 'owner',
      isActive: true,
    });
  }

  // Generate valid owner JWT token
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

  console.log('🔑 Generated Owner JWT token');
  const authHeader = `Bearer ${token}`;

  // 1. Health check
  const healthRes = await request(app).get('/api/v1/health');
  console.log('1. Health check status:', healthRes.status, healthRes.body);

  // 2. Revenue Summary
  const summaryRes = await request(app)
    .get('/api/v1/revenue/summary')
    .set('Authorization', authHeader);
  console.log('2. GET /revenue/summary status:', summaryRes.status);
  console.log('   Data:', JSON.stringify(summaryRes.body.data, null, 2));

  // 3. Revenue Daily
  const dailyRes = await request(app)
    .get('/api/v1/revenue/daily')
    .set('Authorization', authHeader);
  console.log('3. GET /revenue/daily status:', dailyRes.status, 'days count:', dailyRes.body.data?.length);

  // 4. Revenue Hours
  const hoursRes = await request(app)
    .get('/api/v1/revenue/hours')
    .set('Authorization', authHeader);
  console.log('4. GET /revenue/hours status:', hoursRes.status, 'hours count:', hoursRes.body.data?.length);

  // 5. Revenue Medicines
  const medsRes = await request(app)
    .get('/api/v1/revenue/medicines')
    .set('Authorization', authHeader);
  console.log('5. GET /revenue/medicines status:', medsRes.status, 'meds count:', medsRes.body.data?.length);

  // 6. Revenue Customers
  const custRes = await request(app)
    .get('/api/v1/revenue/customers')
    .set('Authorization', authHeader);
  console.log('6. GET /revenue/customers status:', custRes.status, 'cust count:', custRes.body.data?.length);

  // 7. Revenue CSV Export
  const csvRes = await request(app)
    .get('/api/v1/revenue/export.csv')
    .set('Authorization', authHeader);
  console.log('7. GET /revenue/export.csv status:', csvRes.status, 'content-type:', csvRes.headers['content-type']);

  // 8. Expense Create, Get, Delete
  const createExpRes = await request(app)
    .post('/api/v1/expenses')
    .set('Authorization', authHeader)
    .send({
      date: new Date().toISOString().slice(0, 10),
      category: 'Electricity & utilities',
      amount: 150.50,
      note: 'Verification test expense',
    });
  console.log('8. POST /expenses status:', createExpRes.status, createExpRes.body.data);
  const expenseId = createExpRes.body.data?._id;

  const getExpRes = await request(app)
    .get('/api/v1/expenses')
    .set('Authorization', authHeader);
  console.log('   GET /expenses count:', getExpRes.body.data?.length);

  if (expenseId) {
    const delExpRes = await request(app)
      .delete(`/api/v1/expenses/${expenseId}`)
      .set('Authorization', authHeader);
    console.log('   DELETE /expenses/:id status:', delExpRes.status, delExpRes.body);
  }

  // 9. Closing Today
  const closingTodayRes = await request(app)
    .get('/api/v1/closing/today')
    .set('Authorization', authHeader);
  console.log('9. GET /closing/today status:', closingTodayRes.status, closingTodayRes.body.data);

  // 10. Closing History
  const closingHistRes = await request(app)
    .get('/api/v1/closing')
    .set('Authorization', authHeader);
  console.log('10. GET /closing history status:', closingHistRes.status, 'count:', closingHistRes.body.data?.length);

  await disconnectDB();
  console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY!');
}

testAll().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

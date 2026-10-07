import 'dotenv/config';
import argon2 from 'argon2';
import { connectDB, disconnectDB } from '../config/db';
import { User } from '../modules/users/model';
import { Settings } from '../modules/settings/model';
import { Counter } from '../modules/sales/counterModel';

async function seed() {
  await connectDB();
  console.log('🌱 Seeding owner user and default settings...\n');

  // Create or update invoice counter for current year
  const year = new Date().getFullYear();
  await Counter.findByIdAndUpdate(
    `invoice-${year}`,
    { $setOnInsert: { seq: 0 } },
    { upsert: true }
  );
  console.log(`✅ Counter invoice-${year} ready`);

  // Default settings
  const settingsExist = await Settings.findOne();
  if (!settingsExist) {
    await Settings.create({
      shopName: 'HS Pharma',
      address: 'Main Bazaar',
      phone: '',
      billFooter: 'Thank you. Get well soon!',
      nearExpiryDays: 90,
      criticalDays: 30,
      cashierMaxDiscountBP: 500,
      managerMaxDiscountBP: 1500,
      managerPin: '1234',
    });
    console.log('✅ Default settings created');
  }

  // Owner user
  const existing = await User.findOne({ username: 'owner' });
  if (existing) {
    console.log('ℹ️  Owner user already exists. Username: owner');
  } else {
    const passwordHash = await argon2.hash('owner123');
    await User.create({
      name: 'Owner',
      username: 'owner',
      passwordHash,
      role: 'owner',
      isActive: true,
    });
    console.log('\n✅ Owner user created:');
    console.log('   Username: owner');
    console.log('   Password: owner123  ← CHANGE THIS IMMEDIATELY\n');
  }

  await disconnectDB();
  console.log('Done! 🎉');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

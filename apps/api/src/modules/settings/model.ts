import { Schema, model, Document } from 'mongoose';

export interface ISettings extends Document {
  shopName: string;
  address: string;
  phone: string;
  billFooter: string;
  nearExpiryDays: number;
  criticalDays: number;
  cashierMaxDiscountBP: number;
  managerMaxDiscountBP: number;
  managerPin?: string;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    shopName: { type: String, default: 'HS Pharma' },
    address: { type: String, default: 'Main Bazaar' },
    phone: { type: String, default: '' },
    billFooter: { type: String, default: 'Thank you. Get well soon!' },
    nearExpiryDays: { type: Number, default: 90 },
    criticalDays: { type: Number, default: 30 },
    cashierMaxDiscountBP: { type: Number, default: 500 },   // 5%
    managerMaxDiscountBP: { type: Number, default: 1500 },  // 15%
    managerPin: String,
  },
  { timestamps: true }
);

export const Settings = model<ISettings>('Settings', SettingsSchema);

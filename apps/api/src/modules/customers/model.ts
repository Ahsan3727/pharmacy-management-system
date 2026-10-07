import { Schema, model, Types, Document } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  phone?: string;
  address?: string;
  creditLimit: number; // paisa
  balance: number;     // paisa — cached sum of ledger
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    address: String,
    creditLimit: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ phone: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ balance: -1 });

export const Customer = model<ICustomer>('Customer', CustomerSchema);

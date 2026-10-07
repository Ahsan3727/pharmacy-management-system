import { Schema, model, Types, Document } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  balance: number; // paisa — cached amount owed to supplier
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: true, trim: true },
    phone: String,
    address: String,
    contactPerson: String,
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Supplier = model<ISupplier>('Supplier', SupplierSchema);

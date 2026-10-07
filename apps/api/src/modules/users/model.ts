import { Schema, model, Types, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  username: string;
  passwordHash: string;
  role: 'owner' | 'manager' | 'cashier';
  pinHash?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    username: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String, enum: ['owner', 'manager', 'cashier'], required: true,
    },
    pinHash: String,
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);

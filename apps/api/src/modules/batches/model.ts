import { Schema, model, Types, Document } from 'mongoose';

export type BatchStatus = 'active' | 'expired' | 'quarantined' | 'depleted';

export interface IBatch extends Document {
  medicineId: Types.ObjectId;
  batchNo: string;
  mfgDate?: Date;
  expiryDate: Date;
  purchasePricePerPack: number; // paisa
  salePricePerPack: number;     // paisa
  mrpPerPack?: number;           // paisa
  qtyOnHand: number;             // base units (smallest sellable unit)
  supplierId?: Types.ObjectId;
  purchaseId?: Types.ObjectId;
  status: BatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchNo: { type: String, required: true, trim: true, uppercase: true },
    mfgDate: Date,
    expiryDate: { type: Date, required: true },
    purchasePricePerPack: { type: Number, required: true, min: 0 },
    salePricePerPack: { type: Number, required: true, min: 0 },
    mrpPerPack: Number,
    qtyOnHand: { type: Number, required: true, min: 0 }, // base units
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase' },
    status: {
      type: String,
      enum: ['active', 'expired', 'quarantined', 'depleted'],
      default: 'active',
    },
  },
  { timestamps: true }
);

BatchSchema.index({ medicineId: 1, expiryDate: 1 });
BatchSchema.index({ batchNo: 1 });
BatchSchema.index({ status: 1, expiryDate: 1 });

export const Batch = model<IBatch>('Batch', BatchSchema);

import { Schema, model, Types, Document } from 'mongoose';

export interface ISupplierReturnItem {
  medicineId: Types.ObjectId;
  batchId: Types.ObjectId;
  medicineName: string;
  batchNo: string;
  expiryDate: Date;
  packs: number;
  packSize: number;
  baseUnits: number;
  unitCreditPricePerPack: number; // paisa
  creditTotal: number;           // paisa
  reason: string;
}

export interface ISupplierReturn extends Document {
  debitNoteNo: string;
  supplierId: Types.ObjectId;
  supplierName: string;
  items: ISupplierReturnItem[];
  totalCreditAmount: number; // paisa
  note?: string;
  processedBy: Types.ObjectId;
  processedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierReturnItemSchema = new Schema<ISupplierReturnItem>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    medicineName: { type: String, required: true },
    batchNo: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    packs: { type: Number, required: true, min: 1 },
    packSize: { type: Number, required: true, min: 1 },
    baseUnits: { type: Number, required: true, min: 1 },
    unitCreditPricePerPack: { type: Number, required: true, min: 0 },
    creditTotal: { type: Number, required: true, min: 0 },
    reason: { type: String, default: 'near_expiry' },
  },
  { _id: false }
);

const SupplierReturnSchema = new Schema<ISupplierReturn>(
  {
    debitNoteNo: { type: String, required: true, unique: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String, required: true },
    items: [SupplierReturnItemSchema],
    totalCreditAmount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    processedByName: { type: String, required: true },
  },
  { timestamps: true }
);

SupplierReturnSchema.index({ createdAt: -1 });
SupplierReturnSchema.index({ supplierId: 1, createdAt: -1 });

export const SupplierReturn = model<ISupplierReturn>('SupplierReturn', SupplierReturnSchema);

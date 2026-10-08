import { Schema, model, Types, Document } from 'mongoose';

export interface ISaleReturnItem {
  saleItemIndex: number;
  medicineId: Types.ObjectId;
  batchId: Types.ObjectId;
  nameSnapshot: string;
  batchNoSnapshot: string;
  qtyReturned: number;       // base units
  unitRefundPrice: number;   // paisa per base unit
  refundAmount: number;      // paisa
  restock: boolean;          // true = restored to batch stock; false = damaged/quarantined
}

export interface ISaleReturn extends Document {
  returnNo: string;
  saleId: Types.ObjectId;
  saleInvoiceNo: string;
  customerId?: Types.ObjectId;
  customerNameSnapshot: string;
  items: ISaleReturnItem[];
  totalRefund: number;       // paisa
  refundMethod: 'cash' | 'udhaar_reduction';
  reason: string;
  processedBy: Types.ObjectId;
  processedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const SaleReturnItemSchema = new Schema<ISaleReturnItem>(
  {
    saleItemIndex: { type: Number, required: true },
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    nameSnapshot: { type: String, required: true },
    batchNoSnapshot: { type: String, required: true },
    qtyReturned: { type: Number, required: true, min: 1 },
    unitRefundPrice: { type: Number, required: true, min: 0 },
    refundAmount: { type: Number, required: true, min: 0 },
    restock: { type: Boolean, default: true },
  },
  { _id: false }
);

const SaleReturnSchema = new Schema<ISaleReturn>(
  {
    returnNo: { type: String, required: true, unique: true },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true },
    saleInvoiceNo: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerNameSnapshot: { type: String, default: 'Walk-in' },
    items: [SaleReturnItemSchema],
    totalRefund: { type: Number, required: true, min: 0 },
    refundMethod: { type: String, enum: ['cash', 'udhaar_reduction'], default: 'cash' },
    reason: { type: String, required: true },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    processedByName: { type: String, required: true },
  },
  { timestamps: true }
);

SaleReturnSchema.index({ createdAt: -1 });
SaleReturnSchema.index({ saleId: 1 });
SaleReturnSchema.index({ customerId: 1, createdAt: -1 });

export const SaleReturn = model<ISaleReturn>('SaleReturn', SaleReturnSchema);

import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditItem {
  medicineId: Types.ObjectId;
  batchId: Types.ObjectId;
  medicineName: string;
  batchNo: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  unitCost: number;
  varianceValue: number;
}

export interface IStockAudit extends Document {
  auditNo: string;
  rack?: string;
  category?: string;
  conductedBy: Types.ObjectId;
  conductedByName: string;
  status: 'completed' | 'cancelled';
  items: IAuditItem[];
  totalVarianceQty: number;
  totalVarianceValue: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditItemSchema = new Schema<IAuditItem>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    medicineName: { type: String, required: true },
    batchNo: { type: String, required: true },
    systemQty: { type: Number, required: true },
    countedQty: { type: Number, required: true },
    variance: { type: Number, required: true },
    unitCost: { type: Number, required: true, default: 0 },
    varianceValue: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const StockAuditSchema = new Schema<IStockAudit>(
  {
    auditNo: { type: String, required: true, unique: true },
    rack: { type: String },
    category: { type: String },
    conductedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    conductedByName: { type: String, required: true },
    status: { type: String, enum: ['completed', 'cancelled'], default: 'completed' },
    items: [AuditItemSchema],
    totalVarianceQty: { type: Number, required: true, default: 0 },
    totalVarianceValue: { type: Number, required: true, default: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

StockAuditSchema.index({ createdAt: -1 });

export const StockAudit = model<IStockAudit>('StockAudit', StockAuditSchema);

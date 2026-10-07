import { Schema, model, Types, Document } from 'mongoose';

export interface IPurchaseLine {
  medicineId: Types.ObjectId;
  batchId: Types.ObjectId;
  batchNo: string;
  expiryDate: Date;
  packs: number;
  bonusPacks: number;
  totalBaseUnits: number;    // (packs + bonus) * packSize
  purchasePricePerPack: number; // paisa — effective cost after bonus
  salePricePerPack: number;     // paisa
  lineTotal: number;            // paisa = packs * purchasePricePerPack (paid qty only)
}

export interface IPurchase extends Document {
  supplierId: Types.ObjectId;
  supplierInvoiceNo: string;
  invoiceDate: Date;
  lines: IPurchaseLine[];
  totalAmount: number; // paisa — total payable
  paidAmount: number;  // paisa
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseLineSchema = new Schema<IPurchaseLine>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    batchNo: String,
    expiryDate: Date,
    packs: Number,
    bonusPacks: { type: Number, default: 0 },
    totalBaseUnits: Number,
    purchasePricePerPack: Number,
    salePricePerPack: Number,
    lineTotal: Number,
  },
  { _id: false }
);

const PurchaseSchema = new Schema<IPurchase>(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierInvoiceNo: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, default: Date.now },
    lines: [PurchaseLineSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Prevent duplicate invoice per supplier
PurchaseSchema.index({ supplierId: 1, supplierInvoiceNo: 1 }, { unique: true });
PurchaseSchema.index({ createdAt: -1 });

export const Purchase = model<IPurchase>('Purchase', PurchaseSchema);

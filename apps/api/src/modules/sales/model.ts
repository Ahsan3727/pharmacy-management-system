import { Schema, model, Types, Document } from 'mongoose';

export interface ISaleItem {
  medicineId: Types.ObjectId;
  batchId: Types.ObjectId;
  // Snapshots — never change even if medicine/batch changes later
  nameSnapshot: string;
  batchNoSnapshot: string;
  expirySnapshot: string; // YYYY-MM-DD
  qty: number;            // base units
  unitLabel: string;      // "3 strips + 2 tabs"
  packPrice: number;      // sale price per pack at time of sale (paisa)
  lineTotal: number;      // paisa
  costSnapshot: number;   // purchase price per pack at time of sale (paisa)
  returnedQty?: number;   // base units returned so far
}

export interface ISale extends Document {
  invoiceNo: string;
  clientRequestId: string;
  customerId?: Types.ObjectId;
  customerNameSnapshot: string;
  items: ISaleItem[];
  subtotal: number;    // paisa
  discountBP: number;  // basis points
  discount: number;    // paisa
  roundOff: number;    // paisa (can be negative)
  total: number;       // paisa
  cashPaid: number;    // paisa
  cardPaid: number;    // paisa
  creditAmount: number; // paisa — goes to udhaar
  paidAmount: number;  // paisa = cash + card
  soldBy: Types.ObjectId;
  soldByName: string;
  status: 'ok' | 'void';
  voidReason?: string;
  prescription?: string;
  narcoticDetails?: {
    doctorName: string;
    doctorRegNo: string;
    patientCnic: string;
    patientName: string;
    prescriptionDate?: string;
    prescriptionSlipNo?: string;
  };
  customerBalanceBefore?: number; // paisa
  customerBalanceAfter?: number;  // paisa
  closingId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    nameSnapshot: { type: String, required: true },
    batchNoSnapshot: { type: String, required: true },
    expirySnapshot: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitLabel: String,
    packPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    costSnapshot: { type: Number, required: true, min: 0 },
    returnedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const SaleSchema = new Schema<ISale>(
  {
    invoiceNo: { type: String, required: true, unique: true },
    clientRequestId: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerNameSnapshot: { type: String, default: 'Walk-in' },
    items: [SaleItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountBP: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 0 },
    cashPaid: { type: Number, default: 0 },
    cardPaid: { type: Number, default: 0 },
    creditAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    soldBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    soldByName: { type: String, required: true },
    status: { type: String, enum: ['ok', 'void'], default: 'ok' },
    voidReason: String,
    prescription: String,
    narcoticDetails: {
      doctorName: String,
      doctorRegNo: String,
      patientCnic: String,
      patientName: String,
      prescriptionDate: String,
      prescriptionSlipNo: String,
    },
    customerBalanceBefore: Number,
    customerBalanceAfter: Number,
    closingId: Schema.Types.ObjectId,
  },
  { timestamps: true }
);

SaleSchema.index({ createdAt: -1 });
SaleSchema.index({ createdAt: 1, status: 1 });
SaleSchema.index({ customerId: 1, createdAt: -1 });

export const Sale = model<ISale>('Sale', SaleSchema);

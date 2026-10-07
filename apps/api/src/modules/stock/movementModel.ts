import { Schema, model, Types, Document } from 'mongoose';

export type MovementType =
  | 'OPENING'
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'VOID'
  | 'EXPIRY_WRITEOFF'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'PURCHASE_RETURN';

export interface IStockMovement extends Document {
  batchId: Types.ObjectId;
  medicineId: Types.ObjectId;
  type: MovementType;
  qty: number;       // signed: positive = stock in, negative = stock out
  unitCost?: number; // paisa per base unit
  refType?: string;  // 'Sale', 'Purchase', etc.
  refId?: string;    // invoice number or object id string
  userId?: Types.ObjectId;
  note?: string;
  createdAt: Date;
}

// APPEND-ONLY — never update or delete
const StockMovementSchema = new Schema<IStockMovement>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    type: {
      type: String,
      enum: ['OPENING','PURCHASE','SALE','RETURN','VOID','EXPIRY_WRITEOFF','DAMAGE','ADJUSTMENT','PURCHASE_RETURN'],
      required: true,
    },
    qty: { type: Number, required: true }, // positive = in, negative = out
    unitCost: Number,
    refType: String,
    refId: String,
    userId: Schema.Types.ObjectId,
    note: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } } // append-only
);

StockMovementSchema.index({ batchId: 1, createdAt: 1 });
StockMovementSchema.index({ refType: 1, refId: 1 });

export const StockMovement = model<IStockMovement>('StockMovement', StockMovementSchema);

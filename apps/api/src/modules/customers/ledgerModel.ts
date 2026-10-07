import { Schema, model, Types, Document } from 'mongoose';

export type LedgerEntryType =
  | 'OPENING'
  | 'CREDIT_SALE'
  | 'PAYMENT'
  | 'RETURN_ADJUST'
  | 'WRITE_OFF'
  | 'ADJUSTMENT';

export interface ICustomerLedger extends Document {
  customerId: Types.ObjectId;
  type: LedgerEntryType;
  amount: number;       // paisa — positive = customer owes more, negative = customer paid
  refType?: string;
  refId?: string;
  method?: string;      // 'cash', 'card', 'transfer'
  note?: string;
  userId?: Types.ObjectId;
  date: string;         // YYYY-MM-DD (business date for closing)
  createdAt: Date;
}

// APPEND-ONLY — never update or delete
const CustomerLedgerSchema = new Schema<ICustomerLedger>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    type: {
      type: String,
      enum: ['OPENING','CREDIT_SALE','PAYMENT','RETURN_ADJUST','WRITE_OFF','ADJUSTMENT'],
      required: true,
    },
    amount: { type: Number, required: true },
    refType: String,
    refId: String,
    method: String,
    note: String,
    userId: Schema.Types.ObjectId,
    date: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CustomerLedgerSchema.index({ customerId: 1, createdAt: 1 });
CustomerLedgerSchema.index({ date: 1 });

export const CustomerLedger = model<ICustomerLedger>('CustomerLedger', CustomerLedgerSchema);

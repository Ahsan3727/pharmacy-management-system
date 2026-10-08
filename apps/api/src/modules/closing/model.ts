import { Schema, model, Document } from 'mongoose';

export interface IClosing extends Document {
  date: string;           // YYYY-MM-DD, unique per day
  openingCash: number;    // paisa
  cashSales: number;      // paisa — calculated, not entered
  udhaarCashReceived: number; // paisa
  expectedCash: number;   // paisa = opening + cash sales + udhaar received
  countedCash: number;    // paisa — entered by staff
  difference: number;     // paisa — can be negative (short)
  closedBy: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClosingSchema = new Schema<IClosing>(
  {
    date:               { type: String, required: true, unique: true },
    openingCash:        { type: Number, required: true, min: 0 },
    cashSales:          { type: Number, required: true, min: 0 },
    udhaarCashReceived: { type: Number, required: true, default: 0 },
    expectedCash:       { type: Number, required: true, min: 0 },
    countedCash:        { type: Number, required: true, min: 0 },
    difference:         { type: Number, required: true },
    closedBy:           { type: String, required: true },
    notes:              { type: String, default: '' },
  },
  { timestamps: true }
);

ClosingSchema.index({ date: -1 });

export const Closing = model<IClosing>('Closing', ClosingSchema);

import { Schema, model, Document } from 'mongoose';

// Counter for gap-free invoice numbers — pre-created in migration 001
export interface ICounter extends Document<string> {
  _id: string;  // e.g. "invoice-2026"
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: String,
  seq: { type: Number, default: 0 },
});

export const Counter = model<ICounter>('Counter', CounterSchema);

/** Generate next gap-free invoice number within a MongoDB transaction */
export async function nextInvoiceNo(session: any): Promise<string> {
  const year = new Date().getFullYear();
  const key = `invoice-${year}`;
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `INV-${year}-${String(doc!.seq).padStart(6, '0')}`;
}

/** Generate next gap-free customer return number within a MongoDB transaction */
export async function nextReturnNo(session: any): Promise<string> {
  const year = new Date().getFullYear();
  const key = `return-${year}`;
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `RET-${year}-${String(doc!.seq).padStart(6, '0')}`;
}

/** Generate next gap-free supplier debit note number within a MongoDB transaction */
export async function nextDebitNoteNo(session: any): Promise<string> {
  const year = new Date().getFullYear();
  const key = `debitnote-${year}`;
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `DN-${year}-${String(doc!.seq).padStart(6, '0')}`;
}

/** Generate next gap-free stock audit number within a MongoDB transaction */
export async function nextAuditNo(session?: any): Promise<string> {
  const year = new Date().getFullYear();
  const key = `audit-${year}`;
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `AUD-${year}-${String(doc!.seq).padStart(6, '0')}`;
}

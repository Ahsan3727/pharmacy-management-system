import { Schema, model, Document, Types } from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Salaries',
  'Electricity & utilities',
  'Transport',
  'Maintenance',
  'Licences & taxes',
  'Marketing',
  'Other',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface IExpense extends Document {
  date: string;            // YYYY-MM-DD
  category: ExpenseCategory;
  amountPaisa: number;     // integer, always paisa
  note?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    date:        { type: String, required: true },
    category:    { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amountPaisa: { type: Number, required: true, min: 1 },
    note:        { type: String, default: '' },
    createdBy:   { type: String, required: true },
  },
  { timestamps: true }
);

ExpenseSchema.index({ date: 1 });

export const Expense = model<IExpense>('Expense', ExpenseSchema);

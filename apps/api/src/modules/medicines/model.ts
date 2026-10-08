import { Schema, model, Types, Document } from 'mongoose';

export interface IMedicine extends Document {
  name: string;
  genericName: string;
  strength?: string;
  form?: string;
  company?: string;
  category?: string;
  storageCondition?: string;
  prescriptionType?: string;
  gstRateBP?: number;
  packSize: number;
  packsPerBox: number;
  looseUnit: string;
  packUnit: string;
  minStock: number;
  rack?: string;
  barcodes: string[];
  isControlled: boolean;
  searchTokens: string[];
  // Pricing (cached from last purchase, visible to owner only)
  purchasePricePerPack?: number;
  salePricePerPack?: number;
  mrpPerPack?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineSchema = new Schema<IMedicine>(
  {
    name: { type: String, required: true, trim: true },
    genericName: { type: String, required: true, trim: true },
    strength: String,
    form: String,
    company: String,
    category: { type: String, default: 'General & Other' },
    storageCondition: { type: String, default: 'room_temperature' },
    prescriptionType: { type: String, default: 'otc' },
    gstRateBP: { type: Number, default: 0, min: 0 },
    packSize: { type: Number, required: true, min: 1 },
    packsPerBox: { type: Number, default: 1, min: 1 },
    looseUnit: { type: String, default: 'tab' },
    packUnit: { type: String, default: 'strip' },
    minStock: { type: Number, default: 0, min: 0 }, // in base units
    rack: String,
    barcodes: [{ type: String, sparse: true }],
    isControlled: { type: Boolean, default: false },
    searchTokens: [String],
    purchasePricePerPack: Number,
    salePricePerPack: Number,
    mrpPerPack: Number,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes
MedicineSchema.index({ searchTokens: 1 });
MedicineSchema.index({ genericName: 1 });
MedicineSchema.index({ category: 1 });
MedicineSchema.index({ storageCondition: 1 });
MedicineSchema.index({ isActive: 1 });

/** Generate lowercase word tokens from name, genericName, company, category for fast prefix search */
export function generateSearchTokens(
  name: string,
  genericName: string,
  company = '',
  category = ''
): string[] {
  const text = `${name} ${genericName} ${company} ${category}`.toLowerCase();
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  const stripped = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (stripped) tokens.push(stripped);
  return [...new Set(tokens)];
}

export const Medicine = model<IMedicine>('Medicine', MedicineSchema);

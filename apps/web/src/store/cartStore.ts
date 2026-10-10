import { create } from 'zustand';
import { mulDiv, pct, roundToHundred } from '@hs-pharma/shared';
import { newClientRequestId } from '../lib/fmt';

interface CartItem {
  medicineId: string;
  batchId?: string;
  name: string;
  batchNo: string;
  expiryDate: string;
  packSize: number;
  looseUnit: string;
  packUnit: string;
  qty: number; // base units
  packPrice: number; // sale price per pack in paisa
  lineTotal: number; // paisa
  maxQty: number; // available stock
  storageCondition?: string;
  prescriptionType?: string;
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
  customerName: string | null;
  discountBP: number;
  paymentMode: 'cash' | 'card' | 'credit' | 'split';
  cashPaid: number;
  cardPaid: number;
  prescription: string;
  clientRequestId: string | null;
  ensureClientRequestId: () => string;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQty: (index: number, qty: number) => void;
  setCustomer: (id: string | null, name: string | null) => void;
  setDiscount: (bp: number) => void;
  setPaymentMode: (mode: CartState['paymentMode']) => void;
  setCashPaid: (v: number) => void;
  setCardPaid: (v: number) => void;
  setPrescription: (v: string) => void;
  clear: () => void;
  subtotal: () => number;
  discount: () => number;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,
  customerName: null,
  discountBP: 0,
  paymentMode: 'cash',
  cashPaid: 0,
  cardPaid: 0,
  prescription: '',
  clientRequestId: null,

  ensureClientRequestId: () => {
    let id = get().clientRequestId;
    if (!id) {
      id = newClientRequestId();
      set({ clientRequestId: id });
    }
    return id;
  },

  addItem: (item) => {
    const items = get().items;
    let reqId = get().clientRequestId;
    if (!reqId) {
      reqId = newClientRequestId();
    }

    // If same batch already in cart, top up qty
    const idx = items.findIndex(
      (i) => i.medicineId === item.medicineId && (i.batchId === item.batchId || !item.batchId)
    );
    if (idx >= 0) {
      const existing = items[idx];
      const newQty = Math.min(existing.qty + item.qty, item.maxQty);
      const lineTotal = mulDiv(newQty, existing.packPrice, existing.packSize);
      const updated = [...items];
      updated[idx] = { ...existing, qty: newQty, lineTotal };
      set({ items: updated, clientRequestId: reqId });
    } else {
      set({ items: [...items, item], clientRequestId: reqId });
    }
  },

  removeItem: (index) => {
    const items = [...get().items];
    items.splice(index, 1);
    set({ items, clientRequestId: items.length === 0 ? null : get().clientRequestId });
  },

  updateQty: (index, qty) => {
    const items = [...get().items];
    const item = items[index];
    const clamped = Math.max(1, Math.min(qty, item.maxQty));
    items[index] = { ...item, qty: clamped, lineTotal: mulDiv(clamped, item.packPrice, item.packSize) };
    set({ items });
  },

  setCustomer: (id, name) => set({ customerId: id, customerName: name }),
  setDiscount: (bp) => set({ discountBP: bp }),
  setPaymentMode: (mode) => set({ paymentMode: mode }),
  setCashPaid: (v) => set({ cashPaid: v }),
  setCardPaid: (v) => set({ cardPaid: v }),
  setPrescription: (v) => set({ prescription: v }),

  clear: () =>
    set({
      items: [],
      customerId: null,
      customerName: null,
      discountBP: 0,
      paymentMode: 'cash',
      cashPaid: 0,
      cardPaid: 0,
      prescription: '',
      clientRequestId: null,
    }),

  subtotal: () => get().items.reduce((a, i) => a + i.lineTotal, 0),
  discount: () => pct(get().items.reduce((a, i) => a + i.lineTotal, 0), get().discountBP),
  total: () => {
    const sub = get().items.reduce((a, i) => a + i.lineTotal, 0);
    const disc = pct(sub, get().discountBP);
    return roundToHundred(sub - disc);
  },
}));

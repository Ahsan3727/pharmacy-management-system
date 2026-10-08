import { api } from './api';

export interface RevenuePeriod {
  from: string;
  to: string;
  days: number;
}

export interface RevenueSummary {
  period: RevenuePeriod;
  revenue: number;        // paisa
  billCount: number;
  avgBillValue: number;   // paisa
  cashCollected: number;  // paisa
  cardCollected: number;  // paisa
  udhaarGiven: number;    // paisa
  udhaarRecovered: number;// paisa
  discountsGiven: number; // paisa
  voidedCount: number;
  voidedAmount: number;   // paisa
  prevRevenue: number;    // paisa
  changePct: number | null;
  totalExpenses: number;  // paisa
  // Owner only:
  cost?: number;          // paisa
  grossProfit?: number;   // paisa
  grossMarginPct?: number;// percentage
  netProfit?: number;     // paisa
  netMarginPct?: number;  // percentage
}

export interface DailyRevenueItem {
  date: string;           // YYYY-MM-DD
  billCount: number;
  revenue: number;        // paisa
  cashPaid: number;       // paisa
  cardPaid: number;       // paisa
  credit: number;         // paisa
  discount: number;       // paisa
  // Owner only:
  cost?: number;          // paisa
  profit?: number;        // paisa
}

export interface HourlyRevenueItem {
  hour: number;           // 0-23
  label: string;          // '8 AM', etc.
  revenue: number;        // paisa
  billCount: number;
}

export interface TopMedicineItem {
  medicineId: string;
  name: string;
  revenue: number;        // paisa
  qty: number;
  // Owner only:
  cost?: number;          // paisa
  profit?: number;        // paisa
}

export interface TopCustomerItem {
  customerName: string;
  revenue: number;        // paisa
  billCount: number;
}

export interface ExpenseItem {
  _id: string;
  date: string;           // YYYY-MM-DD
  category: string;
  amountPaisa: number;    // paisa
  note?: string;
  createdBy: string;
  createdAt: string;
}

export interface ClosingRecord {
  _id: string;
  date: string;
  openingCash: number;    // paisa
  cashSales: number;      // paisa
  udhaarCashReceived: number; // paisa
  expectedCash: number;   // paisa
  countedCash: number;    // paisa
  difference: number;     // paisa
  closedBy: string;
  notes?: string;
  createdAt: string;
}

export interface TodayClosingStatus {
  date: string;
  isClosed: boolean;
  closing?: ClosingRecord | null;
  defaultOpeningCash: number;
  cashSales: number;
  udhaarCashReceived: number;
  expectedCash: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function fetchRevenueSummary(from: string, to: string): Promise<RevenueSummary> {
  const res = await api.get('/revenue/summary', { params: { from, to } });
  return res.data.data;
}

export async function fetchDailyRevenue(from: string, to: string): Promise<DailyRevenueItem[]> {
  const res = await api.get('/revenue/daily', { params: { from, to } });
  return res.data.data;
}

export async function fetchHourlyRevenue(from: string, to: string): Promise<HourlyRevenueItem[]> {
  const res = await api.get('/revenue/hours', { params: { from, to } });
  return res.data.data;
}

export async function fetchTopMedicines(from: string, to: string, limit = 8): Promise<TopMedicineItem[]> {
  const res = await api.get('/revenue/medicines', { params: { from, to, limit } });
  return res.data.data;
}

export async function fetchTopCustomers(from: string, to: string, limit = 6): Promise<TopCustomerItem[]> {
  const res = await api.get('/revenue/customers', { params: { from, to, limit } });
  return res.data.data;
}

export async function fetchExpenses(from?: string, to?: string): Promise<ExpenseItem[]> {
  const res = await api.get('/expenses', { params: { from, to } });
  return res.data.data;
}

export async function createExpense(data: { date: string; category: string; amount: number; note?: string }): Promise<ExpenseItem> {
  const res = await api.post('/expenses', data);
  return res.data.data;
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/expenses/${id}`);
}

export async function fetchTodayClosing(): Promise<TodayClosingStatus> {
  const res = await api.get('/closing/today');
  return res.data.data;
}

export async function fetchClosingHistory(limit = 30): Promise<ClosingRecord[]> {
  const res = await api.get('/closing', { params: { limit } });
  return res.data.data;
}

export async function createClosing(data: {
  date?: string;
  openingCash: number; // paisa
  countedCash: number; // paisa
  notes?: string;
}): Promise<ClosingRecord> {
  const res = await api.post('/closing', data);
  return res.data.data;
}

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

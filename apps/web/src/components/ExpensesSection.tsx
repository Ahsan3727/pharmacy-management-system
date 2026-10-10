import React, { useState } from 'react';
import { ExpenseItem, EXPENSE_CATEGORIES, createExpense, deleteExpense } from '../lib/revenueApi';
import { fmt } from '../lib/fmt';
import { ConfirmModal } from './Modal';

interface ExpensesSectionProps {
  expenses: ExpenseItem[];
  totalRevenue: number;
  onExpenseMutated: () => void;
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpensesSection({ expenses, totalRevenue, onExpenseMutated }: ExpensesSectionProps) {
  const [date, setDate] = useState(getTodayIso());
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amountRupees, setAmountRupees] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amountRupees);
    if (!num || num <= 0) {
      setError('Please enter a valid amount in Rupees');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await createExpense({
        date,
        category,
        amount: num,
        note: note.trim() || undefined,
      });
      setAmountRupees('');
      setNote('');
      onExpenseMutated();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to add expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteExpense(deleteTargetId);
      onExpenseMutated();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Failed to delete expense');
    } finally {
      setDeleteTargetId(null);
    }
  };

  // Group expenses by category
  const categoryTotals: Record<string, number> = {};
  let totalExpensesPaisa = 0;
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amountPaisa;
    totalExpensesPaisa += e.amountPaisa;
  });

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="two">
      {/* Add expense form + list */}
      <div className="card">
        <h3>Record expense</h3>
        <form onSubmit={handleSubmit} className="f3">
          <label>
            Date
            <input
              type="date"
              value={date}
              max={getTodayIso()}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount (Rs)
            <input
              type="number"
              step="any"
              min="0.01"
              required
              placeholder="0.00"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
            />
          </label>
          <label>
            Note
            <input
              type="text"
              placeholder="Optional note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button type="submit" className="btn" disabled={isSubmitting}>
            {isSubmitting ? 'Adding…' : 'Add expense'}
          </button>
        </form>

        {error && <p className="err" style={{ margin: '8px 0' }}>{error}</p>}

        <small style={{ margin: '8px 0 12px', color: 'var(--mut)' }}>
          Expenses count on the date you enter them. For the most accurate net margin, view "This month".
        </small>

        {expenses.length > 0 ? (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th className="r">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.slice(0, 10).map((item) => (
                  <tr key={item._id}>
                    <td>{formatShortDate(item.date)}</td>
                    <td>
                      <b>{item.category}</b>
                      {item.note && <small>{item.note}</small>}
                    </td>
                    <td className="r">
                      <b>{fmt(item.amountPaisa)}</b>
                    </td>
                    <td className="r" style={{ width: 40 }}>
                      <button
                        type="button"
                        className="x"
                        onClick={() => setDeleteTargetId(item._id)}
                        aria-label="Delete expense"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length > 10 && (
              <small style={{ marginTop: 6, color: 'var(--mut)' }}>
                Showing latest 10 of {expenses.length} expenses
              </small>
            )}
          </div>
        ) : (
          <p className="mut" style={{ marginTop: 8 }}>
            No expenses recorded in this period.
          </p>
        )}
      </div>

      {/* Expenses by category breakdown */}
      <div className="card">
        <h3>Expenses by category</h3>
        {totalExpensesPaisa > 0 ? (
          sortedCategories.map(([catName, catAmount]) => {
            const expPct = Math.round((catAmount / totalExpensesPaisa) * 100);
            const salesPct =
              totalRevenue > 0 ? ((catAmount / totalRevenue) * 100).toFixed(1) : '0.0';

            return (
              <div key={catName} className="bi">
                <div className="ln">
                  <span>{catName}</span>
                  <b>{fmt(catAmount)}</b>
                </div>
                <div className="bar2">
                  <i style={{ width: `${expPct}%` }} />
                </div>
                <small>
                  {expPct}% of expenses · {salesPct}% of sales
                </small>
              </div>
            );
          })
        ) : (
          <p className="mut">
            Add your rent, salaries and utility bills to see your true net profit and margin.
          </p>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTargetId}
        title="Delete Expense"
        message="Are you sure you want to delete this recorded expense?"
        confirmText="Delete"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteTargetId(null)}
      />
    </div>
  );
}

import React from 'react';
import { TopCustomerItem } from '../lib/revenueApi';
import { fmt } from '../lib/fmt';

interface TopCustomersCardProps {
  customers: TopCustomerItem[];
  totalRevenue: number;
}

export function TopCustomersCard({ customers, totalRevenue }: TopCustomersCardProps) {
  if (customers.length === 0) {
    return (
      <div className="card">
        <h3>Top customers</h3>
        <p className="mut">No sales in this period.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Top customers</h3>
      {customers.map((c) => {
        const revPct = totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0;
        return (
          <div key={c.customerName} className="bi">
            <div className="ln">
              <b>{c.customerName}</b>
              <b>{fmt(c.revenue)}</b>
            </div>
            <small>
              {c.billCount} bill{c.billCount > 1 ? 's' : ''} · {revPct}% of revenue
            </small>
          </div>
        );
      })}
    </div>
  );
}

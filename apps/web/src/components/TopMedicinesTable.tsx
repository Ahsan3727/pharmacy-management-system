import React from 'react';
import { TopMedicineItem } from '../lib/revenueApi';
import { fmt } from '../lib/fmt';

interface TopMedicinesTableProps {
  medicines: TopMedicineItem[];
  totalRevenue: number;
  isOwner: boolean;
}

export function TopMedicinesTable({ medicines, totalRevenue, isOwner }: TopMedicinesTableProps) {
  if (medicines.length === 0) {
    return (
      <div className="card tw">
        <h3>Top medicines</h3>
        <p className="mut">No sales in this period.</p>
      </div>
    );
  }

  const topRevenue = medicines[0].revenue || 1;

  return (
    <div className="card tw">
      <h3>Top medicines</h3>
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th className="r">Revenue</th>
            {isOwner && <th className="r">Profit</th>}
          </tr>
        </thead>
        <tbody>
          {medicines.map((item) => {
            const barWidth = Math.max(2, Math.min(100, (item.revenue / topRevenue) * 100));
            const revPct = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0;
            const marginPct =
              item.revenue > 0 && item.profit != null
                ? Math.round((item.profit / item.revenue) * 100)
                : 0;

            return (
              <tr key={item.medicineId || item.name}>
                <td>
                  <b>{item.name}</b>
                  <div className="bar2">
                    <i style={{ width: `${barWidth}%` }} />
                  </div>
                </td>
                <td className="r">
                  <b>{fmt(item.revenue)}</b>
                  <small>{revPct}% of revenue</small>
                </td>
                {isOwner && (
                  <td className="r">
                    {item.profit != null ? (
                      <>
                        <b>{fmt(item.profit)}</b>
                        <small>{marginPct}% margin</small>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

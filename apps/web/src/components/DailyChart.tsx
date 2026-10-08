import React from 'react';
import { DailyRevenueItem } from '../lib/revenueApi';
import { fmt } from '../lib/fmt';

interface DailyChartProps {
  days: DailyRevenueItem[];
  isOwner: boolean;
}

function formatDayLabel(dateStr: string, totalCount: number, index: number, step: number): string {
  if (totalCount <= 10) {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  }
  // For longer ranges, only show labels every `step` days to avoid overlap
  if ((totalCount - 1 - index) % step !== 0) {
    return '';
  }
  return dateStr.slice(8); // '08', '15', etc.
}

function formatTooltipDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function DailyChart({ days, isOwner }: DailyChartProps) {
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  const n = days.length;
  const step = Math.ceil(n / 10);
  const gap = n > 20 ? 3 : 8;

  return (
    <div className="card">
      <div className="ln" style={{ alignItems: 'baseline', marginBottom: 6 }}>
        <h3>Daily revenue</h3>
        {isOwner && (
          <small style={{ color: 'var(--mut)' }}>
            The light green segment inside each bar is profit.
          </small>
        )}
      </div>

      <div className="bars" style={{ gap: `${gap}px` }}>
        {days.map((item, idx) => {
          const heightPct = Math.max(2, (item.revenue / maxRevenue) * 100);
          const profitPct =
            item.revenue > 0 && item.profit != null
              ? Math.max(0, Math.min(100, (item.profit / item.revenue) * 100))
              : 0;

          const tooltip = `${formatTooltipDate(item.date)} · ${fmt(item.revenue)} · ${item.billCount} bills${
            isOwner && item.profit != null ? ` · profit ${fmt(item.profit)}` : ''
          }`;

          return (
            <div
              key={item.date}
              style={{
                height: `${heightPct}%`,
                position: 'relative',
              }}
              title={tooltip}
            >
              {isOwner && profitPct > 0 && (
                <i
                  style={{
                    height: `${profitPct}%`,
                  }}
                />
              )}
              <span>{formatDayLabel(item.date, n, idx, step)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

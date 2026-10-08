import React, { useState } from 'react';
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
  if ((totalCount - 1 - index) % step !== 0) {
    return '';
  }
  return dateStr.slice(8);
}

function formatTooltipDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function DailyChart({ days, isOwner }: DailyChartProps) {
  const [activeItem, setActiveItem] = useState<DailyRevenueItem | null>(null);

  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  const n = days.length;
  const step = Math.ceil(n / 10);
  const gap = n > 20 ? 3 : 8;

  const displayItem = activeItem || (days.length > 0 ? days[days.length - 1] : null);

  return (
    <div className="card">
      <div className="ln" style={{ alignItems: 'baseline', marginBottom: 6 }}>
        <div>
          <h3>Daily revenue</h3>
          {displayItem && (
            <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {formatTooltipDate(displayItem.date)}:
              </span>{' '}
              {fmt(displayItem.revenue)} · {displayItem.billCount} bills · Cash {fmt(displayItem.cashPaid)} · Card {fmt(displayItem.cardPaid)}
              {isOwner && displayItem.profit != null ? ` · Profit ${fmt(displayItem.profit)}` : ''}
            </div>
          )}
        </div>
        {isOwner && (
          <small style={{ color: 'var(--mut)', marginLeft: 'auto' }}>
            Inner light green segment = gross profit
          </small>
        )}
      </div>

      <div className="bars" style={{ gap: `${gap}px`, marginTop: 12 }}>
        {days.map((item, idx) => {
          const heightPct = Math.max(2, (item.revenue / maxRevenue) * 100);
          const profitPct =
            item.revenue > 0 && item.profit != null
              ? Math.max(0, Math.min(100, (item.profit / item.revenue) * 100))
              : 0;

          const isHovered = activeItem?.date === item.date;

          return (
            <div
              key={item.date}
              style={{
                height: `${heightPct}%`,
                position: 'relative',
                cursor: 'pointer',
                filter: isHovered ? 'brightness(1.2)' : undefined,
                transform: isHovered ? 'scaleY(1.03)' : undefined,
                transition: 'transform 0.15s, filter 0.15s',
              }}
              onMouseEnter={() => setActiveItem(item)}
              title={`${formatTooltipDate(item.date)}: ${fmt(item.revenue)}`}
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

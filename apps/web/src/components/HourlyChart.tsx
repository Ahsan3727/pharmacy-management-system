import React from 'react';
import { HourlyRevenueItem } from '../lib/revenueApi';
import { fmt } from '../lib/fmt';

interface HourlyChartProps {
  hours: HourlyRevenueItem[];
}

export function HourlyChart({ hours }: HourlyChartProps) {
  // Focus on pharmacy business hours 8 AM to 11 PM (hours 8 to 23)
  const businessHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  const hourMap = new Map<number, HourlyRevenueItem>();
  hours.forEach((h) => hourMap.set(h.hour, h));

  const maxRevenue = Math.max(
    ...businessHours.map((h) => hourMap.get(h)?.revenue ?? 0),
    1
  );

  // Find peak hour
  let peakHour = 8;
  let peakRev = 0;
  businessHours.forEach((h) => {
    const rev = hourMap.get(h)?.revenue ?? 0;
    if (rev > peakRev) {
      peakRev = rev;
      peakHour = h;
    }
  });

  const peakHourStr =
    peakRev > 0
      ? `Peak hour: ${peakHour % 12 || 12} ${peakHour < 12 ? 'AM' : 'PM'} · ${fmt(peakRev)}`
      : 'No sales yet in this period';

  return (
    <div className="card">
      <h3>Busiest hours</h3>
      <div className="bars" style={{ height: 90, gap: 4, marginBottom: 18 }}>
        {businessHours.map((h) => {
          const item = hourMap.get(h);
          const rev = item?.revenue ?? 0;
          const bills = item?.billCount ?? 0;
          const heightPct = Math.max(2, (rev / maxRevenue) * 100);
          const label = h % 2 !== 0 ? '' : `${h % 12 || 12}`;
          const tooltip = rev > 0 ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}: ${fmt(rev)} (${bills} bills)` : `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}: No sales`;

          return (
            <div
              key={h}
              style={{ height: `${heightPct}%` }}
              title={tooltip}
            >
              <span>{label}</span>
            </div>
          );
        })}
      </div>
      <small style={{ color: 'var(--mut)' }}>{peakHourStr}</small>
    </div>
  );
}

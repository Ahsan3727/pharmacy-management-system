import React, { useState } from 'react';
import { HourlyRevenueItem } from '../lib/revenueApi';
import { fmt } from '../lib/fmt';

interface HourlyChartProps {
  hours: HourlyRevenueItem[];
}

export function HourlyChart({ hours }: HourlyChartProps) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  // Business hours 8 AM to 11 PM
  const businessHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  const hourMap = new Map<number, HourlyRevenueItem>();
  hours.forEach((h) => hourMap.set(h.hour, h));

  const maxRevenue = Math.max(
    ...businessHours.map((h) => hourMap.get(h)?.revenue ?? 0),
    1
  );

  let peakHour = 8;
  let peakRev = 0;
  businessHours.forEach((h) => {
    const rev = hourMap.get(h)?.revenue ?? 0;
    if (rev > peakRev) {
      peakRev = rev;
      peakHour = h;
    }
  });

  const activeHour = hoveredHour !== null ? hourMap.get(hoveredHour) : null;
  const activeLabel =
    hoveredHour !== null
      ? `${hoveredHour % 12 || 12} ${hoveredHour < 12 ? 'AM' : 'PM'}: ${fmt(activeHour?.revenue ?? 0)} (${activeHour?.billCount ?? 0} bills)`
      : peakRev > 0
      ? `Peak hour: ${peakHour % 12 || 12} ${peakHour < 12 ? 'AM' : 'PM'} · ${fmt(peakRev)}`
      : 'No sales yet in this period';

  return (
    <div className="card">
      <div className="ln" style={{ alignItems: 'baseline', marginBottom: 6 }}>
        <h3>Busiest hours</h3>
        <small style={{ color: hoveredHour !== null ? 'var(--br)' : 'var(--mut)', fontWeight: hoveredHour !== null ? 600 : 400 }}>
          {activeLabel}
        </small>
      </div>

      <div className="bars" style={{ height: 90, gap: 4, marginBottom: 14, marginTop: 10 }}>
        {businessHours.map((h) => {
          const item = hourMap.get(h);
          const rev = item?.revenue ?? 0;
          const bills = item?.billCount ?? 0;
          const heightPct = Math.max(2, (rev / maxRevenue) * 100);
          const label = h % 2 !== 0 ? '' : `${h % 12 || 12}`;
          const isHovered = hoveredHour === h;

          return (
            <div
              key={h}
              style={{
                height: `${heightPct}%`,
                cursor: 'pointer',
                filter: isHovered ? 'brightness(1.2)' : undefined,
                transform: isHovered ? 'scaleY(1.05)' : undefined,
                transition: 'transform 0.15s, filter 0.15s',
              }}
              onMouseEnter={() => setHoveredHour(h)}
              onMouseLeave={() => setHoveredHour(null)}
              title={`${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}: ${fmt(rev)} (${bills} bills)`}
            >
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

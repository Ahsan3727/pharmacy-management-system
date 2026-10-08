import React from 'react';
import { RevenueSummary } from '../lib/revenueApi';
import { fmt } from '../lib/fmt';

interface RevenueKPIGridProps {
  summary: RevenueSummary;
  bestDay?: { date: string; revenue: number };
  isOwner: boolean;
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function RevenueKPIGrid({ summary, bestDay, isOwner }: RevenueKPIGridProps) {
  const {
    period,
    revenue,
    billCount,
    avgBillValue,
    cashCollected,
    cardCollected,
    udhaarGiven,
    udhaarRecovered,
    discountsGiven,
    voidedCount,
    voidedAmount,
    changePct,
    totalExpenses,
    grossProfit,
    grossMarginPct,
    netProfit,
    netMarginPct,
  } = summary;

  const totalCollected = cashCollected + cardCollected;
  const udhaarPct = revenue > 0 ? Math.round((udhaarGiven / revenue) * 100) : 0;
  const grossSales = revenue + discountsGiven;
  const discountPct = grossSales > 0 ? Math.round((discountsGiven / grossSales) * 100) : 0;
  const dailyAverage = period.days > 0 ? Math.round(revenue / period.days) : 0;
  const profitPerBill = billCount > 0 && grossProfit != null ? Math.round(grossProfit / billCount) : 0;

  return (
    <div className="kp">
      {/* 1. Revenue */}
      <div className="k s">
        <small>Revenue</small>
        <b>{fmt(revenue)}</b>
        <small>
          {changePct == null ? (
            'No earlier data to compare'
          ) : (
            <>
              <span className={`pill ${changePct < 0 ? 'er' : ''}`}>
                {changePct < 0 ? '▼' : '▲'} {Math.abs(changePct).toFixed(1)}%
              </span>{' '}
              vs previous {period.days} day{period.days > 1 ? 's' : ''}
            </>
          )}
        </small>
      </div>

      {/* 2. Bills */}
      <div className="k s">
        <small>Bills</small>
        <b>{billCount}</b>
        <small>Average {fmt(avgBillValue)}</small>
      </div>

      {/* 3. Gross Profit (Owner only) */}
      {isOwner && grossProfit != null && (
        <div className="k s">
          <small>Gross profit</small>
          <b>{fmt(grossProfit)}</b>
          <small>{grossMarginPct?.toFixed(1) ?? 0}% gross margin</small>
        </div>
      )}

      {/* 4. Net Profit (Owner only) */}
      {isOwner && netProfit != null && (
        <div className={`k s ${netProfit < 0 ? 'er' : ''}`}>
          <small>Net profit</small>
          <b>{fmt(netProfit)}</b>
          <small>After {fmt(totalExpenses)} expenses</small>
        </div>
      )}

      {/* 5. Profit per bill (Owner only) */}
      {isOwner && grossProfit != null && (
        <div className="k s">
          <small>Profit per bill</small>
          <b>{fmt(profitPerBill)}</b>
          <small>Gross profit ÷ bills</small>
        </div>
      )}

      {/* 6. Net margin (Owner only) */}
      {isOwner && netMarginPct != null && (
        <div className={`k s ${netProfit != null && netProfit < 0 ? 'er' : ''}`}>
          <small>Net margin</small>
          <b>{netMarginPct.toFixed(1)}%</b>
          <small>Net profit ÷ total sales</small>
        </div>
      )}

      {/* 7. Daily average */}
      <div className="k s">
        <small>Daily average</small>
        <b>{fmt(dailyAverage)}</b>
        <small>
          {bestDay && bestDay.revenue > 0
            ? `Best day ${formatShortDate(bestDay.date)} · ${fmt(bestDay.revenue)}`
            : revenue > 0
            ? 'Average per day'
            : 'No sales in this period'}
        </small>
      </div>

      {/* 8. Collected now */}
      <div className="k s">
        <small>Collected now</small>
        <b>{fmt(totalCollected)}</b>
        <small>Cash {fmt(cashCollected)} · Card {fmt(cardCollected)}</small>
      </div>

      {/* 9. Given on udhaar */}
      <div className={`k s ${udhaarGiven > 0 ? 'wn' : ''}`}>
        <small>Given on udhaar</small>
        <b>{fmt(udhaarGiven)}</b>
        <small>{udhaarPct}% of revenue</small>
      </div>

      {/* 10. Udhaar recovered */}
      <div className="k s">
        <small>Udhaar recovered</small>
        <b>{fmt(udhaarRecovered)}</b>
        <small>Payments received in this period</small>
      </div>

      {/* 11. Discounts given */}
      <div className="k s">
        <small>Discounts given</small>
        <b>{fmt(discountsGiven)}</b>
        <small>{discountPct}% of gross sales</small>
      </div>

      {/* 12. Voided bills */}
      <div className={`k s ${voidedCount > 0 ? 'er' : ''}`}>
        <small>Voided bills</small>
        <b>{voidedCount}</b>
        <small>{fmt(voidedAmount)} not counted</small>
      </div>
    </div>
  );
}

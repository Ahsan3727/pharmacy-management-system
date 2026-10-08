import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  fetchRevenueSummary,
  fetchDailyRevenue,
  fetchHourlyRevenue,
  fetchTopMedicines,
  fetchTopCustomers,
  fetchExpenses,
} from '../lib/revenueApi';
import { PeriodSelector } from '../components/PeriodSelector';
import { RevenueKPIGrid } from '../components/RevenueKPIGrid';
import { DailyChart } from '../components/DailyChart';
import { HourlyChart } from '../components/HourlyChart';
import { TopMedicinesTable } from '../components/TopMedicinesTable';
import { TopCustomersCard } from '../components/TopCustomersCard';
import { ExpensesSection } from '../components/ExpensesSection';
import { fmt } from '../lib/fmt';

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function RevenuePage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'owner';

  const today = getTodayIso();
  const defaultFrom = shiftIsoDate(today, -29);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);

  // Queries
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ['revenue', 'summary', from, to],
    queryFn: () => fetchRevenueSummary(from, to),
    staleTime: 60000,
  });

  const { data: daily = [] } = useQuery({
    queryKey: ['revenue', 'daily', from, to],
    queryFn: () => fetchDailyRevenue(from, to),
    staleTime: 60000,
  });

  const { data: hourly = [] } = useQuery({
    queryKey: ['revenue', 'hours', from, to],
    queryFn: () => fetchHourlyRevenue(from, to),
    staleTime: 60000,
  });

  const { data: medicines = [] } = useQuery({
    queryKey: ['revenue', 'medicines', from, to],
    queryFn: () => fetchTopMedicines(from, to),
    staleTime: 60000,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['revenue', 'customers', from, to],
    queryFn: () => fetchTopCustomers(from, to),
    staleTime: 60000,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', from, to],
    queryFn: () => fetchExpenses(from, to),
    enabled: isOwner,
    staleTime: 60000,
  });

  const handleExpenseMutated = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['revenue'] });
  };

  if (isSummaryLoading && !summary) {
    return (
      <div style={{ padding: 40, color: 'var(--mut)', textAlign: 'center' }}>
        Loading revenue reports…
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <div style={{ padding: 40, color: 'var(--er)' }}>
        Failed to load revenue data. Please check connection and try again.
      </div>
    );
  }

  // Find best day
  let bestDay: { date: string; revenue: number } | undefined;
  if (daily.length > 0) {
    const sortedDays = [...daily].sort((a, b) => b.revenue - a.revenue);
    bestDay = { date: sortedDays[0].date, revenue: sortedDays[0].revenue };
  }

  // Calculations for owner profit summary and payment bars
  const rev = summary.revenue || 0;
  const cost = summary.cost ?? 0;
  const grossProfit = summary.grossProfit ?? 0;
  const netProfit = summary.netProfit ?? 0;
  const expensesTotal = summary.totalExpenses || 0;
  const grossMarginPct = summary.grossMarginPct?.toFixed(1) ?? '0.0';
  const netMarginPct = summary.netMarginPct?.toFixed(1) ?? '0.0';

  const t100 = rev || 1;
  const costPer100 = (cost / t100) * 100;
  const expPer100 = (expensesTotal / t100) * 100;
  const netPer100 = (netProfit / t100) * 100;
  const ttSum = cost + expensesTotal + Math.max(0, netProfit) || 1;

  // Payment breakdown
  const cashPaid = summary.cashCollected;
  const cardPaid = summary.cardCollected;
  const udhaarGiven = summary.udhaarGiven;
  const payTotal = cashPaid + cardPaid + udhaarGiven || 1;
  const cashPct = Math.round((cashPaid / payTotal) * 100);
  const cardPct = Math.round((cardPaid / payTotal) * 100);
  const udhaarPct = Math.round((udhaarGiven / payTotal) * 100);

  return (
    <div className="dash rv" style={{ display: 'grid', gap: 14 }}>
      {/* Top Filter and Actions */}
      <PeriodSelector
        from={from}
        to={to}
        onRangeChange={(newFrom, newTo) => {
          setFrom(newFrom);
          setTo(newTo);
        }}
      />

      {/* 12 KPI Grid */}
      <RevenueKPIGrid
        summary={summary}
        bestDay={bestDay}
        isOwner={isOwner}
      />

      {/* Owner Profit Overview */}
      {isOwner && (
        <div className="two">
          <div className="card">
            <h3>Profit summary</h3>
            <div className="ln">
              <span>Total sales</span>
              <b>{fmt(rev)}</b>
            </div>
            <div className="ln">
              <span className="mut">− Cost of medicines sold</span>
              <b>{fmt(cost)}</b>
            </div>
            <div className="ln">
              <span>Gross profit</span>
              <b>{fmt(grossProfit)} · {grossMarginPct}%</b>
            </div>
            <div className="ln">
              <span className="mut">− Operating expenses</span>
              <b>{fmt(expensesTotal)}</b>
            </div>
            <hr style={{ borderTop: '1px solid var(--bd)', margin: '8px 0' }} />
            <div className="ln big">
              <span>Net profit</span>
              <b style={{ color: `var(--${netProfit < 0 ? 'er' : 'ok'})` }}>
                {fmt(netProfit)}
              </b>
            </div>
            <div className="ln big">
              <span>Net margin</span>
              <b style={{ color: `var(--${netProfit < 0 ? 'er' : 'ok'})` }}>
                {netMarginPct}%
              </b>
            </div>
          </div>

          <div className="card">
            <h3>Where every Rs 100 of sales goes</h3>
            <div className="sb" style={{ height: 14, margin: '14px 0 10px' }}>
              <i style={{ width: `${(cost / ttSum) * 100}%`, background: '#2a7fb8' }} />
              <i style={{ width: `${(expensesTotal / ttSum) * 100}%`, background: '#e8730c' }} />
              <i style={{ width: `${(Math.max(0, netProfit) / ttSum) * 100}%`, background: 'var(--br)' }} />
            </div>
            <div className="ln">
              <span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#2a7fb8',
                    marginRight: 6,
                  }}
                />
                Medicines
              </span>
              <b>Rs {costPer100.toFixed(1)}</b>
            </div>
            <div className="ln">
              <span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#e8730c',
                    marginRight: 6,
                  }}
                />
                Expenses
              </span>
              <b>Rs {expPer100.toFixed(1)}</b>
            </div>
            <div className="ln">
              <span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--br)',
                    marginRight: 6,
                  }}
                />
                {netProfit < 0 ? 'Net loss' : 'Net profit'}
              </span>
              <b>Rs {netPer100.toFixed(1)}</b>
            </div>
          </div>
        </div>
      )}

      {/* Daily Revenue Chart */}
      <DailyChart days={daily} isOwner={isOwner} />

      {/* How customers paid + Busiest hours */}
      <div className="two">
        <div className="card">
          <h3>How customers paid</h3>
          <div className="sb" style={{ margin: '14px 0 10px' }}>
            <i style={{ width: `${cashPct}%`, background: 'var(--br)' }} />
            <i style={{ width: `${cardPct}%`, background: '#2a7fb8' }} />
            <i style={{ width: `${udhaarPct}%`, background: '#e8730c' }} />
          </div>
          <div className="ln">
            <span>Cash</span>
            <b>{fmt(cashPaid)} · {cashPct}%</b>
          </div>
          <div className="ln">
            <span>Card</span>
            <b>{fmt(cardPaid)} · {cardPct}%</b>
          </div>
          <div className="ln">
            <span>Udhaar</span>
            <b>{fmt(udhaarGiven)} · {udhaarPct}%</b>
          </div>
        </div>

        <HourlyChart hours={hourly} />
      </div>

      {/* Top medicines + Top customers */}
      <div className="two">
        <TopMedicinesTable
          medicines={medicines}
          totalRevenue={rev}
          isOwner={isOwner}
        />
        <TopCustomersCard
          customers={customers}
          totalRevenue={rev}
        />
      </div>

      {/* Expenses (Owner only) */}
      {isOwner && (
        <ExpensesSection
          expenses={expenses}
          totalRevenue={rev}
          onExpenseMutated={handleExpenseMutated}
        />
      )}

      {/* Daily Breakdown collapsible table */}
      <details className="card tw" open={daily.length <= 14}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '4px 0' }}>
          Daily breakdown · {daily.length} day{daily.length > 1 ? 's' : ''}
        </summary>
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th className="r">Bills</th>
              <th className="r">Revenue</th>
              <th className="r">Cash</th>
              <th className="r">Card</th>
              <th className="r">Udhaar</th>
              <th className="r">Discount</th>
              {isOwner && <th className="r">Profit</th>}
            </tr>
          </thead>
          <tbody>
            <tr className="mh" style={{ fontWeight: 600 }}>
              <td><b>Total</b></td>
              <td className="r"><b>{summary.billCount}</b></td>
              <td className="r"><b>{fmt(summary.revenue)}</b></td>
              <td className="r">{fmt(summary.cashCollected)}</td>
              <td className="r">{fmt(summary.cardCollected)}</td>
              <td className="r">{fmt(summary.udhaarGiven)}</td>
              <td className="r">{fmt(summary.discountsGiven)}</td>
              {isOwner && <td className="r"><b>{fmt(summary.grossProfit ?? 0)}</b></td>}
            </tr>
            {[...daily].reverse().map((d) => (
              <tr key={d.date}>
                <td>{formatShortDate(d.date)}</td>
                <td className="r">{d.billCount}</td>
                <td className="r">{fmt(d.revenue)}</td>
                <td className="r">{fmt(d.cashPaid)}</td>
                <td className="r">{fmt(d.cardPaid)}</td>
                <td className="r">{fmt(d.credit)}</td>
                <td className="r">{fmt(d.discount)}</td>
                {isOwner && <td className="r">{d.profit != null ? fmt(d.profit) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

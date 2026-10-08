import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

export type PeriodKey = 'today' | '7' | '30' | 'mo' | 'cu';

interface PeriodSelectorProps {
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function PeriodSelector({ from, to, onRangeChange }: PeriodSelectorProps) {
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [isExporting, setIsExporting] = useState(false);

  const applyPeriod = (key: PeriodKey) => {
    setPeriod(key);
    const today = getTodayIso();
    let newFrom = today;
    let newTo = today;

    if (key === 'today') {
      newFrom = today;
      newTo = today;
    } else if (key === '7') {
      newFrom = shiftIsoDate(today, -6);
      newTo = today;
    } else if (key === '30') {
      newFrom = shiftIsoDate(today, -29);
      newTo = today;
    } else if (key === 'mo') {
      newFrom = today.slice(0, 8) + '01';
      newTo = today;
    } else if (key === 'cu') {
      newFrom = customFrom || shiftIsoDate(today, -29);
      newTo = customTo || today;
    }

    if (newFrom > newTo) {
      [newFrom, newTo] = [newTo, newFrom];
    }
    onRangeChange(newFrom, newTo);
  };

  const handleCustomChange = (f: string, t: string) => {
    setCustomFrom(f);
    setCustomTo(t);
    let validFrom = f;
    let validTo = t;
    if (validFrom > validTo) {
      [validFrom, validTo] = [validTo, validFrom];
    }
    onRangeChange(validFrom, validTo);
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const res = await api.get('/revenue/export.csv', {
        params: { from, to },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `revenue-${from}_${to}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('Could not export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="ln" style={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start', gap: 10 }}>
      {/* Period buttons */}
      <div className="seg" role="group" aria-label="Period">
        {(
          [
            ['today', 'Today'],
            ['7', '7 days'],
            ['30', '30 days'],
            ['mo', 'This month'],
            ['cu', 'Custom'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={period === key ? 'on' : ''}
            onClick={() => applyPeriod(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date display or custom inputs */}
      {period === 'cu' ? (
        <span className="ln" style={{ gap: 6, alignItems: 'center' }}>
          <input
            type="date"
            value={customFrom}
            max={getTodayIso()}
            onChange={(e) => handleCustomChange(e.target.value, customTo)}
            aria-label="From date"
            style={{ width: 'auto' }}
          />
          <span className="mut">–</span>
          <input
            type="date"
            value={customTo}
            max={getTodayIso()}
            onChange={(e) => handleCustomChange(customFrom, e.target.value)}
            aria-label="To date"
            style={{ width: 'auto' }}
          />
        </span>
      ) : (
        <span className="mut" style={{ fontSize: 13, fontWeight: 500 }}>
          {formatDisplayDate(from)} – {formatDisplayDate(to)}
        </span>
      )}

      <span style={{ flex: 1 }} />

      <button
        type="button"
        className="btn ghost"
        onClick={handleExportCsv}
        disabled={isExporting}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span>📥</span>
        {isExporting ? 'Exporting…' : 'Export CSV'}
      </button>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTodayClosing, fetchClosingHistory, createClosing, TodayClosingStatus, ClosingRecord } from '../lib/revenueApi';
import { fmt } from '../lib/fmt';

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function ClosingPage() {
  const queryClient = useQueryClient();

  const { data: status, isLoading: isStatusLoading } = useQuery<TodayClosingStatus>({
    queryKey: ['closing', 'today'],
    queryFn: fetchTodayClosing,
  });

  const { data: history = [], isLoading: isHistoryLoading } = useQuery<ClosingRecord[]>({
    queryKey: ['closing', 'history'],
    queryFn: () => fetchClosingHistory(30),
  });

  const [openingRupees, setOpeningRupees] = useState('');
  const [countedRupees, setCountedRupees] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cash note denominations calculator state
  const [showDenomCalc, setShowDenomCalc] = useState(false);
  const [denoms, setDenoms] = useState<Record<number, number>>({
    5000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
  });

  const handleDenomChange = (noteVal: number, countStr: string) => {
    const count = parseInt(countStr) || 0;
    const next = { ...denoms, [noteVal]: count };
    setDenoms(next);
    const sum = Object.entries(next).reduce((acc, [val, cnt]) => acc + Number(val) * cnt, 0);
    setCountedRupees(sum > 0 ? String(sum) : '');
  };

  // Initialize opening cash from API suggestion
  useEffect(() => {
    if (status) {
      const defaultRs = ((status.closing?.openingCash ?? status.defaultOpeningCash) / 100).toFixed(2);
      setOpeningRupees(defaultRs);
    }
  }, [status]);

  const closeMutation = useMutation({
    mutationFn: createClosing,
    onSuccess: () => {
      setSuccessMessage('Day closed successfully!');
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['closing'] });
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.error?.message ?? 'Failed to save closing');
    },
  });

  if (isStatusLoading || isHistoryLoading) {
    return <div style={{ padding: 40, color: 'var(--mut)', textAlign: 'center' }}>Loading day closing…</div>;
  }

  const openingPaisa = Math.round((parseFloat(openingRupees) || 0) * 100);
  const countedPaisa = Math.round((parseFloat(countedRupees) || 0) * 100);
  const cashSales = status?.cashSales ?? 0;
  const udhaarCash = status?.udhaarCashReceived ?? 0;
  const expectedPaisa = openingPaisa + cashSales + udhaarCash;
  const diffPaisa = countedPaisa - expectedPaisa;
  const hasCountedInput = countedRupees.trim() !== '';

  const handleSaveClosing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCountedInput) {
      setErrorMessage('Please enter the counted cash amount');
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);

    closeMutation.mutate({
      openingCash: openingPaisa,
      countedCash: countedPaisa,
      notes: notes.trim() || undefined,
    });
  };

  const renderDiffBadge = (diff: number) => {
    if (diff === 0) {
      return <span className="pill">Cash matches</span>;
    }
    if (diff < 0) {
      return <span className="pill er">Short {fmt(Math.abs(diff))}</span>;
    }
    return <span className="pill wn">Over {fmt(diff)}</span>;
  };

  return (
    <div className="dash" style={{ display: 'grid', gap: 14 }}>
      <div className="two">
        {/* Left card: Today's closing form or status */}
        <div className="card">
          <div className="ln" style={{ alignItems: 'center', marginBottom: 12 }}>
            <h3>Day Closing · {status?.date ? formatShortDate(status.date) : 'Today'}</h3>
            {status?.isClosed && <span className="pill">Closed</span>}
          </div>

          {status?.isClosed && status.closing ? (
            <div>
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: 'var(--okb)', color: 'var(--ok)' }}>
                ✓ Day was closed by <b>{status.closing.closedBy}</b>
              </div>

              <div className="ln">
                <span className="mut">Opening cash</span>
                <b>{fmt(status.closing.openingCash)}</b>
              </div>
              <div className="ln" style={{ marginTop: 6 }}>
                <span className="mut">Cash sales</span>
                <b>{fmt(status.closing.cashSales)}</b>
              </div>
              <div className="ln" style={{ marginTop: 6 }}>
                <span className="mut">Udhaar cash received</span>
                <b>{fmt(status.closing.udhaarCashReceived)}</b>
              </div>
              <div className="ln" style={{ marginTop: 6 }}>
                <span className="mut">Expected cash</span>
                <b>{fmt(status.closing.expectedCash)}</b>
              </div>
              <hr style={{ borderTop: '1px solid var(--bd)', margin: '10px 0' }} />
              <div className="ln big">
                <span>Counted cash</span>
                <b>{fmt(status.closing.countedCash)}</b>
              </div>
              <div className="ln" style={{ marginTop: 10, alignItems: 'center' }}>
                <span>Reconciliation result:</span>
                {renderDiffBadge(status.closing.difference)}
              </div>
              {status.closing.notes && (
                <div style={{ marginTop: 10, fontStyle: 'italic', color: 'var(--mut)' }}>
                  Note: {status.closing.notes}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveClosing}>
              <div className="f3">
                <label>
                  Opening cash (Rs)
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={openingRupees}
                    onChange={(e) => setOpeningRupees(e.target.value)}
                  />
                </label>
                <label>
                  Counted cash now (Rs)
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="Enter cash in drawer"
                    value={countedRupees}
                    onChange={(e) => setCountedRupees(e.target.value)}
                  />
                </label>
              </div>

              {/* Denomination counter toggle */}
              <div style={{ marginTop: 6, marginBottom: 8 }}>
                <button
                  type="button"
                  className="lk"
                  style={{ fontSize: 12.5 }}
                  onClick={() => setShowDenomCalc((prev) => !prev)}
                >
                  {showDenomCalc ? '▼ Hide note denomination counter' : '▶ Count by physical currency notes (Rs 5000, 1000, 500…)'}
                </button>
              </div>

              {showDenomCalc && (
                <div className="denom-grid">
                  {[5000, 1000, 500, 100, 50, 20, 10].map((noteVal) => (
                    <div key={noteVal} className="denom-cell">
                      <span>Rs {noteVal} notes:</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={denoms[noteVal] || ''}
                        onChange={(e) => handleDenomChange(noteVal, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="ln" style={{ marginTop: 10 }}>
                <span className="mut">Cash sales today</span>
                <b>{fmt(cashSales)}</b>
              </div>
              <div className="ln" style={{ marginTop: 6 }}>
                <span className="mut">Udhaar cash received today</span>
                <b>{fmt(udhaarCash)}</b>
              </div>
              <div className="ln" style={{ marginTop: 6 }}>
                <span className="mut">Total expected in drawer</span>
                <b>{fmt(expectedPaisa)}</b>
              </div>

              {hasCountedInput && (
                <div style={{ margin: '14px 0 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600 }}>Status:</span>
                  {renderDiffBadge(diffPaisa)}
                </div>
              )}

              <label style={{ marginTop: 10 }}>
                Closing note (optional)
                <input
                  type="text"
                  placeholder="e.g. Returned change to safe"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>

              {errorMessage && <p className="err" style={{ marginTop: 10 }}>{errorMessage}</p>}
              {successMessage && <p className="pill" style={{ marginTop: 10 }}>{successMessage}</p>}

              <button
                type="submit"
                className="btn big"
                style={{ width: '100%', marginTop: 14 }}
                disabled={closeMutation.isPending || !hasCountedInput}
              >
                {closeMutation.isPending ? 'Saving closing…' : 'Save day closing'}
              </button>
            </form>
          )}
        </div>

        {/* Right card: Previous closings */}
        <div className="card">
          <h3>Previous day closings</h3>
          {history.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((c) => (
                <div key={c._id} className="bi" style={{ paddingBottom: 8 }}>
                  <div className="ln" style={{ alignItems: 'center' }}>
                    <span>
                      <b>{formatShortDate(c.date)}</b>
                      <small style={{ color: 'var(--mut)' }}>Closed by {c.closedBy}</small>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <b>{fmt(c.countedCash)}</b>
                      <div style={{ marginTop: 2 }}>{renderDiffBadge(c.difference)}</div>
                    </span>
                  </div>
                  {c.notes && (
                    <small style={{ fontStyle: 'italic', marginTop: 2 }}>
                      {c.notes}
                    </small>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mut">No previous closings recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

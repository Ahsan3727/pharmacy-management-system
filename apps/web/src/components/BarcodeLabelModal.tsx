import React, { useState } from 'react';
import { Modal, ModalHeader } from './Modal';
import { fmt, fmtMmYy } from '../lib/fmt';

export interface BarcodeLabelData {
  medicineName: string;
  strength?: string;
  genericName?: string;
  batchNo?: string;
  expiryDate?: string;
  pricePerPack?: number; // in paisa
  rack?: string;
  barcode?: string;
  company?: string;
}

interface BarcodeLabelModalProps {
  open: boolean;
  onClose: () => void;
  item: BarcodeLabelData | null;
}

export function BarcodeLabelModal({ open, onClose, item }: BarcodeLabelModalProps) {
  const [labelSize, setLabelSize] = useState<'38x25' | '50x25'>('50x25');
  const [printCount, setPrintCount] = useState<number>(1);
  const [showPrice, setShowPrice] = useState(true);
  const [showExpiry, setShowExpiry] = useState(true);

  if (!item) return null;

  const barcodeValue = item.barcode || item.batchNo || 'MED1001';
  const widthMm = labelSize === '50x25' ? 50 : 38;
  const heightMm = 25;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (!printWindow) return;

    const labelsHtml = Array.from({ length: printCount })
      .map(
        () => `
      <div class="label-sheet">
        <div class="label-header">
          <span class="shop-name">HS PHARMA</span>
          ${item.rack ? `<span class="rack-tag">RACK ${item.rack}</span>` : ''}
        </div>
        <div class="med-name">${item.medicineName}${item.strength ? ` ${item.strength}` : ''}</div>
        ${item.genericName ? `<div class="generic-name">${item.genericName}</div>` : ''}
        
        <div class="barcode-container">
          <svg class="barcode-svg" jsbarcode-value="${barcodeValue}"></svg>
          <div class="barcode-text">${barcodeValue}</div>
        </div>

        <div class="label-footer">
          ${showExpiry && item.batchNo ? `<span>B:${item.batchNo} ${item.expiryDate ? 'EXP:' + fmtMmYy(item.expiryDate) : ''}</span>` : ''}
          ${showPrice && item.pricePerPack ? `<span class="price-tag">Rs ${(item.pricePerPack / 100).toFixed(0)}</span>` : ''}
        </div>
      </div>
    `
      )
      .join('');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Print Labels - ${item.medicineName}</title>
  <style>
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background: #fff;
      color: #000;
    }
    .label-sheet {
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      padding: 1.5mm 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      overflow: hidden;
      border: 1px dashed #ccc;
    }
    @media print {
      .label-sheet {
        border: none;
      }
    }
    .label-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.5pt;
      font-weight: 700;
      border-bottom: 0.5px solid #000;
      padding-bottom: 0.5mm;
    }
    .shop-name {
      letter-spacing: 0.5px;
    }
    .rack-tag {
      background: #000;
      color: #fff;
      padding: 0 1.5mm;
      border-radius: 1mm;
      font-size: 5.5pt;
    }
    .med-name {
      font-size: ${labelSize === '50x25' ? '8.5pt' : '7.5pt'};
      font-weight: 800;
      line-height: 1.1;
      margin-top: 0.5mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .generic-name {
      font-size: 5.5pt;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .barcode-container {
      text-align: center;
      margin: 0.5mm 0;
    }
    .barcode-bars {
      display: flex;
      justify-content: center;
      height: 7mm;
      gap: 1px;
    }
    .barcode-text {
      font-size: 6pt;
      font-family: monospace;
      letter-spacing: 1px;
      font-weight: 600;
      margin-top: 0.3mm;
    }
    .label-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6pt;
      font-weight: 700;
      border-top: 0.5px solid #000;
      padding-top: 0.5mm;
    }
    .price-tag {
      font-size: 7.5pt;
      font-weight: 900;
    }
  </style>
</head>
<body>
  ${labelsHtml}
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={520}>
      <ModalHeader title="🏷️ Thermal Barcode Label Generator" onClose={onClose} />

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Label Size and Count Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--mut)', display: 'block', marginBottom: 6 }}>
              Label Dimension
            </label>
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value as any)}
              style={{ width: '100%', borderRadius: 8 }}
            >
              <option value="50x25">50mm × 25mm (Standard Shelf / Box)</option>
              <option value="38x25">38mm × 25mm (Vial / Strip Label)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--mut)', display: 'block', marginBottom: 6 }}>
              Number of Copies
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={printCount}
              onChange={(e) => setPrintCount(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '100%', borderRadius: 8 }}
            />
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
            />
            Include MRP / Retail Price
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showExpiry}
              onChange={(e) => setShowExpiry(e.target.checked)}
            />
            Include Batch & Expiry
          </label>
        </div>

        {/* Realistic Label Preview Simulation */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--mut)', display: 'block', marginBottom: 6 }}>
            Thermal Print Preview ({labelSize} roll)
          </label>
          <div
            style={{
              background: '#f8fafc',
              border: '2px dashed #cbd5e1',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* The actual label badge */}
            <div
              style={{
                width: labelSize === '50x25' ? 240 : 190,
                height: 120,
                background: '#ffffff',
                border: '1px solid #111',
                borderRadius: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                padding: '6px 10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: '#111',
                boxSizing: 'border-box',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #111', paddingBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>HS PHARMA</span>
                {item.rack && (
                  <span style={{ background: '#111', color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 2 }}>
                    RACK {item.rack}
                  </span>
                )}
              </div>

              {/* Drug title */}
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.medicineName}{item.strength ? ` ${item.strength}` : ''}
                </div>
                {item.genericName && (
                  <div style={{ fontSize: 8.5, color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.genericName}
                  </div>
                )}
              </div>

              {/* Barcode graphic emulation */}
              <div style={{ textAlign: 'center', margin: '2px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', height: 22, alignItems: 'stretch', gap: 1 }}>
                  {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2].map((w, i) => (
                    <div
                      key={i}
                      style={{
                        width: w,
                        background: i % 2 === 0 ? '#000' : 'transparent',
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 8, fontFamily: 'monospace', letterSpacing: 1, fontWeight: 700 }}>
                  {barcodeValue}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #111', paddingTop: 2, fontSize: 8.5, fontWeight: 700 }}>
                {showExpiry && (
                  <span>
                    B:{item.batchNo || '–'} {item.expiryDate ? `EXP:${fmtMmYy(item.expiryDate)}` : ''}
                  </span>
                )}
                {showPrice && item.pricePerPack && (
                  <span style={{ fontSize: 11, fontWeight: 900 }}>
                    {fmt(item.pricePerPack)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn"
            onClick={handlePrint}
            style={{
              background: '#0284c7',
              borderColor: '#0284c7',
              color: '#fff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🖨️</span> Print {printCount} {printCount === 1 ? 'Label' : 'Labels'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

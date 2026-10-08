import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

export interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions' | 'Medicines';
  title: string;
  subtitle?: string;
  icon: string;
  badge?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screenId: string) => void;
  userRole?: string;
}

export function CommandPalette({ isOpen, onClose, onNavigate, userRole }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [medicineResults, setMedicineResults] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search medicines when query is typed
  useEffect(() => {
    if (!query.trim()) {
      setMedicineResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/medicines', { params: { search: query, limit: 5 } });
        setMedicineResults(res.data.data?.medicines ?? res.data.data ?? []);
      } catch {
        setMedicineResults([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Core navigation items
  const navItems: CommandItem[] = [
    {
      id: 'billing',
      category: 'Navigation',
      title: 'POS Billing Cockpit',
      subtitle: 'Create new sale invoice, scan barcodes',
      icon: '🏥',
      badge: 'F2',
      onSelect: () => onNavigate('billing'),
    },
    {
      id: 'sales',
      category: 'Navigation',
      title: 'Sales & Receipts',
      subtitle: 'View recent invoices, reprint receipts',
      icon: '🧾',
      onSelect: () => onNavigate('sales'),
    },
    {
      id: 'revenue',
      category: 'Navigation',
      title: 'Revenue & Analytics',
      subtitle: 'KPIs, profit breakdown, daily & hourly trends',
      icon: '📈',
      badge: userRole === 'owner' ? 'Owner' : undefined,
      onSelect: () => onNavigate('revenue'),
    },
    {
      id: 'closing',
      category: 'Navigation',
      title: 'Day Closing & Register Reconciliation',
      subtitle: 'Count cash drawer, balance variances',
      icon: '🔒',
      onSelect: () => onNavigate('closing'),
    },
    {
      id: 'stock',
      category: 'Navigation',
      title: 'Stock & Inventory',
      subtitle: 'Expiry tracking, shelf racks, stock levels',
      icon: '📦',
      onSelect: () => onNavigate('stock'),
    },
    {
      id: 'medicines',
      category: 'Navigation',
      title: 'Medicine Master Catalog',
      subtitle: 'Formulations, pack sizes, salts, barcodes',
      icon: '💊',
      onSelect: () => onNavigate('medicines'),
    },
    {
      id: 'purchases',
      category: 'Navigation',
      title: 'Purchases & Supplier Invoices',
      subtitle: 'Stock intake, supplier balances',
      icon: '🛒',
      onSelect: () => onNavigate('purchases'),
    },
    {
      id: 'customers',
      category: 'Navigation',
      title: 'Customers & Udhaar Ledgers',
      subtitle: 'Credit accounts, receive payments',
      icon: '👤',
      onSelect: () => onNavigate('customers'),
    },
    {
      id: 'dashboard',
      category: 'Navigation',
      title: 'Executive Dashboard',
      subtitle: 'High-level pharmacy overview',
      icon: '📊',
      onSelect: () => onNavigate('dashboard'),
    },
  ];

  // Action items
  const actionItems: CommandItem[] = [
    {
      id: 'act-new-bill',
      category: 'Actions',
      title: 'Start New Invoice',
      subtitle: 'Switch to billing screen ready for barcode scan',
      icon: '⚡',
      badge: 'F2',
      onSelect: () => onNavigate('billing'),
    },
    {
      id: 'act-close-drawer',
      category: 'Actions',
      title: 'Close Cash Drawer Today',
      subtitle: 'Open the shift reconciliation panel',
      icon: '💰',
      onSelect: () => onNavigate('closing'),
    },
  ];

  // Medicine search items
  const medicineItems: CommandItem[] = medicineResults.map((m: any) => ({
    id: `med-${m._id}`,
    category: 'Medicines',
    title: `${m.name} ${m.strength ?? ''}`.trim(),
    subtitle: `${m.genericName ?? ''} · Rack: ${m.rack || '—'} · Pack: ${m.packSize} ${m.looseUnit}`,
    icon: '💊',
    badge: m.isControlled ? 'Controlled' : undefined,
    onSelect: () => {
      onNavigate('medicines');
    },
  }));

  // Filter based on query
  const q = query.toLowerCase().trim();
  const filteredNav = navItems.filter(
    (item) => item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q)
  );
  const filteredActions = actionItems.filter(
    (item) => item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q)
  );

  const allFiltered: CommandItem[] = [...filteredActions, ...filteredNav, ...medicineItems];

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, allFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allFiltered[selectedIndex]) {
        allFiltered[selectedIndex].onSelect();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="cmd-palette-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div className="cmd-palette-modal" onClick={(e) => e.stopPropagation()}>
        {/* Search input header */}
        <div className="cmd-palette-header">
          <span style={{ fontSize: 18, color: 'var(--mut)', paddingLeft: 6 }}>🔍</span>
          <input
            ref={inputRef}
            className="cmd-palette-input"
            placeholder="Type a command, search medicines, or jump to screen... (Esc to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd style={{ fontSize: 11, padding: '2px 6px' }}>Esc</kbd>
        </div>

        {/* Results list */}
        <div className="cmd-palette-list">
          {allFiltered.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>
              No commands or medicines match "{query}"
            </div>
          ) : (
            allFiltered.map((item, idx) => (
              <div
                key={item.id}
                className={`cmd-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="cmd-palette-icon">{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div style={{ fontSize: 11.5, color: 'var(--mut)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                {item.badge && <span className="pill">{item.badge}</span>}
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="cmd-palette-footer">
          <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
          <span><kbd>Enter</kbd> to select</span>
          <span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BillingPage } from './pages/BillingPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { CustomersPage } from './pages/CustomersPage';
import { StockPage } from './pages/StockPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { RevenuePage } from './pages/RevenuePage';
import { ClosingPage } from './pages/ClosingPage';
import { CommandPalette } from './components/CommandPalette';
import { sounds } from './lib/sound';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';

type Screen =
  | 'dashboard'
  | 'billing'
  | 'sales'
  | 'revenue'
  | 'closing'
  | 'medicines'
  | 'purchases'
  | 'customers'
  | 'stock';

const NAV_ITEMS: Array<{ id: Screen; icon: string; label: string; roles: Array<'owner' | 'manager' | 'cashier'> }> = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', roles: ['owner', 'manager', 'cashier'] },
  { id: 'billing', icon: '🏥', label: 'POS Billing', roles: ['owner', 'manager', 'cashier'] },
  { id: 'sales', icon: '🧾', label: 'Sales', roles: ['owner', 'manager', 'cashier'] },
  { id: 'revenue', icon: '📈', label: 'Revenue', roles: ['owner', 'manager'] },
  { id: 'closing', icon: '🔒', label: 'Day Closing', roles: ['owner', 'manager'] },
  { id: 'medicines', icon: '💊', label: 'Medicines', roles: ['owner', 'manager'] },
  { id: 'purchases', icon: '🛒', label: 'Purchases', roles: ['owner', 'manager'] },
  { id: 'customers', icon: '👤', label: 'Customers', roles: ['owner', 'manager', 'cashier'] },
  { id: 'stock', icon: '📦', label: 'Stock', roles: ['owner', 'manager'] },
];

function AlertChips() {
  const { data: lowStock } = useQuery({
    queryKey: ['stock', 'low'],
    queryFn: async () => (await api.get('/stock/low')).data.data,
    staleTime: 60000,
  });
  const { data: nearExpiry } = useQuery({
    queryKey: ['stock', 'near-expiry'],
    queryFn: async () => (await api.get('/stock/near-expiry')).data.data,
    staleTime: 60000,
  });

  return (
    <div className="chips">
      {(nearExpiry?.length ?? 0) > 0 && (
        <button className="alert-chip wn">⚠ {nearExpiry?.length} expiring</button>
      )}
      {(lowStock?.length ?? 0) > 0 && (
        <button className="alert-chip er">📉 {lowStock?.length} low stock</button>
      )}
    </div>
  );
}

function AppShell() {
  const [screen, setScreen] = useState<Screen>('billing');
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => sounds.isEnabled());
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('hs_sidebar_collapsed') === 'true');
  const { user, logout } = useAuthStore();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data.data,
    staleTime: 300000,
  });

  const { data: drawerClosing } = useQuery({
    queryKey: ['closing', 'today'],
    queryFn: async () => (await api.get('/closing/today')).data.data,
    enabled: user?.role === 'owner' || user?.role === 'manager',
    staleTime: 60000,
  });

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('hs_sidebar_collapsed', String(next));
      return next;
    });
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    sounds.setEnabled(next);
    setSoundEnabled(next);
    if (next) sounds.scan();
  };

  const navItems = NAV_ITEMS.filter((n) => user?.role && n.roles.includes(user.role));

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard': return <DashboardPage />;
      case 'billing': return <BillingPage />;
      case 'sales': return <SalesHistoryPage />;
      case 'revenue': return <RevenuePage />;
      case 'closing': return <ClosingPage />;
      case 'medicines': return <MedicinesPage />;
      case 'purchases': return <PurchasesPage />;
      case 'customers': return <CustomersPage />;
      case 'stock': return <StockPage />;
    }
  };

  return (
    <div className={`app ${isCollapsed ? 'collapsed-sidebar' : ''}`}>
      {/* Top bar */}
      <header className="top">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => setScreen('dashboard')}>
          <div className="logo-mark">💊</div>
          <span>{settings?.shopName ?? 'HS Pharma'}</span>
        </div>

        <div className="shop-addr">{settings?.address}</div>

        {/* Global Search / Command Palette Trigger */}
        <button
          type="button"
          className="search-trigger-btn"
          onClick={() => setIsCmdOpen(true)}
          title="Search medicines or jump to screen (Ctrl+K)"
        >
          <span>🔍</span>
          <span>Search or jump...</span>
          <kbd style={{ fontSize: 10, padding: '1px 5px', background: 'rgba(255,255,255,0.18)', border: '0', color: '#fff' }}>
            Ctrl+K
          </kbd>
        </button>

        <div className="spacer" />

        {/* Live Drawer Cash Indicator (Manager / Owner) */}
        {drawerClosing && (
          <div
            className="alert-chip"
            style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', cursor: 'pointer' }}
            onClick={() => setScreen('closing')}
            title="Click to view today's shift cash drawer"
          >
            💰 Drawer: Rs {(drawerClosing.cashSales / 100).toLocaleString('en-IN')}
          </div>
        )}

        <AlertChips />

        {/* Sound FX toggle */}
        <button
          type="button"
          onClick={toggleSound}
          style={{ background: 'none', border: 0, color: soundEnabled ? '#64dbab' : '#888', cursor: 'pointer', fontSize: 15 }}
          title={soundEnabled ? 'Scanner Audio Feedback Enabled' : 'Audio Muted'}
          aria-label="Toggle scanner audio feedback"
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>

        {/* User Role Badge */}
        <div className="role-select">
          <span>{user?.name}</span>
          <span className="pill">{user?.role}</span>
          <button className="lk" style={{ marginLeft: 6, color: '#b9d8cc', fontSize: 12 }} onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {/* Sidebar / bottom nav */}
      <nav className="nav" aria-label="Main navigation">
        {/* Sidebar collapse button (desktop) */}
        <button
          type="button"
          className="nav-toggle-btn ro"
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span>{isCollapsed ? '▶' : '◀'}</span>
          <span className="nav-label">{isCollapsed ? '' : 'Collapse'}</span>
        </button>

        {navItems.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={screen === item.id ? 'on' : ''}
            onClick={() => setScreen(item.id)}
            aria-current={screen === item.id ? 'page' : undefined}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}

        {/* Logout at bottom of sidebar (desktop only) */}
        <button
          onClick={logout}
          style={{ marginTop: 'auto' }}
          className="ro"
          title="Logout"
        >
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Logout</span>
        </button>
      </nav>

      {/* Main content */}
      <main className="main in" key={screen}>
        <Suspense fallback={<div style={{ padding: 40, color: 'var(--mut)' }}>Loading…</div>}>
          {renderScreen()}
        </Suspense>
      </main>

      {/* Keyboard shortcuts footer (desktop only) */}
      <footer className="fkb">
        <div className="fk">
          <span><kbd>F2</kbd>Search medicine</span>
          <span><kbd>Ctrl+K</kbd>Command palette</span>
          <span><kbd>F8 / F9</kbd>Commit sale</span>
          <span><kbd>Esc</kbd>Close modal</span>
        </div>
      </footer>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCmdOpen}
        onClose={() => setIsCmdOpen(false)}
        onNavigate={(screenId) => {
          setScreen(screenId as Screen);
          setIsCmdOpen(false);
        }}
        userRole={user?.role}
      />
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated()) return <LoginPage />;
  return <AppShell />;
}

import React, { useState, Suspense } from 'react';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BillingPage } from './pages/BillingPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { CustomersPage } from './pages/CustomersPage';
import { StockPage } from './pages/StockPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';

type Screen =
  | 'dashboard'
  | 'billing'
  | 'medicines'
  | 'purchases'
  | 'customers'
  | 'stock'
  | 'sales';

const NAV_ITEMS: Array<{ id: Screen; icon: string; label: string; roles: Array<'owner' | 'manager' | 'cashier'> }> = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', roles: ['owner', 'manager', 'cashier'] },
  { id: 'billing', icon: '🏥', label: 'POS Billing', roles: ['owner', 'manager', 'cashier'] },
  { id: 'sales', icon: '🧾', label: 'Sales', roles: ['owner', 'manager', 'cashier'] },
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
  const { user, logout } = useAuthStore();
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data.data,
    staleTime: 300000,
  });

  const navItems = NAV_ITEMS.filter((n) => user?.role && n.roles.includes(user.role));

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard': return <DashboardPage />;
      case 'billing': return <BillingPage />;
      case 'medicines': return <MedicinesPage />;
      case 'purchases': return <PurchasesPage />;
      case 'customers': return <CustomersPage />;
      case 'stock': return <StockPage />;
      case 'sales': return <SalesHistoryPage />;
    }
  };

  return (
    <div className="app">
      {/* Top bar */}
      <header className="top">
        <div className="logo">
          <div className="logo-mark">💊</div>
          {settings?.shopName ?? 'HS Pharma'}
        </div>
        <div className="shop-addr">{settings?.address}</div>
        <div className="spacer" />
        <AlertChips />
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
        {navItems.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={screen === item.id ? 'on' : ''}
            onClick={() => setScreen(item.id)}
            aria-current={screen === item.id ? 'page' : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}

        {/* Logout at bottom of sidebar (desktop only) */}
        <button
          onClick={logout}
          style={{ marginTop: 'auto' }}
          className="ro"
        >
          <span className="nav-icon">🚪</span>
          Logout
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
          <span><kbd>F9</kbd>Commit sale</span>
          <span><kbd>Esc</kbd>Close modal</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated()) return <LoginPage />;
  return <AppShell />;
}

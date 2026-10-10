import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
import { NarcoticsPage } from './pages/NarcoticsPage';
import { CommandPalette } from './components/CommandPalette';
import { Modal, ModalHeader } from './components/Modal';
import { sounds } from './lib/sound';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  roles: Array<'owner' | 'manager' | 'cashier'>;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Sell',
    items: [
      { path: '/billing', icon: '🏥', label: 'POS Billing', roles: ['owner', 'manager', 'cashier'] },
      { path: '/sales', icon: '🧾', label: 'Sales History', roles: ['owner', 'manager', 'cashier'] },
    ],
  },
  {
    section: 'Stock',
    items: [
      { path: '/stock', icon: '📦', label: 'Stock & Batches', roles: ['owner', 'manager'] },
      { path: '/medicines', icon: '💊', label: 'Medicine Catalog', roles: ['owner', 'manager'] },
    ],
  },
  {
    section: 'People',
    items: [
      { path: '/customers', icon: '👤', label: 'Customers & Udhaar', roles: ['owner', 'manager', 'cashier'] },
      { path: '/purchases', icon: '🛒', label: 'Purchases & Inward', roles: ['owner', 'manager'] },
    ],
  },
  {
    section: 'Money',
    items: [
      { path: '/revenue', icon: '📈', label: 'Revenue & Profit', roles: ['owner', 'manager'] },
      { path: '/closing', icon: '🔒', label: 'Day Closing', roles: ['owner', 'manager'] },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { path: '/narcotics', icon: '📋', label: 'Form-9 Narcotics', roles: ['owner', 'manager'] },
      { path: '/dashboard', icon: '📊', label: 'Dashboard', roles: ['owner', 'manager', 'cashier'] },
    ],
  },
];

function AlertChips() {
  const navigate = useNavigate();
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
        <button
          className="alert-chip wn"
          onClick={() => navigate('/stock')}
          title="Click to view expiring batches"
        >
          ⚠ {nearExpiry?.length} expiring
        </button>
      )}
      {(lowStock?.length ?? 0) > 0 && (
        <button
          className="alert-chip er"
          onClick={() => navigate('/stock')}
          title="Click to view low stock medicines"
        >
          📉 {lowStock?.length} low stock
        </button>
      )}
    </div>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
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

  // Filter groups and items based on role
  const userRole = user?.role ?? 'cashier';
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(userRole)),
  })).filter((group) => group.items.length > 0);

  const currentPath = location.pathname;

  return (
    <div className={`app ${isCollapsed ? 'collapsed-sidebar' : ''}`}>
      {/* Top Header Bar */}
      <header className="top">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
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
            onClick={() => navigate('/closing')}
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

        {/* User Role Badge & Logout */}
        <div className="role-select">
          <span>{user?.name}</span>
          <span className="pill">{user?.role}</span>
          <button className="lk" style={{ marginLeft: 6, color: '#b9d8cc', fontSize: 12 }} onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {/* Grouped Navigation Rail for Desktop */}
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

        {visibleGroups.map((group) => (
          <React.Fragment key={group.section}>
            <div className="nav-section-title ro">{group.section}</div>
            {group.items.map((item) => (
              <button
                key={item.path}
                id={`nav-${item.path.slice(1)}`}
                className={currentPath === item.path ? 'on' : ''}
                onClick={() => navigate(item.path)}
                aria-current={currentPath === item.path ? 'page' : undefined}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </React.Fragment>
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

      {/* Main Routed Content Area */}
      <main className="main in" key={currentPath}>
        <Suspense fallback={<div style={{ padding: 40, color: 'var(--mut)' }}>Loading view…</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/billing" replace />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/sales" element={<SalesHistoryPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/medicines" element={<MedicinesPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/revenue" element={<RevenuePage />} />
            <Route path="/closing" element={<ClosingPage />} />
            <Route path="/narcotics" element={<NarcoticsPage />} />
            <Route path="*" element={<Navigate to="/billing" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Keyboard shortcuts footer (desktop only) */}
      <footer className="fkb">
        <div className="fk">
          <span><kbd>F2</kbd>Search medicine</span>
          <span><kbd>Ctrl+K</kbd>Command palette</span>
          <span><kbd>F9</kbd>Commit sale</span>
          <span><kbd>Esc</kbd>Close modal</span>
        </div>
      </footer>

      {/* Mobile 5-Slot Bottom Tab Bar */}
      <nav className="mobile-bottom-bar" aria-label="Mobile Bottom Navigation">
        <button
          type="button"
          className={currentPath === '/billing' ? 'on' : ''}
          onClick={() => navigate('/billing')}
        >
          <span className="bar-icon">🏥</span>
          <span>POS</span>
        </button>
        <button
          type="button"
          className={currentPath === '/sales' ? 'on' : ''}
          onClick={() => navigate('/sales')}
        >
          <span className="bar-icon">🧾</span>
          <span>Sales</span>
        </button>
        <button
          type="button"
          className={currentPath === '/stock' ? 'on' : ''}
          onClick={() => navigate('/stock')}
        >
          <span className="bar-icon">📦</span>
          <span>Stock</span>
        </button>
        <button
          type="button"
          className={currentPath === '/dashboard' ? 'on' : ''}
          onClick={() => navigate('/dashboard')}
        >
          <span className="bar-icon">📊</span>
          <span>Dash</span>
        </button>
        <button
          type="button"
          className={moreDrawerOpen ? 'on' : ''}
          onClick={() => setMoreDrawerOpen(true)}
        >
          <span className="bar-icon">☰</span>
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More Navigation Drawer Modal */}
      {moreDrawerOpen && (
        <Modal open={moreDrawerOpen} onClose={() => setMoreDrawerOpen(false)} maxWidth={380}>
          <ModalHeader title="All Pharmacy Modules" onClose={() => setMoreDrawerOpen(false)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '10px 0' }}>
            {visibleGroups.flatMap((g) => g.items).map((item) => (
              <button
                key={item.path}
                type="button"
                className="btn btn-ghost"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 10px', height: 'auto', textAlign: 'center',
                  background: currentPath === item.path ? 'var(--leaf-light)' : 'var(--sf)'
                }}
                onClick={() => {
                  navigate(item.path);
                  setMoreDrawerOpen(false);
                }}
              >
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCmdOpen}
        onClose={() => setIsCmdOpen(false)}
        onNavigate={(screenId) => {
          const path = screenId.startsWith('/') ? screenId : `/${screenId}`;
          navigate(path);
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


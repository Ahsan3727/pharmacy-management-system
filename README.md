# HS Pharma — Pharmacy Management System

A complete, production-ready pharmacy management system built with:
- **Backend**: Node.js, Express, TypeScript, Mongoose (MongoDB)
- **Frontend**: React 18, Vite, TanStack Query, Zustand
- **Database**: MongoDB with Replica Set (for transactions)
- **PWA**: Works offline, camera barcode scanning

## 📁 Project Structure

```
pharmacysoftware/
├── apps/
│   ├── api/          ← Express backend (port 4000)
│   └── web/          ← React frontend (port 5173)
├── packages/
│   └── shared/       ← Shared TypeScript types & Zod schemas
├── infra/
│   ├── docker-compose.dev.yml   ← MongoDB dev server
│   ├── docker-compose.yml       ← Production
│   └── Caddyfile                ← HTTPS reverse proxy
├── .env              ← Environment variables
└── pnpm-workspace.yaml
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+, pnpm, Docker Desktop

### 1. Start MongoDB (Dev)
```bash
cd infra
docker compose -f docker-compose.dev.yml up -d
```

### 2. Install dependencies (already done)
```bash
pnpm install
```

### 3. Seed the owner user
```bash
cd apps/api
pnpm run seed:owner
```
Default credentials: **owner / owner123** ← Change immediately!

### 4. Start development servers
```bash
# From root — starts both API (port 4000) and web (port 5173)
pnpm dev
```

Open http://localhost:5173

## 🔑 Default Login

| Username | Password | Role |
|----------|----------|------|
| owner | owner123 | Owner |

## 🏗 Screens

| Screen | Description |
|--------|-------------|
| 📊 Dashboard | Today's sales, low stock & expiry alerts |
| 🏥 POS Billing | Fast medicine search, cart, payment modes |
| 🧾 Sales | History, reprint thermal receipt, void |
| 💊 Medicines | Master list, add/edit medicines |
| 🛒 Purchases | Entry with batch-level pricing & bonus packs |
| 👤 Customers | Udhaar ledger, payment recording |
| 📦 Stock | Near-expiry, low stock, expired write-off |

## 💡 Business Logic

- **FEFO**: First Expiry First Out — oldest batches sold first automatically
- **All money in paisa** (integers, never floats): Rs 100 = 10000 paisa
- **Stock is append-only**: every change writes a movement record
- **Idempotent sales**: duplicate `clientRequestId` returns the same bill
- **Atomic transactions**: sale = FEFO alloc + stock deduct + invoice + ledger (all or nothing)

## 🖨 Thermal Printing

Visit `/api/v1/sales/:id/print` for an 80mm thermal receipt.
Click Print in browser → send to any receipt printer.

## 🔐 Roles

| Role | Can Do |
|------|--------|
| Owner | Everything + void bills, see costs/profits |
| Manager | Add medicines/purchases, max 15% discount |
| Cashier | Billing only, max 5% discount |

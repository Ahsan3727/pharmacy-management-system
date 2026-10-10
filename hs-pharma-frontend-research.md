# HS Pharma — Frontend Research Report

| | |
|---|---|
| **Repository** | `Ahsan3727/pharmacy-management-system` |
| **Scope** | `apps/web` (frontend), with the API and shared package read only where they affect the frontend |
| **Method** | Graph index (Graphify) queries: file ranking, symbol lookup, import/call graphs, body expansion |
| **Indexed commit** | `d3181ba` (default branch `master`) |
| **Index size** | 681 nodes, 1,601 edges, 33 communities |

**Evidence labels used in this report**

- **Verified**: seen directly in code returned by the index.
- **Inferred**: a reasonable conclusion from verified code, but not confirmed end to end.
- **Unconfirmed**: could not be checked with the index.

---

## Contents

1. [Executive summary](#1-executive-summary)
2. [Tech stack](#2-tech-stack)
3. [Project structure](#3-project-structure)
4. [Architecture](#4-architecture)
5. [Screens](#5-screens)
6. [Shared components and utilities](#6-shared-components-and-utilities)
7. [Frontend-to-API map](#7-frontend-to-api-map)
8. [Findings](#8-findings)
9. [Dependency audit](#9-dependency-audit)
10. [Recommended next steps](#10-recommended-next-steps)
11. [Limits of this research](#11-limits-of-this-research)

---

## 1. Executive summary

The frontend is a **single-page point-of-sale and inventory app** for a pharmacy, built with React 18, TypeScript and Vite. It lives in a monorepo next to an Express API and a shared package of Zod schemas and money helpers.

The domain is Pakistani retail pharmacy: amounts in Rs stored as integer paisa, **udhaar** (customer credit) ledgers, FEFO expiry handling, cycle-count audits, and a **DRAP Form-9** controlled-drug register.

**Strengths**

- Clear role model (`owner`, `manager`, `cashier`) reflected in navigation and queries.
- Sound server-state handling: TanStack Query with shared keys and a refresh-token interceptor that queues concurrent 401s.
- Money handled as integers throughout.
- POS ergonomics: F2 search, F9 commit, Ctrl/Cmd+K command palette, scanner sound feedback.

**Main concerns**

1. Print views likely fail authentication (Inferred).
2. The web app does not use the shared package, so money logic and constants are duplicated (Verified).
3. The duplicate-sale guard is generated per attempt, not per cart (Verified).
4. Discount caps are only enforced in the UI (Verified in the UI; server enforcement Unconfirmed).

---

## 2. Tech stack

| Area | Choice | Notes |
|---|---|---|
| UI | React 18.3, TypeScript 5.5 | Function components, hooks |
| Build | Vite 5.4, `@vitejs/plugin-react` | `build` runs `tsc && vite build` |
| Server state | TanStack Query 5.52 | `retry: 1`, `refetchOnWindowFocus: false` |
| Client state | Zustand 4.5 | `authStore` (persisted), `cartStore` |
| HTTP | axios 1.7 | `baseURL: '/api/v1'`, `withCredentials: true` |
| PWA | `vite-plugin-pwa` 0.20 | Config not visible in the index |
| Dates | `date-fns` 3.6 | Usage Unconfirmed |
| Shared code | `@hs-pharma/shared` (`workspace:*`) | Declared, not imported by web (see 8.2) |
| Declared but unused in inspected code | `react-router-dom`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@zxing/browser` | See section 9 |

**Scripts:** `dev`, `build`, `vercel-build`, `preview`, `typecheck`, `lint`. There is **no test script** and no test runner in the web package.

---

## 3. Project structure

```
pharmacy-management-system/
├── apps/
│   ├── api/                 Express + Mongoose API (Vercel config present)
│   └── web/                 @hs-pharma/web  ← this report
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx             QueryClient → <App/>
│           ├── App.tsx              auth gate, AppShell, nav, alert chips
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── DashboardPage.tsx
│           │   ├── BillingPage.tsx          (largest page, ~4.5k tokens)
│           │   ├── SalesHistoryPage.tsx
│           │   ├── RevenuePage.tsx
│           │   ├── ClosingPage.tsx
│           │   ├── MedicinesPage.tsx        (largest page, ~5.2k tokens)
│           │   ├── PurchasesPage.tsx
│           │   ├── CustomersPage.tsx
│           │   ├── StockPage.tsx
│           │   └── NarcoticsPage.tsx
│           ├── components/
│           │   ├── Modal.tsx            Modal, ModalHeader
│           │   ├── Toast.tsx            Toast, useToast
│           │   ├── CommandPalette.tsx
│           │   ├── BarcodeLabelModal.tsx
│           │   ├── CycleCountModal.tsx
│           │   ├── ReturnModal.tsx
│           │   ├── SupplierReturnModal.tsx
│           │   ├── NarcoticModal.tsx
│           │   ├── PeriodSelector.tsx
│           │   ├── RevenueKPIGrid.tsx
│           │   └── ExpensesSection.tsx
│           ├── store/
│           │   ├── authStore.ts
│           │   └── cartStore.ts
│           └── lib/
│               ├── api.ts               axios instance + refresh interceptor
│               ├── fmt.ts               money/date/expiry formatters
│               ├── sound.ts             scanner audio feedback
│               └── revenueApi.ts        revenue + expense API helpers and types
└── packages/
    └── shared/
        └── src/
            ├── index.ts
            ├── money.ts                 mulDiv, pct, roundToHundred, formatMoney…
            └── schemas.ts               Zod schemas (auth, medicines, sales, stock…)
```

---

## 4. Architecture

### 4.1 Boot and navigation (Verified)

- `main.tsx` creates one `QueryClient` and renders `App`.
- `App()` returns `<LoginPage />` when `useAuthStore().isAuthenticated()` is false, otherwise `<AppShell />`.
- `AppShell` keeps the active screen in **component state**, not in the URL:

  ```ts
  type Screen = 'dashboard' | 'billing' | 'sales' | 'revenue' | 'closing'
              | 'medicines' | 'purchases' | 'customers' | 'stock' | 'narcotics';
  const [screen, setScreen] = useState<Screen>('billing');   // default screen
  ```

- A `switch` in `renderScreen()` mounts the page. All pages are imported eagerly in `App.tsx`.

**Consequences:** no deep links, no working browser back button between screens, no route-level code splitting, and `react-router-dom` is installed but not used by any file I inspected.

### 4.2 Authentication and roles (Verified)

- `LoginPage` posts to `/auth/login` and stores `{ accessToken, user }` through `setAuth`.
- `authStore` (`useAuthStore`) is a Zustand store wrapped in `persist`. It exposes `setToken`, `setAuth`, `logout` and `isAuthenticated()`.
- `lib/api.ts` response interceptor on **401**:
  1. Marks the request `_retry`.
  2. If a refresh is already running, queues the request in `refreshQueue`.
  3. Otherwise posts to `/api/v1/auth/refresh` (cookie-based), stores the new token, replays all queued requests.
  4. On failure, calls `logout()`.
- Roles are `owner | manager | cashier`. `NAV_ITEMS` carries a `roles` array and is filtered per user. Some queries are gated by role (`/closing/today` for owner and manager, `/expenses` for owner).
- The server enforces roles with `requireRole` (`allRoles`, `managerOrOwner`, `ownerOnly`) after an `authenticate` middleware that reads **only** the `Authorization: Bearer` header.

### 4.3 Server state (Verified)

- Pages use `useQuery` with descriptive, shared keys, for example `['stock','low']`, `['stock','near-expiry']`, `['revenue','summary',from,to]`, `['customers','outstanding']`.
- The top-bar alert chips, Dashboard KPIs and Stock page therefore share the same cached data.
- Typical `staleTime` values: 30 s (sales, revenue today), 60 s (stock, revenue ranges), 5 min (settings).
- Mutations call `invalidateQueries` on the relevant keys.
- Some pages still use direct `api.post` calls with local `saving` and `error` state rather than `useMutation` (Medicines, Customers, Billing). `ClosingPage` uses `useMutation`.

### 4.4 Client state: the cart (Verified)

`useCartStore` holds `items`, `customerId`, `customerName`, `discountBP`, `paymentMode` (`cash | card | credit | split`), `cashPaid`, `cardPaid` and `prescription`, plus `addItem`, `removeItem`, `updateQty`, `clear`, and derived `subtotal()`, `discount()`, `total()`.

- Adding the same medicine and batch tops up quantity, capped at `maxQty` (available stock).
- Line totals use `mulDiv(qty, packPrice, packSize)`, so loose units are priced from pack prices.
- `total()` = subtotal minus `pct(subtotal, discountBP)`, rounded to the nearest 100 paisa (Rs 1).

### 4.5 Money and formatting (Verified)

- All amounts are integer **paisa**. Discounts are **basis points** (1% = 100 bp).
- `fmt()` formats for display (`en-IN` locale is used for the drawer chip). Users type rupees, and pages convert with `Math.round(rs * 100)`.
- Expiry display and colouring come from `daysUntil()`, `expiryClass()` and `fmtMmYy()` in `lib/fmt.ts`.

### 4.6 Styling (Partly verified)

- A global stylesheet provides class names such as `card`, `gt` and `gw` (tables), `btn`, `pill`, `seg` (segmented tabs), `kp` and `k` (KPI tiles), `chips`, `ft` (billing footer). CSS variables include `--mut`, `--bd`, `--br`, `--ok`, `--er`, `--okb`, `--erb`.
- Many components also use **inline `style` objects**.
- No CSS framework appears in the dependencies. The stylesheet itself was not visible in the index.
- Fonts referenced: Bricolage Grotesque and Figtree. The login screen uses a dark green gradient with an orange logo mark.

### 4.7 UX features (Verified)

| Feature | Where |
|---|---|
| Command palette (Ctrl/Cmd+K): search medicines, jump to screens | `CommandPalette`, `AppShell` |
| F2 focuses medicine search, F9 commits the sale | `BillingPage` |
| Scanner audio feedback (`scan`, `success`, `warn`), toggle in the top bar | `lib/sound.ts` |
| Collapsible sidebar, state saved in `localStorage` (`hs_sidebar_collapsed`) | `AppShell` |
| Live low-stock, near-expiry and drawer-cash chips in the top bar | `AlertChips`, `AppShell` |
| Server-rendered print views opened in a new window | Sales, Returns, Stock audits, Narcotics |

---

## 5. Screens

| Screen | Purpose | Key behaviour | Role notes |
|---|---|---|---|
| **Login** | Sign in | Username and password, error banner, loading state | Public |
| **Dashboard** | Daily snapshot | Today's sales, cash/card/udhaar bar, udhaar outstanding, low-stock and near-expiry counts, recent sales (limit 8) | Profit line shown only to owner |
| **Billing (POS)** | Create sales | Debounced (180 ms) search, per-batch picker, cart table, payment mode, discount, Rx/doctor note, customer picker, bill modal after commit | Discount input `max`: owner 100, manager 15, cashier 5 |
| **Sales History** | Audit and returns | Tabs: invoices, customer returns. Date and status filters, 20 per page, row detail, print, void (via `prompt()`) | |
| **Revenue** | Reporting | Period selector (default last 30 days), 12-KPI grid, daily, hourly, top medicines, top customers | Expenses section owner only |
| **Closing** | Cash drawer close | Opening cash, counted cash, note-denomination calculator (5000 to 10), expected = opening + cash sales + udhaar cash received, short/over badge, 30-day history | Owner and manager query |
| **Medicines** | Catalog | List, Add Medicine modal with optional opening stock, live unit cost, unit price and margin, `MM/YY` expiry validation, loss-sale confirmation | |
| **Purchases** | Stock intake | Tabs: purchase invoices, vendor debit notes. New Purchase modal, debit-note print | |
| **Customers** | Udhaar | Customer list, balance pill, credit limit, add-customer modal, ledger modal | |
| **Stock** | Inventory control | Tabs: near expiry, low stock, expired, cycle-count audits. Write-off, supplier return, barcode label, new audit, audit print | |
| **Narcotics** | Regulatory | Form-9 controlled-drug register, date and search filters, summary cards, print official register | |

### 5.1 The sale flow (Verified)

1. Cashier searches a medicine and picks a batch, which calls `cart.addItem` and plays `sounds.scan()`.
2. Optional: choose a customer (required in practice for credit), set discount, enter Rx and doctor.
3. F9 or the Commit button runs `handleCommit()`.
4. If any cart item has `prescriptionType === 'controlled_narcotic'`, `NarcoticModal` opens first and its details are passed on.
5. `POST /sales` sends `clientRequestId`, `customerId`, `items[{ medicineId, quantity, batchId }]`, `discountBP`, `paymentMode`, `cashPaid`, `cardPaid`, `prescription`, `narcoticDetails`.
6. On success: store `lastSaleId`, clear the cart, invalidate `['customers']`, play `sounds.success()`, toast "Bill … committed", open `BillModal`.
7. On failure: `sounds.warn()` and an inline error banner.

---

## 6. Shared components and utilities

| Module | Exports | Used for |
|---|---|---|
| `components/Modal.tsx` | `Modal`, `ModalHeader` | Every dialog in the app |
| `components/Toast.tsx` | `Toast`, `useToast` | Success messages |
| `components/CommandPalette.tsx` | `CommandPalette`, `CommandItem` | Global search and jump |
| `components/BarcodeLabelModal.tsx` | `BarcodeLabelModal`, `BarcodeLabelData` | Shelf and product labels (Stock, Medicines) |
| `components/CycleCountModal.tsx` | `CycleCountModal` | Physical stock audits |
| `components/ReturnModal.tsx` | `ReturnModal` | Customer returns |
| `components/SupplierReturnModal.tsx` | `SupplierReturnModal` | Returns to suppliers |
| `components/NarcoticModal.tsx` | `NarcoticModal` | Patient and prescriber details for controlled drugs |
| `components/PeriodSelector.tsx` | `PeriodSelector` | Revenue date ranges |
| `components/RevenueKPIGrid.tsx` | `RevenueKPIGrid` | 12-tile KPI grid |
| `components/ExpensesSection.tsx` | `ExpensesSection` | Owner expense entry and list |
| `lib/api.ts` | `api` | Axios instance with refresh logic |
| `lib/fmt.ts` | `fmt`, `fmtQty`, `fmtDate`, `fmtDateTime`, `fmtMmYy`, `daysUntil`, `expiryClass`, `newClientRequestId` | Display and ID helpers |
| `lib/sound.ts` | `sounds` (`scan`, `success`, `warn`, `isEnabled`, `setEnabled`) | Audio feedback |
| `lib/revenueApi.ts` | `fetchRevenueSummary`, `fetchDailyRevenue`, `fetchHourlyRevenue`, `fetchTopMedicines`, `fetchTopCustomers`, `fetchExpenses`, `createExpense`, `deleteExpense`, `EXPENSE_CATEGORIES`, types | Revenue and expense data |

---

## 7. Frontend-to-API map

All paths are relative to `/api/v1`. "Server guard" is the role middleware on the API route where I could see it.

| Area | Method and path | Called from | Server guard |
|---|---|---|---|
| Auth | `POST /auth/login` | LoginPage | public |
| Auth | `POST /auth/refresh` | `lib/api.ts` | cookie |
| Settings | `GET /settings` | AppShell | `allRoles` |
| Medicines | `GET /medicines/search?q=` | BillingPage, CommandPalette | `allRoles` |
| Medicines | `POST /medicines` | MedicinesPage | role-guarded |
| Sales | `POST /sales` | BillingPage | role-guarded |
| Sales | `GET /sales` (`page`, `limit`, `dateFrom`, `dateTo`, `status`) | Dashboard, SalesHistory | `allRoles` |
| Sales | `POST /sales/:id/void` | SalesHistory | role-guarded |
| Sales | `GET /sales/:id/print` | SalesHistory (`window.open`) | `allRoles` |
| Returns | `GET /returns/customer`, `GET /returns/supplier` | SalesHistory, Purchases | `allRoles` / `managerOrOwner` |
| Returns | `GET /returns/customer/:id/print`, `GET /returns/supplier/:id/print` | SalesHistory, Purchases | `allRoles` / `managerOrOwner` |
| Customers | `GET /customers`, `POST /customers` | CustomersPage | `allRoles` |
| Customers | `GET /customers/outstanding` | Dashboard | `allRoles` |
| Purchases | `GET /purchases` | PurchasesPage | role-guarded |
| Stock | `GET /stock/low`, `/near-expiry`, `/expired` | AppShell, Dashboard, Stock | role-guarded |
| Stock | `GET /stock/audits`, `POST /stock/writeoff` | StockPage | role-guarded |
| Stock | `GET /stock/audits/:id/print` | StockPage (`window.open`) | `managerOrOwner` |
| Closing | `GET /closing/today`, history, create | AppShell, ClosingPage | owner and manager |
| Revenue | `GET /revenue/summary`, `/daily`, `/hours`, `/medicines`, `/customers` | Dashboard, Revenue | role-guarded |
| Expenses | `GET`, `POST`, `DELETE /expenses` | Revenue, ExpensesSection | `ownerOnly` |
| Regulatory | `GET /regulatory/form9` | NarcoticsPage | role-guarded |
| Regulatory | `GET /regulatory/form9/print` | NarcoticsPage (`window.open`) | role-guarded |

The API also exposes `GET /revenue/export.csv`, `GET /customers/:id/ledger` and `POST /customers/:id/payments`. I did not verify that the frontend calls the export endpoint directly.

---

## 8. Findings

Severity: **High** = likely user-visible failure or data risk, **Medium** = correctness or maintainability risk, **Low** = polish.

### 8.1 Print views probably fail authentication — High (Inferred)

- **What:** Invoices, returns, debit notes, stock audits and the Form-9 register open with `window.open('/api/v1/…/print')`.
- **Why it matters:** `authenticate()` accepts only an `Authorization: Bearer …` header, and every module router calls it. A plain browser navigation cannot send that header, so I expect a 401 "No access token" in the new tab.
- **Not confirmed:** I did not see exactly how `authenticate` is attached to each route.
- **How to check:** Click Print on any invoice. A JSON 401 in the new tab confirms it.
- **Fix options:** (a) fetch the HTML through `api` as text and open it as a blob URL, or (b) issue a short-lived signed print URL from the API.

```ts
// Sketch for option (a)
export async function openAuthedHtml(path: string) {
  const res = await api.get(path, { responseType: 'text' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
  window.open(url, '_blank');
}
```

### 8.2 The web app does not use the shared package — Medium (Verified)

- Only API files import `@hs-pharma/shared`. No web file imports it, although it is a declared dependency.
- `cartStore.ts` redefines `roundToHundred`, `pct` and `mulDiv`, which already exist in `packages/shared/src/money.ts`.
- `EXPENSE_CATEGORIES` exists in three places: the web `revenueApi.ts`, the API expense model, and the shared schemas.
- Form validation (for example the `MM/YY` expiry regex in Add Medicine) is hand-written and duplicates what the shared Zod schemas define.
- **Risk:** the preview total on screen can drift from the total the server computes if either copy changes.
- **Fix:** import the money helpers and enums from `@hs-pharma/shared`.

### 8.3 The duplicate-sale guard is weaker than it looks — Medium (Verified)

- `newClientRequestId()` is called inside each commit attempt.
- If a sale succeeds on the server but the response is lost, pressing F9 again sends a new ID and could create a second sale.
- **Fix:** keep one request ID in `cartStore`, create it when the first item is added, send it on every retry, and reset it in `clear()`.

### 8.4 Discount caps are enforced only by an HTML attribute — Medium (UI verified, server unconfirmed)

- The footer input has `max` of 100 (owner), 15 (manager), 5 (cashier), but `onChange` accepts any typed value.
- **Action:** confirm the sales service rejects discounts above the role limit.

### 8.5 The "Fully Compliant" badge is hard-coded — Medium (Verified)

- `NarcoticsPage` renders a literal "Fully Compliant" status card. It reflects no computed check, which is misleading on a statutory register page.
- **Fix:** compute it from real checks (missing CNIC, missing prescriber registration) or remove it.

### 8.6 Native browser dialogs for important actions — Low (Verified)

- `confirm()` for expiry write-off, `prompt()` for the void reason, and `alert()` for many errors.
- These block the UI, cannot be styled, and make a reason field easy to skip. The existing `Modal` and `Toast` components could replace them.

### 8.7 Loose typing — Low (Verified)

- API responses are typed `any` in most pages (`(c: any)`, `(s: any)`). The shared package and `revenueApi.ts` already define some types that pages do not use.

### 8.8 Large single-file pages — Low (Verified)

- `BillingPage.tsx` (about 4.5k tokens) and `MedicinesPage.tsx` (about 5.2k tokens) define several components each. Splitting them would help testing and review.

### 8.9 No tests and no code splitting — Low (Verified)

- The web package has no test script or runner.
- All pages ship in one bundle, which matters more on slow shop hardware.

---

## 9. Dependency audit

| Dependency | Status | Evidence |
|---|---|---|
| `react`, `react-dom` | Used | Everywhere |
| `@tanstack/react-query` | Used | All data pages |
| `zustand` | Used | `authStore`, `cartStore` |
| `axios` | Used | `lib/api.ts` |
| `vite-plugin-pwa` | Configured, not inspected | `vite.config.ts` body not visible |
| `date-fns` | Unconfirmed | No usage seen in inspected pages |
| `@hs-pharma/shared` | **Declared, unused by web** | Only API files import it |
| `react-router-dom` | **No usage found** | `App` switches screens with state |
| `react-hook-form`, `@hookform/resolvers` | **No usage found** | Forms use `useState` |
| `zod` | **No usage found in web** | Used in shared and API |
| `@zxing/browser` | **No usage found** | No scanner or reader code in the index |
| `eslint` | Not in web devDependencies | `lint` script may rely on the root install |

**Note on barcode scanning:** the README advertises camera barcode scanning, but I found no scanner code. Scanning may rely on a USB scanner typing into the search box.

Before removing anything, run a plain-text search of the repo, because the graph tracks imports between repo files better than imports from external libraries.

---

## 10. Recommended next steps

| Priority | Action | Addresses |
|---|---|---|
| 1 | Confirm and fix print authentication (blob fetch or signed URL) | 8.1 |
| 2 | Keep one `clientRequestId` per cart and reset it on `clear()` | 8.3 |
| 3 | Verify the server enforces role discount limits | 8.4 |
| 4 | Import money helpers and enums from `@hs-pharma/shared` and delete the copies | 8.2 |
| 5 | Replace the hard-coded compliance badge with real checks | 8.5 |
| 6 | Replace `prompt()`, `confirm()` and `alert()` with `Modal` and `Toast` | 8.6 |
| 7 | Remove unused dependencies, or start using them (router for deep links, shared Zod schemas for forms) | Section 9 |
| 8 | Add typed API response models, using `revenueApi.ts` as the pattern | 8.7 |
| 9 | Split the two largest pages and lazy-load screens | 8.8, 8.9 |
| 10 | Add a test runner (Vitest) starting with `cartStore` totals | 8.9 |

---

## 11. Limits of this research

**Not visible in the index**

- The CSS files, `index.html` and the contents of `vite.config.ts`, so the theme tokens, PWA and offline behaviour, and the dev proxy are unverified.
- The bodies of `Modal`, `Toast`, `CommandPalette`, `sound.ts`, `fmt.ts`, `ReturnModal`, `SupplierReturnModal`, `CycleCountModal`, `NarcoticModal`, `BarcodeLabelModal`, `PeriodSelector`, `RevenueKPIGrid` and `ExpensesSection`.

**Partly seen**

- Several page bodies were truncated by the index, so I saw their top halves (state, queries, handlers) but not all of the markup. This applies to Dashboard, Stock, Closing, Narcotics, Sales History, Customers, Purchases and Revenue.
- The index tracks imports between repo files more reliably than calls into external libraries. "Unused" claims need a text search to be final.

**Other**

- The index reflects commit `d3181ba` and may be behind the current branch.
- I did not run the app, so every behavioural statement comes from reading code, not from observing it.

# Pharmacy Management Software: Implementation Plan (Code-First)

**Stack:** MongoDB (replica set) + Node.js/Express + React (PWA) + TypeScript
**Approach:** Start coding on day 1. Local shop server first, live server later.
**Team assumption:** 1 full-time developer, about 12 weeks to a usable system.

---

## Table of Contents

1. Goal and scope
2. Default rules built into the code
3. Environment and repo setup
4. Infrastructure (Docker, MongoDB replica set)
5. Backend foundation
6. Database design
7. Core business logic
8. API surface and permissions
9. Frontend (React + PWA)
10. Printing and barcodes
11. Data import
12. Testing strategy
13. Sprint-by-sprint build plan (the main checklist)
14. Security checklist
15. Deploy to the local shop server
16. Backups and monitoring
17. Moving to a live server
18. Go-live
19. Risks
20. Start today

---

## 1. Goal and scope

**MVP (build this first):**

| # | Feature |
|---|---|
| 1 | Medicine master: name, generic/salt, company, strength, barcodes, pack config |
| 2 | Batches: batch no., expiry, purchase price, sale price/MRP, stock |
| 3 | Purchase entry and purchase history |
| 4 | POS billing with fast search and barcode scan |
| 5 | Bill print (thermal 80mm/58mm and A4) |
| 6 | Stock search by medicine name, salt, batch number, barcode |
| 7 | Low-stock and near-expiry alerts |
| 8 | Customers, credit sale (udhaar), payment receiving, outstanding balance, statement |
| 9 | Mobile + laptop through one PWA |

**Phase 2 (after MVP works in the shop):** supplier payables, returns, write-offs, reports, daily closing, audit log, backups automation, user roles polish.

**Later:** WhatsApp/SMS udhaar reminders, multi-branch, online ordering, analytics, offline queue.

---

## 2. Default rules built into the code

You do not need to decide these before coding. They are the defaults, stored in the `settings` collection so they can be changed later without code changes.

| Topic | Default |
|---|---|
| Stock unit | Stored in the **smallest sellable unit** (tablet, capsule, bottle). Each medicine defines `packSize` (e.g. 10 tablets per strip) and optional `packsPerBox` |
| Money | **Integers in the smallest currency unit** (e.g. paisa). Never floats |
| Pricing | Prices are stored **per pack**. Loose price = `round(qty * packPrice / packSize)` |
| Percentages | Stored as **basis points** (10% = 1000) so math stays integer |
| Stock picking | **FEFO**: earliest expiry first. Expired batches are never sold |
| Expiry entry | Entered as MM/YY, stored as the last day of that month |
| Alerts | Near-expiry: 90 days (amber), 30 days (red). Low stock: stock <= `minStock` |
| Negative stock | Not allowed |
| Discount | Cashier up to a limit %. Above that needs manager/owner PIN |
| Credit (udhaar) | Registered customers only, with a per-customer credit limit |
| Bill editing | Never. Corrections go through a return. Voiding a bill is owner-only with a reason |
| Bill number | `INV-2026-000001`, continuous, no gaps |
| Return window | 7 days. Refund as cash or reduce udhaar. Expired/opened items are not restocked |
| Tax | Off in v1. Fields are reserved on items and bills |

---

## 3. Environment and repo setup

### 3.1 Install

- Node.js (current LTS), **pnpm**, Git, Docker Desktop, VS Code
- MongoDB Compass, Bruno or Postman

### 3.2 Create the monorepo

```bash
mkdir pharmacy && cd pharmacy
git init
pnpm init
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 3.3 Folder structure

```
pharmacy/
  apps/
    api/
      src/
        config/            env.ts (Zod validated), db.ts
        common/            errors.ts, money.ts, dates.ts, logger.ts, pagination.ts
        middleware/        auth.ts, rbac.ts, validate.ts, errorHandler.ts, requestId.ts
        modules/
          auth/ users/ medicines/ batches/ suppliers/ purchases/
          sales/ returns/ customers/ ledger/ stock/ reports/
          closing/ settings/ audit/ import/
          (each module: routes.ts, controller.ts, service.ts,
                        model.ts, schema.ts, service.test.ts)
        jobs/              expiryJob.ts, reconcileJob.ts
        app.ts             server.ts
      migrations/
    web/
      src/
        api/ components/ features/ hooks/ pages/ routes/ lib/ styles/
  packages/
    shared/                Zod schemas, TypeScript types, enums, money helpers
  infra/
    docker-compose.yml
    docker-compose.dev.yml
    Caddyfile
    mongo/keyfile
    backup/backup.sh  backup/restore.sh
  .github/workflows/ci.yml
  .env.example
  README.md
```

### 3.4 Tooling (day 1)

- [ ] TypeScript with `"strict": true` in every package
- [ ] ESLint + Prettier, Husky + lint-staged (bad code cannot be committed)
- [ ] Vitest for tests, Supertest for API tests
- [ ] `mongodb-memory-server` using **`MongoMemoryReplSet`** (transactions need a replica set)
- [ ] Git branches: `main` (always working), `develop`, `feature/*`
- [ ] Commit style: `feat(sales): add FEFO allocation`
- [ ] GitHub Actions CI: install, lint, typecheck, test, build

### 3.5 Coding rules (put these in the README)

1. Controllers parse the request and call a service. **All business logic lives in services.**
2. Any write touching more than one collection runs inside a **transaction**.
3. Money only goes through `money.ts` helpers. No floats anywhere.
4. **Never trust prices or totals from the client.** The server recomputes everything.
5. Throw `AppError(code, httpStatus, message)`. No raw strings.
6. `stockMovements` and `ledger` collections are append-only. Never update or delete.
7. No hard deletes. Use `isActive` or `deletedAt`.
8. No side effects (printing, SMS) inside a transaction callback, because the driver can retry it.

---

## 4. Infrastructure (Docker, MongoDB replica set)

### 4.1 Development: `infra/docker-compose.dev.yml`

Simple single-node replica set, no auth, bound to localhost only.

```yaml
services:
  mongo:
    image: mongo:8
    command: ["--replSet", "rs0", "--bind_ip_all"]
    ports: ["127.0.0.1:27017:27017"]
    volumes: [mongo-dev:/data/db]
    healthcheck:
      test: >
        mongosh --quiet --eval
        "try{rs.status().ok}catch(e){rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]}).ok}"
      interval: 5s
      retries: 20
volumes:
  mongo-dev: {}
```

Dev connection string (note `directConnection=true`):

```
MONGO_URI=mongodb://Ahsan3727:%23Ahsan3145673727@ac-75haq23-shard-00-00.slngj0l.mongodb.net:27017,ac-75haq23-shard-00-01.slngj0l.mongodb.net:27017,ac-75haq23-shard-00-02.slngj0l.mongodb.net:27017/gym_management?ssl=true&replicaSet=atlas-oi643h-shard-0&authSource=admin&appName=jewellerycalc
```

**First task:** run `docker compose -f infra/docker-compose.dev.yml up -d`, connect with Compass, and run one test transaction to prove the replica set works.

### 4.2 Production (shop server): `infra/docker-compose.yml`

```yaml
services:
  mongo:
    image: mongo:8
    restart: unless-stopped
    command: ["mongod", "--replSet", "rs0", "--bind_ip_all", "--keyFile", "/etc/mongo/keyfile"]
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - mongo-data:/data/db
      - ./mongo/keyfile:/etc/mongo/keyfile:ro
    healthcheck:
      test: >
        mongosh -u ${MONGO_ROOT_USER} -p ${MONGO_ROOT_PASSWORD}
        --authenticationDatabase admin --quiet --eval
        "try{rs.status().ok}catch(e){rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]}).ok}"
      interval: 10s
      retries: 10
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "5" }

  api:
    build: ../apps/api
    restart: unless-stopped
    env_file: ../.env
    depends_on:
      mongo: { condition: service_healthy }

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ../apps/web/dist:/srv/web:ro
      - caddy-data:/data

volumes:
  mongo-data: {}
  caddy-data: {}
```

### 4.3 Notes and gotchas

1. Generate the keyfile: `openssl rand -base64 756 > infra/mongo/keyfile && chmod 400 infra/mongo/keyfile`. If Mongo rejects the permissions, build a tiny Dockerfile that copies the keyfile and sets `chmod 400` and `chown mongodb`.
2. **Never publish port 27017** in production.
3. Create a **separate app user** with `readWrite` on the `pharmacy` database only. Do not use root in the app.
4. Production connection string: `mongodb://APP_USER:APP_PASS@mongo:27017/pharmacy?replicaSet=rs0&authSource=pharmacy`
5. Caddy serves the React build and proxies `/api` to the API, so everything is on **one origin** (no CORS or cookie problems).

### 4.4 `infra/Caddyfile` (shop LAN)

```
https://pharmacy.lan, https://192.168.1.10 {
    tls internal
    encode gzip

    handle /api/* {
        reverse_proxy api:4000
    }

    handle {
        root * /srv/web
        try_files {path} /index.html
        file_server
    }
}
```

`tls internal` creates a private certificate. **Install Caddy's root certificate on every phone and laptop**, otherwise browsers show warnings, and camera scanning and PWA install are blocked.

### 4.5 `.env.example`

```
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/pharmacy?directConnection=true
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
TZ=Asia/Karachi
```

(In production also set `MONGO_ROOT_USER` and `MONGO_ROOT_PASSWORD`.)

---

## 5. Backend foundation

### 5.1 Packages

`express mongoose zod jsonwebtoken argon2 helmet cors cookie-parser express-rate-limit pino pino-http node-cron exceljs migrate-mongo`
Dev: `typescript tsx vitest supertest mongodb-memory-server @types/*`

### 5.2 Build order

1. `config/env.ts`: validate all environment variables with Zod. The app refuses to start if one is missing.
2. `config/db.ts`: Mongoose connection. Set `autoIndex: false` in production (indexes come from migrations).
3. Split `app.ts` (Express setup) from `server.ts` (listen and graceful shutdown) so tests can import the app.
4. Middleware: request ID, pino logging, helmet, rate limit, JSON body limit, `validate(schema)`, `auth`, `requireRole(...)`, one central error handler.
5. Standard response shape:
   - Success: `{ "ok": true, "data": ... }`
   - Error: `{ "ok": false, "error": { "code": "...", "message": "...", "details": ... } }`
6. `GET /health` (checks DB ping) and `GET /version`.
7. Utilities: `money.ts`, `dates.ts` (store UTC, display in shop timezone, month-end expiry), `pagination.ts`.
8. Migrations with `migrate-mongo`: migration 001 creates collections and **all indexes**, and **pre-creates the counters documents**.
9. Seed script: creates the first owner user.
10. Make sure the server timezone and NTP time sync are correct. Wrong clocks break expiry checks and bill dates.

### 5.3 `common/money.ts` (reference)

```ts
import { AppError } from './errors';

export type Money = number; // integer, smallest currency unit

export function assertMoney(n: number): asserts n is Money {
  if (!Number.isSafeInteger(n)) throw new AppError('BAD_MONEY', 400, 'Money must be an integer');
}

/** (a * b) / c rounded to nearest integer. Used for loose-unit pricing. */
export const mulDiv = (a: number, b: number, c: number): Money => Math.round((a * b) / c);

/** percent in basis points: 10% = 1000 */
export const percentOf = (amount: Money, bp: number): Money => Math.round((amount * bp) / 10000);

export const looseLinePrice = (qtyBase: number, packPrice: Money, packSize: number): Money =>
  mulDiv(qtyBase, packPrice, packSize);
```

---

## 6. Database design

Every collection has `createdAt` and `updatedAt`. Nothing is hard-deleted.

### 6.1 Collections

| Collection | Key fields |
|---|---|
| **users** | name, username (unique), passwordHash, role (`owner/manager/cashier`), pinHash, isActive, lastLoginAt |
| **sessions** | userId, refreshTokenHash, device, expiresAt, revokedAt |
| **medicines** | name, genericName (salt), strength, form, company, category, `barcodes[]`, `packSize`, `packsPerBox`, `minStock` (base units), rack, `isControlled`, taxRate (reserved), `searchTokens[]`, isActive |
| **batches** | medicineId, batchNo, mfgDate, expiryDate, purchasePricePerPack, mrpPerPack, salePricePerPack, **`qtyOnHand`** (cached, base units), supplierId, purchaseId, status (`active/expired/quarantined/depleted`) |
| **stockMovements** *(append-only)* | batchId, medicineId, type, qty (signed), unitCost, refType, refId, userId, note, createdAt |
| **suppliers** | name, phone, address, contactPerson, `balance` (cached) |
| **purchases** | supplierId, supplierInvoiceNo, invoiceDate, items[], totals, paidAmount, createdBy |
| **supplierLedger** *(append-only)* | supplierId, type (`PURCHASE/PAYMENT/RETURN/ADJUSTMENT/OPENING`), amount, refId, method, note |
| **customers** | name, phone, address, creditLimit, `balance` (cached), isActive |
| **customerLedger** *(append-only)* | customerId, type (`CREDIT_SALE/PAYMENT/RETURN_ADJUST/OPENING/WRITE_OFF/ADJUSTMENT`), amount (positive = customer owes more, negative = customer paid), refType, refId, method, note, userId |
| **sales** | invoiceNo, clientRequestId, customerId + snapshot, items[], subtotal, discount, roundOff, total, payments[], paidAmount, creditAmount, soldBy, status, prescription info, closingId |
| **saleReturns / purchaseReturns** | original refs, items[], refund method, reason, user |
| **dailyClosings** | date, openingCash, system totals, countedCash, difference, closedBy |
| **counters** | `_id` like `invoice-2026`, seq |
| **auditLogs** | userId, action, entity, entityId, before, after, ip |
| **settings** | shop name, address, phone, bill footer, thresholds, discount limits, rounding, printer options |

### 6.2 Sale item shape

Each sale item points to **exactly one batch**:

```
medicineId, batchId,
nameSnapshot, batchNoSnapshot, expirySnapshot,
qty (base units), unitLabel, packPrice, discount, lineTotal, costSnapshot
```

Snapshots mean old bills never change when prices or names change.

### 6.3 Batch merge rule

A purchase tops up an existing batch **only if** batch number, expiry, purchase price, and sale price are all identical. Otherwise create a new batch record. This keeps profit calculations accurate.

### 6.4 Example Mongoose model: `batches/model.ts`

```ts
import { Schema, model, Types } from 'mongoose';

const BatchSchema = new Schema(
  {
    medicineId: { type: Types.ObjectId, ref: 'Medicine', required: true },
    batchNo: { type: String, required: true, trim: true, uppercase: true },
    mfgDate: Date,
    expiryDate: { type: Date, required: true },
    purchasePricePerPack: { type: Number, required: true, min: 0 },
    mrpPerPack: { type: Number, required: true, min: 0 },
    salePricePerPack: { type: Number, required: true, min: 0 },
    qtyOnHand: { type: Number, required: true, min: 0 }, // base units
    supplierId: { type: Types.ObjectId, ref: 'Supplier' },
    purchaseId: { type: Types.ObjectId, ref: 'Purchase' },
    status: {
      type: String,
      enum: ['active', 'expired', 'quarantined', 'depleted'],
      default: 'active',
    },
  },
  { timestamps: true },
);

BatchSchema.index({ medicineId: 1, expiryDate: 1 });
BatchSchema.index({ batchNo: 1 });
BatchSchema.index({ status: 1, expiryDate: 1 });

export const Batch = model('Batch', BatchSchema);
```

### 6.5 Indexes

| Collection | Index |
|---|---|
| medicines | `searchTokens` (multikey), `barcodes` (unique, sparse), `genericName` |
| batches | `{medicineId, expiryDate}`, `{batchNo}`, `{status, expiryDate}` |
| stockMovements | `{batchId, createdAt}`, `{refType, refId}` |
| sales | `{invoiceNo}` unique, `{clientRequestId}` unique, `{createdAt}`, `{customerId, createdAt}` |
| customers | `{phone}` unique sparse |
| customerLedger | `{customerId, createdAt}` |
| purchases | `{supplierId, supplierInvoiceNo}` unique (stops double entry) |

### 6.6 Search design

- Store lowercase word tokens from name, salt, and company in `searchTokens`.
- Query with an anchored prefix regex (`^par`) so the index is used. A MongoDB text index does **not** support type-as-you-search prefixes.
- A pharmacy catalogue of a few thousand items is small. Also cache it on the client for instant filtering.
- Batch search: query `batches.batchNo` directly. Barcode search: `medicines.barcodes`.

---

## 7. Core business logic

This is the part that must never be wrong. Write the tests first or alongside.

### 7.1 Sale creation (one transaction)

```ts
export async function createSale(input: CreateSaleInput, user: AuthUser) {
  const sale = await mongoose.connection.transaction(async (session) => {
    // 1. Idempotency: same clientRequestId returns the same bill, never a duplicate
    const dup = await Sale.findOne({ clientRequestId: input.clientRequestId }).session(session);
    if (dup) return dup;

    // 2. Allocate batches by FEFO (earliest expiry, qty > 0, not expired)
    const lines = await allocateFefo(input.items, session);

    // 3. Conditional deduction: this is what prevents overselling
    for (const l of lines) {
      const r = await Batch.updateOne(
        { _id: l.batchId, qtyOnHand: { $gte: l.qty } },
        { $inc: { qtyOnHand: -l.qty } },
        { session },
      );
      if (r.modifiedCount !== 1) throw new AppError('INSUFFICIENT_STOCK', 409, 'Stock changed, retry');
    }

    // 4. Server-side totals (integers only). Never trust client prices.
    const totals = computeTotals(lines, input.discount, input.payments);
    assertDiscountAllowed(totals, user);

    // 5. Gap-free invoice number, incremented inside the same transaction
    const invoiceNo = await nextInvoiceNo(session);

    const [created] = await Sale.create(
      [{ invoiceNo, clientRequestId: input.clientRequestId, ...totals, items: lines, soldBy: user.id }],
      { session },
    );

    await StockMovement.insertMany(movementsFor(created), { session });

    // 6. Udhaar
    if (totals.creditAmount > 0) {
      const customer = await Customer.findById(input.customerId).session(session);
      assertWithinCreditLimit(customer, totals.creditAmount);
      await CustomerLedger.create([creditEntry(created, customer)], { session });
      await Customer.updateOne(
        { _id: customer._id },
        { $inc: { balance: totals.creditAmount } },
        { session },
      );
    }

    await AuditLog.create([auditEntry('SALE_CREATE', created, user)], { session });
    return created;
  });

  // Side effects only AFTER the transaction has committed
  return sale;
}
```

### 7.2 FEFO allocation

```ts
async function allocateOne(medicineId: Types.ObjectId, qtyBase: number, session: ClientSession) {
  const today = startOfTodayUtc();
  const batches = await Batch.find({
    medicineId, status: 'active', qtyOnHand: { $gt: 0 }, expiryDate: { $gte: today },
  }).sort({ expiryDate: 1, createdAt: 1 }).session(session);

  let remaining = qtyBase;
  const out: { batchId: Types.ObjectId; qty: number }[] = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.qtyOnHand, remaining);
    out.push({ batchId: b._id, qty: take });
    remaining -= take;
  }
  if (remaining > 0) throw new AppError('INSUFFICIENT_STOCK', 409, 'Not enough non-expired stock');
  return out;
}
```

If a request spans two batches, create **two sale lines**, one per batch. A cashier can override and pick a specific batch (it must still be non-expired).

### 7.3 Rules around transactions

- The callback may be **retried** by the driver, so it must be safe to re-run and must not print, send SMS, or call external services.
- The invoice counter document must already exist (created in migration 001), so concurrent sales do not race on creating it. Concurrent sales will conflict on the counter and the driver retries. That is fine for one shop.
- A failed sale rolls back everything, including the counter, so numbering has no gaps.

### 7.4 Other services (all transactional)

| Service | What it does |
|---|---|
| **Purchase entry** | Create or merge batches, write `PURCHASE` movements, write supplier ledger entry, update supplier balance. Batch number and expiry are **mandatory**. Support bonus/free quantity |
| **Sale return** | Validate return window and original bill. Restock only if allowed. Refund cash or reduce udhaar. Write movements and ledger entries |
| **Void bill** (owner only) | A full return with a reason, recorded in the audit log |
| **Purchase return** | Deduct stock, reduce supplier balance |
| **Expiry write-off / damage** | `EXPIRY_WRITEOFF` or `DAMAGE` movements with a reason |
| **Stock adjustment / stock-take** | User enters counted quantity, the system writes the **difference** as an adjustment movement. Manager/owner only |
| **Receive customer payment** | `PAYMENT` ledger entry (negative amount), `$inc` customer balance, print receipt |
| **Daily closing** | Compare system totals with counted cash, record the difference, lock the day's bills to the closing |

### 7.5 Scheduled jobs

- **Nightly:** mark expired batches as `expired`, refresh alert data.
- **Nightly reconciliation:**
  - For each batch: `sum(stockMovements.qty) == qtyOnHand`
  - For each customer: `sum(customerLedger.amount) == balance`
  - Any mismatch is logged loudly and shown to the owner. This catches bugs before the shop does.

---

## 8. API surface and permissions

Base path: `/api/v1`. All list endpoints support pagination and filters.

| Area | Endpoints | Who |
|---|---|---|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/pin-unlock`, `GET /auth/me` | All |
| Users | CRUD `/users`, reset password, deactivate | Owner |
| Medicines | CRUD `/medicines`, `GET /medicines/search?q=`, `GET /medicines/by-barcode/:code` | Read: all. Write: manager, owner |
| Batches | `GET /batches?medicineId=`, `GET /batches/search?batchNo=`, `PATCH` (sale price, quarantine) | Manager, owner |
| Purchases | `POST /purchases`, `GET /purchases`, `GET /purchases/:id` | Manager, owner |
| Suppliers | CRUD, `GET /suppliers/:id/ledger`, `POST /suppliers/:id/payments` | Manager, owner |
| Sales | `POST /sales`, `GET /sales`, `GET /sales/:id`, `GET /sales/:id/print`, `POST /sales/:id/void` | Void: owner only |
| Returns | `POST /returns/sale`, `POST /returns/purchase` | Cashier (within window), manager, owner |
| Customers | CRUD, `GET /customers/:id/ledger`, `GET /customers/:id/statement`, `GET /customers/outstanding` | All (credit limit edit: manager, owner) |
| Payments | `POST /customers/:id/payments` | All |
| Stock | `GET /stock/low`, `/stock/near-expiry`, `/stock/expired`, `POST /stock/adjust`, `/stock/writeoff`, `/stock/stocktake` | Manager, owner |
| Reports | `GET /reports/sales`, `/profit`, `/fast-slow`, `/expiry`, `/udhaar-aging`, `/payables`, `/valuation`, with `?format=csv\|xlsx` | Profit: owner |
| Closing | `POST /closing`, `GET /closing/:date` | Manager, owner |
| Import | `POST /import/medicines`, `/import/stock`, `/import/customers` (with `?dryRun=true`) | Owner |
| Settings | `GET/PUT /settings` | Owner |

### Permission matrix

| Action | Cashier | Manager | Owner |
|---|---|---|---|
| Billing, receive payment | Yes | Yes | Yes |
| Discount above limit | No | Yes | Yes |
| Returns | Limited | Yes | Yes |
| Void bill | No | No | Yes |
| Purchase entry, stock adjust | No | Yes | Yes |
| See purchase price and profit | No | No | Yes |
| Users, settings, backups | No | No | Yes |

**Important:** hide purchase price and profit **in the API response** for cashiers (use projections). Hiding them only in the UI is not enough.

---

## 9. Frontend (React + PWA)

### 9.1 Setup

```bash
pnpm create vite apps/web --template react-ts
cd apps/web
pnpm add @tanstack/react-query react-router-dom react-hook-form zod @hookform/resolvers \
         zustand date-fns @zxing/browser
pnpm add -D tailwindcss vite-plugin-pwa
# then init shadcn/ui
```

### 9.2 Rules

- TanStack Query for **all** server data.
- React Hook Form + the **shared Zod schemas** from `packages/shared` for every form.
- One `formatMoney()` helper used everywhere.
- Global error boundary and toast system.
- Route guard for auth, and role-based menu items.
- Keep the access token in memory. The refresh token is an `httpOnly` cookie.

### 9.3 Screens

1. Login and PIN unlock
2. Dashboard: today's sales, cash vs credit, low-stock count, near-expiry count, total udhaar
3. **POS billing** (most important screen)
4. Bills list, bill detail, reprint
5. Returns
6. Medicines list and detail (batches, movement history)
7. Purchase entry and purchase list
8. Stock: search, low stock, near-expiry, expired, stock-take
9. Suppliers and supplier ledger
10. Customers, ledger, receive payment, statement, udhaar list
11. Reports and daily closing
12. Users, settings, backup status

### 9.4 POS screen spec

- Large search box, always focused. Results show name, strength, available stock, nearest expiry, price. Arrow keys + Enter add the item.
- **Barcode scan:** a global key listener treats fast keystrokes (a few ms apart) ending with Enter as a scan. A scan adds 1 unit, a repeat scan increments.
- Cart table: editable quantity, unit toggle (tablet / strip / box), line discount, live total.
- Customer picker (default "Walk-in"). Selecting a customer shows their outstanding balance.
- Payment split: cash, card/wallet, credit (udhaar).
- Shortcuts: `F2` search, `F4` customer, `F6` discount, `F8` pay and save, `F9` print, `Esc` clear.
- On save: generate `clientRequestId` **before** sending, disable the button while saving, open print on success. A double-click must never create two bills.
- Warnings: expiry under 90 days, controlled drug needs prescription entry, credit limit exceeded.
- **Targets:** normal bill in under 15 seconds, search results in under 100 ms.

### 9.5 Mobile and PWA

- Responsive layout: bottom navigation on phones, sidebar on laptops, large tap targets.
- `vite-plugin-pwa` for installability and app-shell caching.
- Phone use cases: stock check, price check, camera barcode scan, owner dashboard, receiving udhaar payments.
- Camera scanning needs **HTTPS** (see section 4.4).
- PWA caching does **not** make billing work offline. With the local server as primary, that is not needed. The `clientRequestId` makes an offline queue possible later.

---

## 10. Printing and barcodes

### 10.1 Thermal bill (80mm / 58mm)

1. A dedicated print route renders the bill with `@page { size: 80mm auto; margin: 0 }`, narrow or monospace font, no extra margins.
2. On the counter PC, launch Chrome with `--kiosk-printing` so the bill prints without a dialog.
3. Bill content: shop name, address, phone, invoice no., date/time, cashier, customer, item lines (name, batch, expiry, qty, price, total), discount, round-off, total, paid, credit, previous balance and new balance (for udhaar), footer.
4. Also build: A4 invoice template, payment receipt template, customer statement PDF.
5. **Test the real printer in Sprint 1.** If browser output is poor, add ESC/POS direct printing later through a small local print service.

### 10.2 Barcodes

1. USB scanner: set to keyboard mode with Enter suffix, and test it in a plain text box first.
2. A medicine can have **multiple barcodes**. A barcode maps to a **medicine**; the batch is chosen by FEFO or cashier override.
3. Items without a barcode: generate an internal Code128 code and print shelf labels (later feature).
4. Camera scanning: ZXing, or the browser's native `BarcodeDetector` where available.
5. Batch search works by typing the batch number, since local packs rarely encode the batch in the barcode.

---

## 11. Data import

1. Provide Excel templates for **medicines**, **stock (with batch and expiry)**, and **customers with opening udhaar**.
2. Every import endpoint supports `?dryRun=true`, which validates everything and returns a report without saving.
3. Validation: required columns, expiry format, negative numbers, duplicate barcodes, duplicate medicine+batch pairs. Failed rows go into a downloadable error CSV.
4. Opening stock is saved as `OPENING` stock movements and opening udhaar as `OPENING` ledger entries, so even the first numbers have history.
5. Rehearse the import at least twice on a test copy.

---

## 12. Testing strategy

### 12.1 Unit tests

Money helpers, FEFO allocation, loose/strip/box conversion, ledger math, discount and rounding, expiry logic.

### 12.2 Integration tests (non-negotiable, use `MongoMemoryReplSet`)

- [ ] A sale reduces stock and creates the bill, movement, and ledger entry together
- [ ] A failure halfway rolls everything back
- [ ] **Concurrency:** two sales for the last strip fired at once, exactly one succeeds
- [ ] Same `clientRequestId` sent twice creates **one** bill
- [ ] An expired batch is never sold
- [ ] Returns and voids restore stock and balances correctly
- [ ] Credit limit is enforced
- [ ] The reconciliation job finds **zero** mismatches after a randomized run of 1,000 operations

### 12.3 API tests (Supertest)

Auth, role permissions, validation errors, cashier cannot see purchase price.

### 12.4 Frontend tests

Component tests for cart math. **Playwright** end-to-end tests for: login, scan, bill, print preview, udhaar sale, receive payment.

### 12.5 Targets

- At least 90% coverage on service files
- Every bug found in the shop gets a test **before** it is fixed
- CI blocks merging if any step fails

---

## 13. Sprint-by-sprint build plan (main checklist)

Each sprint is about one week. Do not start the next sprint until the "Done when" line is true.

### Sprint 0: Setup (days 1 to 3)

- [ ] Install tools (section 3.1), create monorepo and folder structure
- [ ] Lint, format, Husky, Vitest, CI pipeline
- [ ] Dev Docker Mongo replica set running, one test transaction succeeds
- [ ] `.env.example`, README with coding rules

**Done when:** `pnpm test` and CI are green on an empty project, and a Mongo transaction works.

### Sprint 1: Foundation (week 1)

**Backend**
- [ ] `env.ts`, `db.ts`, `app.ts`, `server.ts`, error handler, logger, `/health`
- [ ] Migration 001 (collections, indexes, counters), seed owner user
- [ ] Auth: login, refresh with rotation, logout, `me`, PIN unlock
- [ ] Users CRUD, role middleware, login rate limit and lockout

**Frontend**
- [ ] Vite + Tailwind + shadcn, router, layout (sidebar + mobile bottom nav)
- [ ] Login page, auth guard, API client with token refresh
- [ ] PWA shell

**Hardware and HTTPS**
- [ ] Caddy HTTPS in dev or on LAN, open the app on a phone
- [ ] Test the thermal printer and USB scanner in a plain browser page

**Done when:** you can log in from laptop **and** phone over HTTPS, a test page prints on the thermal printer, and the scanner types into a text box.

### Sprint 2: Medicine master and import (week 2)

- [ ] Medicine model, schema, service, CRUD API, `searchTokens` generation
- [ ] Barcodes (multiple per medicine, unique), pack config (`packSize`, `packsPerBox`)
- [ ] `GET /medicines/search` and `by-barcode`
- [ ] Medicines list, create/edit form, detail page
- [ ] Excel import for medicines with dry-run and error CSV

**Done when:** your real medicine Excel imports with a clean report and search returns results in under 100 ms.

### Sprint 3: Suppliers, purchases, batches (week 3)

- [ ] Supplier CRUD
- [ ] Purchase entry service (transactional): create/merge batches, movements, supplier ledger
- [ ] Batch number and expiry mandatory, MM/YY input with month-end storage
- [ ] Duplicate supplier invoice protection (unique index)
- [ ] Purchase entry screen (fast, keyboard-friendly), purchase history list
- [ ] Opening stock import (`OPENING` movements)

**Done when:** a purchase saves atomically, and for every batch `sum(movements) == qtyOnHand`.

### Sprint 4: POS billing and printing (week 4)

- [ ] `allocateFefo`, `computeTotals`, `nextInvoiceNo`
- [ ] `createSale` transaction with idempotency (`clientRequestId`)
- [ ] Discount limit and PIN override
- [ ] POS screen: search, barcode scan, cart, unit toggle, payment split, shortcuts
- [ ] Thermal print route and A4 invoice, reprint from bills list
- [ ] Integration tests: rollback, concurrency, duplicate request, expired batch

**Done when:** a bill takes under 15 seconds, the concurrency test passes, and a double-click creates one bill.

### Sprint 5: Search, alerts, dashboard (week 5)

- [ ] Stock search by medicine, salt, batch number, barcode
- [ ] Low-stock, near-expiry, and expired lists
- [ ] Nightly expiry job
- [ ] Dashboard v1 (today's sales, alert counts)
- [ ] Alternatives suggestion: same generic name when an item is out of stock

**Done when:** all four search types respond in under 100 ms and alert numbers match manual checks.

### Sprint 6: Customers and udhaar (week 6)

- [ ] Customer CRUD, credit limit
- [ ] Credit sale integrated into `createSale` (ledger entry, balance, limit check)
- [ ] Receive payment endpoint and screen, payment receipt print
- [ ] Customer ledger, statement (screen + PDF), outstanding list
- [ ] Opening udhaar import

**Done when:** for every customer `balance == sum(ledger)`, and a credit sale followed by a payment shows correct balances on the statement.

### Sprint 7: Returns and stock control (week 7)

- [ ] Sale return (window check, restock rules, refund as cash or udhaar reduction)
- [ ] Void bill (owner only, reason, audit)
- [ ] Expiry write-off and damage
- [ ] Stock adjustment and stock-take
- [ ] Purchase return

**Done when:** every return path has passing tests, and stock and ledger totals stay consistent after each.

### Sprint 8: Supplier payables (week 8)

- [ ] Supplier ledger, record payments to suppliers
- [ ] Payables report (what you owe each supplier)
- [ ] Supplier statement

**Done when:** payable equals purchases minus payments minus returns.

### Sprint 9: Reports and daily closing (week 9)

- [ ] Reports: daily/monthly sales, profit (owner only), fast/slow movers, expiry, udhaar aging, stock valuation
- [ ] CSV and Excel export
- [ ] Daily closing: system totals vs counted cash, difference recorded

**Done when:** reports match a hand calculation on sample data.

### Sprint 10: Control and hardening (week 10)

- [ ] Audit log for logins, discounts, price changes, returns, voids, adjustments, settings
- [ ] Settings screen (shop info, bill footer, thresholds, discount limits)
- [ ] Nightly reconciliation job with owner alert
- [ ] Automated backup script, restore script, restore drill
- [ ] Security checklist (section 14), `pnpm audit`

**Done when:** a backup restores cleanly on another machine and the reconciliation job reports zero mismatches.

### Sprint 11: Mobile, performance, user testing (week 11)

- [ ] Mobile layouts for stock check, price check, dashboard, payment receiving
- [ ] Camera barcode scanning
- [ ] Performance pass (indexes, query plans, client-side catalogue cache)
- [ ] Playwright end-to-end suite
- [ ] Real cashiers test a full day of sample bills and give feedback

**Done when:** staff complete a day of test bills without help and without blocking bugs.

### Sprint 12: Deploy and go-live (week 12 onward)

- [ ] Install on the shop server (section 15)
- [ ] Import rehearsal, then real import
- [ ] Training and one-page shortcut sheet
- [ ] Parallel run, fixes, go-live (section 18)

**Done when:** two clean days where cash and stock match the old system.

---

## 14. Security checklist

1. Passwords hashed with argon2. Login rate-limited, temporary lockout after repeated failures.
2. **Access token** (JWT, about 15 min) in memory. **Refresh token** in an `httpOnly`, `secure`, `sameSite=strict` cookie, rotated on every use, stored **hashed** in `sessions`.
3. **PIN unlock** after idle time on the counter.
4. Zod validation on every body, query, and param. Reject unknown fields. Never pass raw request objects into Mongo queries (NoSQL injection).
5. Helmet, strict CORS allowlist, request size limits.
6. MongoDB: auth on, port not exposed, app user with minimum rights.
7. HTTPS everywhere, including the shop LAN.
8. Secrets only in `.env`, never committed. Rotate if leaked.
9. Audit log for sensitive actions.
10. Backups encrypted before leaving the shop.
11. `pnpm audit` in CI. Update dependencies monthly.
12. Cashier API responses never include purchase price or profit.

---

## 15. Deploy to the local shop server (Stage A)

1. **Machine:** dedicated PC or mini-PC with SSD and **UPS**. Ubuntu Server is the most stable. Windows + Docker Desktop also works, but disable sleep and forced restarts.
2. **Network:** reserve a fixed IP for the server in the router. Test the hostname on your actual phones (`.local` names can fail on Android). Using the IP directly is the safest.
3. **HTTPS:** Caddy `tls internal`, then install the root certificate on every device.
4. **Deploy steps:**
   ```bash
   git clone <repo> && cd pharmacy
   cp .env.example .env        # fill in real secrets
   pnpm install && pnpm --filter web build
   docker compose -f infra/docker-compose.yml up -d --build
   pnpm --filter api migrate:up
   pnpm --filter api seed:owner
   ```
5. **Auto-start:** `restart: unless-stopped` on all services, Docker enabled at boot. Pull the power plug once on purpose and confirm everything returns by itself.
6. **Update procedure:** take a fresh backup, `git pull`, rebuild, run migrations, `docker compose up -d`, check `/health`. Keep the previous image tag so you can roll back.

---

## 16. Backups and monitoring

### 16.1 Backups

`infra/backup/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%F_%H%M)
mkdir -p /backup
docker compose -f /opt/pharmacy/infra/docker-compose.yml exec -T mongo \
  mongodump --uri="$MONGO_URI" --gzip --archive > "/backup/pharmacy-$STAMP.gz"
find /backup -name 'pharmacy-*.gz' -mtime +30 -delete
# encrypted off-site copy
rclone copy /backup remote:pharmacy-backups --include "pharmacy-*.gz"
```

Schedule it with cron every night (and once more at midday if you like).

- Retention: 7 daily, 4 weekly, 6 monthly.
- Copy to an **external USB drive** and to **cloud storage**, encrypted.
- **Monthly restore drill** on another machine. A backup that has never been restored is not a backup.
- Show "last successful backup" on the owner dashboard. Alert if older than 26 hours.

### 16.2 Monitoring

- Docker log rotation (`max-size`, `max-file`) so logs do not fill the disk
- Disk, memory, and container health checks, with a simple email or WhatsApp alert
- Optional Sentry for frontend and backend errors
- Reconciliation results visible to the owner

---

## 17. Moving to a live server (Stage B)

**Option 1 (recommended): shop server stays primary.** Use the cloud for backup and remote viewing. For the owner to see reports from home without opening router ports, use **Tailscale** or **Cloudflare Tunnel**.

**Option 2: cloud as primary** (only if the shop internet is reliable all day):

1. VPS (2 vCPU, 4 GB RAM is plenty to start), domain name, DNS.
2. Same Docker Compose. Caddy gets a real certificate automatically.
3. Firewall: only ports 22, 80, 443. SSH keys only, root login off, fail2ban on.
4. MongoDB: self-hosted replica set with the port closed, or MongoDB Atlas with an IP allowlist.
5. Move data with `mongodump` then `mongorestore`. Verify document counts and run the reconciliation job.
6. Add uptime monitoring and daily off-server backups.
7. **Cutover:** pick a quiet time, freeze the old system, take a final dump, restore, test a sale and a return, then switch all devices.
8. A cloud-primary shop needs an offline fallback (numbered paper slips entered later, or the offline queue feature) for the days the internet drops.

Because everything is configured through `.env`, this move is configuration work, not a rewrite.

---

## 18. Go-live

1. **Physical stock count** of the whole shop with batch and expiry for every item. This becomes your opening stock.
2. Import it, then re-count 20 random items to confirm software matches the shelf.
3. Import customers with opening udhaar. Have 10 customers confirm their balance.
4. **Parallel run for 1 to 2 weeks:** bill in both systems and compare sales and cash every evening.
5. Training: about 1 hour for cashiers (billing, return, payment) and 2 hours for the owner (purchases, reports, closing, backups). Hand out a one-page shortcut sheet.
6. **One non-negotiable rule: no purchase is saved without batch and expiry.**
7. Freeze new features during cutover week. Only fix bugs.
8. Be present or on call for the first week.
9. Fallback: numbered paper bills, entered into the system afterwards.

---

## 19. Risks

| Risk | Prevention |
|---|---|
| Wrong stock numbers | Movement-based stock, nightly reconciliation, tested transactions |
| Staff skips batch or expiry | Required fields, training, owner reviews the expiry report |
| Slow billing, staff return to paper | Speed targets, keyboard shortcuts, test with real cashiers in Sprint 11 |
| Data loss | UPS, nightly encrypted backups, monthly restore drill |
| Duplicate bills on double-click or retry | `clientRequestId` plus unique index |
| Phone camera not working | HTTPS with the certificate installed on devices |
| Scope creep | MVP frozen, new ideas go to the "Later" list |
| MongoDB without a replica set | Transactions fail. Always run a replica set, even in dev and tests |

---

## 20. Start today

1. Install Node, pnpm, Git, Docker, VS Code.
2. Create the monorepo and folder structure (section 3).
3. Start the dev Mongo replica set and run one transaction (section 4.1).
4. Set up lint, Vitest, and CI (section 3.4).
5. Begin **Sprint 1**: `env.ts`, `db.ts`, `app.ts`, `/health`, auth.

When Sprint 0 is done, the next deliverable is the actual Sprint 1 code (repo skeleton, Docker, auth, base UI).

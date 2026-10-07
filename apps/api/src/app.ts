import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { errorHandler } from './common/errorHandler';
import { env } from './config/env';

// Routes
import authRoutes from './modules/auth/routes';
import medicineRoutes from './modules/medicines/routes';
import purchaseRoutes from './modules/purchases/routes';
import salesRoutes from './modules/sales/routes';
import customerRoutes from './modules/customers/routes';
import supplierRoutes from './modules/suppliers/routes';
import stockRoutes from './modules/stock/routes';
import settingsRoutes from './modules/settings/routes';

export const app = express();

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, same-domain)
    if (!origin) return callback(null, true);
    const allowed = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      // Vercel production URL — set ALLOWED_ORIGIN in Vercel env vars
      ...(process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : []),
      // Allow any *.vercel.app subdomain (preview deployments)
      ...(origin.endsWith('.vercel.app') ? [origin] : []),
    ];
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ─── Global rate limit ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/v1/health', async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    const state = mongoose.default.connection.readyState;
    res.json({ ok: true, data: { status: 'ok', db: state === 1 ? 'connected' : 'disconnected', version: '1.0.0' } });
  } catch {
    res.status(503).json({ ok: false, error: { code: 'DB_ERROR', message: 'Database not ready' } });
  }
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/medicines', medicineRoutes);
app.use('/api/v1/purchases', purchaseRoutes);
app.use('/api/v1/sales', salesRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/stock', stockRoutes);
app.use('/api/v1/settings', settingsRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` } });
});

// ─── Central error handler ───────────────────────────────────────────────────
app.use(errorHandler);

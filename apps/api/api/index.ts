import '../src/config/db';
import { app } from '../src/app';
import { connectDB } from '../src/config/db';

// Connect on cold start — Vercel reuses warm containers automatically
connectDB().catch(console.error);

// Vercel expects a default export of an Express app (or a handler function)
export default app;

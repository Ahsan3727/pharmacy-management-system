import { app } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function start() {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    console.log(`\n🚀 HS Pharma API running on http://localhost:${env.PORT}`);
    console.log(`   Health: http://localhost:${env.PORT}/api/v1/health`);
    console.log(`   Environment: ${env.NODE_ENV}\n`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      const { disconnectDB } = await import('./config/db');
      await disconnectDB();
      console.log('✅ Server closed');
      process.exit(0);
    });
    setTimeout(() => { console.error('Forced shutdown'); process.exit(1); }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

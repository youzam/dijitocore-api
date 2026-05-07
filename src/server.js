require('dotenv').config();

const app = require('./app');
const prisma = require('./config/prisma');
const { startJobs } = require('./jobs');
const { validateGraphCoverage } = require('./utils/graph-validator');
const env = require('./config/env');
const checkPermissionIntegrity = require('./utils/permissionIntegrity.check');

const PORT = env.server.port || 4000;

let server;

/**
 * =========================
 * START SERVER
 * =========================
 */
async function startServer() {
  try {
    // ✅ Explicit DB connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // 🔥 STRICT MODE VALIDATION (CRITICAL)
    // Validate missing models in data-graph.js
    validateGraphCoverage();

    // Checks for role permission variation
    // between code and database and seed new permissions
    await checkPermissionIntegrity();

    // Connect to the server
    server = app.listen(PORT, () => {
      console.log(`🚀 API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server', error);
    process.exit(1);
  }
}

/**
 * =========================
 * GRACEFUL SHUTDOWN
 * =========================
 */
async function gracefulShutdown(reason, exitCode = 0) {
  console.log(`🛑 ${reason}. Shutting down gracefully...`);

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('🛑 HTTP server closed');
    }

    await prisma.$disconnect();
    console.log('✅ Database disconnected');

    process.exit(exitCode);
  } catch (err) {
    console.error('❌ Error during shutdown', err);
    process.exit(1);
  }
}

/**
 * =========================
 * PROCESS EVENTS
 * =========================
 */
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED PROMISE REJECTION');
  console.error(err.name, err.message);
  console.error(err.stack);

  gracefulShutdown('UNHANDLED_REJECTION', 1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));
process.on('SIGINT', () => gracefulShutdown('SIGINT', 0));

startJobs();
startServer();

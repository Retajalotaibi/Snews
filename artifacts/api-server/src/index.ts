import "dotenv/config";
import crypto from "node:crypto";
if (!globalThis.crypto) {
  (globalThis as any).crypto = crypto.webcrypto || crypto;
}
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { checkDbConnection } from "./lib/news-snapshot.js";

const rawPort = process.env["PORT"] || "5001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = process.env["HOST"] || "0.0.0.0";

const server = app.listen(port, host, async () => {
  logger.info({ port, host }, `Server listening at http://${host}:${port}`);
  
  // Verify database connection on startup
  try {
    const dbStatus = await checkDbConnection();
    if (dbStatus.ok) {
      logger.info({ db: dbStatus.uri }, `Database connected: ${dbStatus.message}`);
    } else {
      logger.warn({ db: dbStatus.uri }, `Database warning: ${dbStatus.message} (Snapshots will fall back to fresh fetch)`);
    }
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, "Database check encountered an error");
  }
});

server.on("error", (err: any) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});

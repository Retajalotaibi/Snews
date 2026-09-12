import crypto from "node:crypto";
if (!globalThis.crypto) {
  (globalThis as any).crypto = crypto.webcrypto || crypto;
}

import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// Handle both CJS namespace and ESM callable export patterns cleanly
const createPinoHttp: any = (pinoHttp as any).default || pinoHttp;

// In Vercel serverless, pinoHttp can be used or safely bypassed if logger is unavailable
try {
  app.use(
    createPinoHttp({
      logger,
      serializers: {
        req(req: IncomingMessage & { id?: unknown; url?: string }) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res: ServerResponse) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
} catch (e) {
  console.warn("pinoHttp initialization skipped in serverless:", e);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    name: "MarketLens API Server",
    status: "ok",
    endpoints: [
      "/api/market/overview",
      "/api/market/comparison",
      "/api/news",
      "/api/healthz",
    ],
  });
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/favicon.png", (_req, res) => {
  res.status(204).end();
});

app.use("/api", router);

// Global unhandled error handler so serverless function returns JSON 500 instead of crashing
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("API Server Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err?.message || String(err),
  });
});

export default app;

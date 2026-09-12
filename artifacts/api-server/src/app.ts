import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Handle both CJS namespace and ESM callable export patterns cleanly
const createPinoHttp: any = (pinoHttp as any).default || pinoHttp;

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

export default app;

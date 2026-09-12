import pino from "pino";

// Disable worker-thread transports (pino-pretty) in serverless and production to prevent invocation crashes
const isServerlessOrProd =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL === "1" ||
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isServerlessOrProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});


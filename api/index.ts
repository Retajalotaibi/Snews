import crypto from "node:crypto";
if (!globalThis.crypto) {
  (globalThis as any).crypto = crypto.webcrypto || crypto;
}

import app from "./artifacts/api-server/src/app.js";

export default function handler(req: any, res: any) {
  return app(req, res);
}

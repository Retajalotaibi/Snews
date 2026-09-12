import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const polyfillPath = path.resolve(__dirname, "node18-polyfill.cjs");

const env = {
  ...process.env,
  NODE_OPTIONS: `--require ${polyfillPath} ${process.env.NODE_OPTIONS || ""}`.trim(),
};

console.log("\n🚀 Starting MarketLens Local Development Environment...");
console.log("   • API Server: http://0.0.0.0:5001");
console.log("   • Web App:    http://0.0.0.0:3000\n");

function runProcess(name, command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`\x1b[36m[${name}]\x1b[0m ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`\x1b[33m[${name}]\x1b[0m ${chunk}`);
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\x1b[31m[${name}] process exited with code ${code}\x1b[0m`);
    }
  });

  return child;
}

const apiProcess = runProcess("API", "pnpm", ["--filter", "@workspace/api-server", "run", "dev"]);
const webProcess = runProcess("WEB", "pnpm", ["--filter", "@workspace/marketlens", "run", "dev"]);

function cleanup() {
  console.log("\n🛑 Shutting down servers...");
  apiProcess.kill("SIGTERM");
  webProcess.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { execFileSync, execSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..", "..");
const nextDir = path.join(root, "node_modules", "next");

if (!fs.existsSync(nextDir)) {
  console.log("[run-next] next not found — installing workspace dependencies...");
  execSync("npm install --workspaces --include-workspace-root", {
    stdio: "inherit",
    cwd: root,
  });
}

const bin = path.join(nextDir, "dist", "bin", "next");
if (!fs.existsSync(bin)) {
  console.error("[run-next] FATAL: next binary not found at", bin);
  process.exit(1);
}

try {
  execFileSync(process.execPath, [bin, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  process.exit(err.status ?? 1);
}

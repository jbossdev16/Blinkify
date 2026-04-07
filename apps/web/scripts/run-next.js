#!/usr/bin/env node
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..", "..");
const bin = require.resolve("next/dist/bin/next", {
  paths: [path.join(root, "node_modules"), __dirname],
});

try {
  execFileSync(process.execPath, [bin, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  process.exit(err.status ?? 1);
}

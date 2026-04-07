#!/usr/bin/env node
const { execFileSync } = require("child_process");
const bin = require.resolve("next/dist/bin/next");
try {
  execFileSync(process.execPath, [bin, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  process.exit(err.status ?? 1);
}

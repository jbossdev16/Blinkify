#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..", "..");
const candidates = [
  path.join(root, "node_modules", "next", "dist", "bin", "next"),
  path.join(root, "node_modules", ".bin", "next"),
  path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next"),
  path.join(__dirname, "..", "node_modules", ".bin", "next"),
];

let bin;
for (const c of candidates) {
  if (fs.existsSync(c)) { bin = c; break; }
}

if (!bin) {
  console.error("[run-next] next binary not found. Searched:");
  candidates.forEach((c) => console.error("  -", c));
  console.error("\nRoot node_modules contents:");
  const nm = path.join(root, "node_modules");
  if (fs.existsSync(nm)) {
    const entries = fs.readdirSync(nm).filter((e) => e.startsWith("next") || e === ".bin");
    entries.forEach((e) => console.error("  ", e));
    const bin_dir = path.join(nm, ".bin");
    if (fs.existsSync(bin_dir)) {
      console.error("\nRoot .bin contents:");
      fs.readdirSync(bin_dir).filter((e) => e.includes("next")).forEach((e) => console.error("  ", e));
    }
  } else {
    console.error("  (directory does not exist)");
  }
  console.error("\nLocal node_modules:");
  const lnm = path.join(__dirname, "..", "node_modules");
  if (fs.existsSync(lnm)) {
    const entries = fs.readdirSync(lnm).filter((e) => e.startsWith("next") || e === ".bin");
    entries.forEach((e) => console.error("  ", e));
  } else {
    console.error("  (directory does not exist)");
  }
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

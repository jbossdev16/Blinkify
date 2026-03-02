/**
 * Load .env before any other app code. Must be the first import in index.ts
 * so Supabase and other libs see process.env when they initialize.
 * Resolves .env from the API package root (relative to entry script) so it
 * works regardless of process.cwd() (e.g. when turbo runs from monorepo root).
 */
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Entry script is src/index.ts (tsx) or dist/index.js (node); one level up = api package root
const entryDir = path.dirname(process.argv[1] ?? process.cwd());
const apiPackageRoot = path.resolve(entryDir, "..");
const envPath = path.join(apiPackageRoot, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  const cwd = process.cwd();
  const fallback = path.resolve(cwd, ".env");
  const fromRoot = path.resolve(cwd, "apps", "api", ".env");
  dotenv.config({ path: fs.existsSync(fromRoot) ? fromRoot : fallback });
}

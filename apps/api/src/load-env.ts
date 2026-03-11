/**
 * Load .env before any other app code. Must be the first import in index.ts
 * so Supabase and other libs see process.env when they initialize.
 * On Vercel, env is injected by the platform; skip file loading.
 */
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

if (process.env.VERCEL) {
  // Env vars come from Vercel project settings; no .env file.
} else {
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
}

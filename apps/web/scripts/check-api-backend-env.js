#!/usr/bin/env node
/**
 * When building the app.blinkify.ai project on Vercel, API_BACKEND_URL must be set
 * so Next.js rewrites proxy /auth/*, /workspaces/*, etc. Otherwise signup/login 404.
 * Marketing project (blinkify.ai) does not set NEXT_PUBLIC_APP_URL to app.blinkify.ai, so skip.
 */
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
const apiBackend = process.env.API_BACKEND_URL;
const isAppProject =
  appUrl.includes("app.blinkify.ai") || appUrl === "https://app.blinkify.ai";

if (process.env.VERCEL === "1" && isAppProject && !apiBackend) {
  console.error(
    "[blinkify-app] ERROR: API_BACKEND_URL is required for app.blinkify.ai but is not set."
  );
  console.error(
    "Set API_BACKEND_URL in Vercel → Project Settings → Environment Variables (e.g. https://blinkify-api.vercel.app), then redeploy."
  );
  process.exit(1);
}

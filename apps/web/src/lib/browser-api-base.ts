/**
 * Base URL for browser → Blinkify API (client components only).
 * - When NEXT_PUBLIC_API_URL is set: use it (direct to API).
 * - When unset in the browser: same-origin paths so Next rewrites (API_BACKEND_URL) can proxy.
 * - When unset during SSR prerender: localhost default for dev server-side callers.
 */
export function getBrowserApiBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  if (typeof window !== "undefined") return "";
  return "http://localhost:4001";
}

/** Join API path (must start with `/`) to the browser API base. */
export function browserApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getBrowserApiBaseUrl();
  return base ? `${base}${p}` : p;
}

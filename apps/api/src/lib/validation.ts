/** UUID v4 regex (hex digits and hyphens in the right places). */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Basic email format. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUuid(value: string): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export function isEmail(value: string): boolean {
  return typeof value === "string" && EMAIL_REGEX.test(value.trim());
}

/** Normalize email for storage and comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const INVITE_ROLES = ["member", "admin"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export function isInviteRole(value: string): value is InviteRole {
  return INVITE_ROLES.includes(value as InviteRole);
}

/** Validate URL for website analysis: https (or http) only, no localhost or private IPs. */
export function isAllowedWebsiteUrl(value: string): boolean {
  if (typeof value !== "string" || value.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost"))
    return false;
  if (/^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^192\.168\./.test(host))
    return false;
  return true;
}

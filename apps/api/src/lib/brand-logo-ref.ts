/**
 * When Supabase Storage rejects a type (e.g. SVG), we store the canonical HTTPS URL in
 * projects.brand_logo using this prefix instead of a storage path.
 */
export const EXTERNAL_BRAND_LOGO_PREFIX = "external:" as const;

const MAX_FETCH_BYTES = 5 * 1024 * 1024;

export function isExternalBrandLogoRef(ref: string | null | undefined): boolean {
  return typeof ref === "string" && ref.startsWith(EXTERNAL_BRAND_LOGO_PREFIX);
}

/** Returns https URL or null if ref is not a valid external logo reference. */
export function urlFromExternalBrandLogoRef(ref: string): string | null {
  if (!isExternalBrandLogoRef(ref)) return null;
  const url = ref.slice(EXTERNAL_BRAND_LOGO_PREFIX.length).trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;
  if (url.length > 4096) return null;
  return url;
}

export function externalBrandLogoRefFromUrl(url: string): string {
  return `${EXTERNAL_BRAND_LOGO_PREFIX}${url.trim()}`;
}

export function inferLogoMimeType(contentTypeHeader: string, sourceUrl: string): string {
  const ct = (contentTypeHeader || "").toLowerCase();
  if (ct.includes("svg")) return "image/svg+xml";
  if (ct.includes("png")) return "image/png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "image/jpeg";
  if (ct.includes("webp")) return "image/webp";
  if (ct.includes("gif")) return "image/gif";
  const path = (sourceUrl.split("?")[0] ?? "").toLowerCase();
  const ext = path.includes(".") ? (path.split(".").pop() ?? "png") : "png";
  const m: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  };
  return m[ext] ?? "image/png";
}

export async function fetchExternalBrandLogoBuffer(
  url: string
): Promise<{ buf: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BlinkifyBrandBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_FETCH_BYTES) return null;
    const contentType =
      (res.headers.get("content-type") ?? "").split(";")[0]!.trim() || "application/octet-stream";
    return { buf, contentType };
  } catch {
    return null;
  }
}

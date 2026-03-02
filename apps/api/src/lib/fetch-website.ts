import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 10_000;
const BODY_SNIPPET_MAX_CHARS = 2000;
const MAX_STYLESHEETS = 5;
const STYLESHEET_FETCH_TIMEOUT_MS = 3_000;

const HEX_6 = /^#[0-9a-fA-F]{6}$/;
const HEX_3 = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
const RGB = /^\s*rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;

/** Normalize 3-char hex or rgb() to 6-char hex; return null if not a solid color. */
export function styleValueToHex(value: string): string | null {
  const v = value.trim();
  if (/^var\(|^linear-gradient|^url\(/i.test(v)) return null;
  if (HEX_6.test(v)) return v;
  const m3 = v.match(HEX_3);
  if (m3)
    return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`;
  const mrgb = v.match(RGB);
  if (mrgb) {
    const r = Math.max(0, Math.min(255, parseInt(mrgb[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(mrgb[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(mrgb[3], 10)));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  return null;
}

/** Normalize theme-color or any hex to 6-char; return null if invalid. */
function normalizeHexTo6(hex: string | undefined): string | null {
  if (!hex || !hex.trim()) return null;
  const out = styleValueToHex(hex.trim());
  return out && HEX_6.test(out) ? out : null;
}

function parseInlineStyleForColor(style: string | undefined, prefer: "background" | "color"): string | null {
  if (!style || !style.trim()) return null;
  let bg: string | null = null;
  let color: string | null = null;
  const parts = style.split(";");
  for (const p of parts) {
    const idx = p.indexOf(":");
    if (idx <= 0) continue;
    const prop = p.slice(0, idx).trim().toLowerCase().replace(/-/g, "");
    const val = p.slice(idx + 1).trim();
    const hex = styleValueToHex(val);
    if (!hex) continue;
    if (prop === "backgroundcolor" || prop === "background") bg = hex;
    else if (prop === "color") color = hex;
  }
  return prefer === "background" ? bg ?? color : color ?? bg;
}

export interface WebsiteExtract {
  title: string;
  description: string;
  ogDescription: string;
  ogImage: string;
  /** Best logo URL for brand: og:image, then apple-touch-icon/icon, then /favicon.ico */
  suggestedLogoUrl: string;
  /** URL best suited for color extraction (actual logo): apple-touch-icon, then icon, then favicon. Prefer over og:image so colors come from the logo, not a social preview. */
  logoUrlForColors: string;
  themeColor: string;
  siteName: string;
  bodySnippet: string;
  /** Main font from site (e.g. from Google Fonts link family= parameter). */
  primaryFont?: string;
  /** Background color from body or main container (inline style or inline <style>). */
  backgroundColor?: string;
  /** CTA/button color from button-like elements (inline style). */
  ctaColor?: string;
}

/**
 * Fetch a URL and parse HTML for meta tags and a short body snippet.
 * Caller must validate URL (https only, no localhost) before calling.
 */
export async function fetchAndParseWebsite(url: string): Promise<WebsiteExtract> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BlinkifyBrandBot/1.0; +https://blinkify.com)",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error("URL did not return HTML");
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const getMeta = (selector: string): string =>
      $(selector).attr("content")?.trim() ?? "";
    const title = $("title").first().text().trim();
    const description =
      getMeta('meta[name="description"]') ||
      getMeta('meta[property="og:description"]');
    const ogImage =
      getMeta('meta[property="og:image"]') ||
      getMeta('meta[name="twitter:image"]');
    const appleTouchIcon = $('link[rel="apple-touch-icon"]').attr("href")?.trim();
    const icon = $('link[rel="icon"]').attr("href")?.trim();
    const faviconFallback = resolveUrl("/favicon.ico", url);
    const ogResolved = resolveUrl(ogImage, url);
    const appleResolved = appleTouchIcon ? resolveUrl(appleTouchIcon, url) : "";
    const iconResolved = icon ? resolveUrl(icon, url) : "";

    let pageLogoUrl = "";
    $("img").each((_, el) => {
      if (pageLogoUrl) return;
      const $el = $(el);
      const src = $el.attr("src")?.trim();
      const alt = ($el.attr("alt") ?? "").toLowerCase();
      const cls = ($el.attr("class") ?? "").toLowerCase();
      const id = ($el.attr("id") ?? "").toLowerCase();
      const parentCls = ($el.parent().attr("class") ?? "").toLowerCase();
      const parentId = ($el.parent().attr("id") ?? "").toLowerCase();
      const isLogo =
        src &&
        (/\blogo\b/.test(alt) ||
          /\blogo\b/.test(cls) ||
          /\blogo\b/.test(id) ||
          /\blogo\b/.test(parentCls) ||
          /\blogo\b/.test(parentId) ||
          $el.closest("[class*='logo' i], [id*='logo' i]").length > 0);
      if (isLogo) pageLogoUrl = resolveUrl(src!, url);
    });
    if (!pageLogoUrl && $('header img[src], [role="banner"] img[src]').length > 0) {
      const first = $('header img[src], [role="banner"] img[src]').first().attr("src")?.trim();
      if (first) pageLogoUrl = resolveUrl(first, url);
    }

    const suggestedLogoUrl =
      pageLogoUrl ||
      ogResolved ||
      appleResolved ||
      iconResolved ||
      faviconFallback;
    const logoUrlForColors =
      appleResolved ||
      iconResolved ||
      faviconFallback ||
      pageLogoUrl ||
      ogResolved;
    const rawTheme =
      getMeta('meta[name="theme-color"]') ||
      getMeta('meta[name="msapplication-TileColor"]');
    const themeColor = (rawTheme ? normalizeHexTo6(rawTheme) ?? rawTheme : "") as string;
    const siteName =
      getMeta('meta[property="og:site_name"]') ||
      title;

    let bodySnippet = "";
    const main =
      $("main").first().text() ||
      $('article').first().text() ||
      $("body").text();
    if (main) {
      bodySnippet = main
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, BODY_SNIPPET_MAX_CHARS);
    }

    let primaryFont: string | undefined;
    $('link[rel="stylesheet"]').each((_, el) => {
      if (primaryFont) return;
      const href = $(el).attr("href") ?? "";
      if (!href.includes("fonts.googleapis.com")) return;
      const match = href.match(/family=([^&]+)/i);
      if (match?.[1]) {
        const decoded = decodeURIComponent(match[1].trim().replace(/\+/g, " ")).split(",")[0]?.trim();
        if (decoded) primaryFont = decoded;
      }
    });

    let backgroundColor: string | undefined;
    const bodyStyle = $("body").attr("style");
    const bodyBg = parseInlineStyleForColor(bodyStyle ?? undefined, "background");
    if (bodyBg && HEX_6.test(bodyBg)) backgroundColor = bodyBg;
    if (!backgroundColor) {
      $("style").each((_, el) => {
        if (backgroundColor) return;
        const text = $(el).html() ?? "";
        const bodyMatch = text.match(/body\s*\{[^}]*background(?:-color)?\s*:\s*([#\w(),\s.]+)/i);
        if (bodyMatch?.[1]) {
          const hex = styleValueToHex(bodyMatch[1].trim());
          if (hex && HEX_6.test(hex)) backgroundColor = hex;
        }
      });
    }

    let ctaColor: string | undefined;
    const buttonSelectors = "button, [role='button'], a[class*='btn'], a[class*='button'], a[class*='cta'], [class*='btn-primary'], [class*='button--primary']";
    $(buttonSelectors).each((_, el) => {
      if (ctaColor) return;
      const style = $(el).attr("style");
      const hex = parseInlineStyleForColor(style ?? undefined, "background") ?? parseInlineStyleForColor(style ?? undefined, "color");
      if (hex && HEX_6.test(hex)) ctaColor = hex;
    });

    const stylesheetHrefs: string[] = [];
    $('link[rel="stylesheet"]').each((_, el) => {
      if (stylesheetHrefs.length >= MAX_STYLESHEETS) return;
      const href = $(el).attr("href")?.trim();
      if (href && !href.startsWith("data:")) stylesheetHrefs.push(resolveUrl(href, url));
    });
    if (stylesheetHrefs.length > 0) {
      const sheets = await Promise.all(stylesheetHrefs.map((href) => fetchStylesheet(href)));
      for (const css of sheets) {
        if (!css) continue;
        const parsed = parseCssForColors(css);
        if (!backgroundColor && parsed.backgroundColor) backgroundColor = parsed.backgroundColor;
        if (!ctaColor && parsed.ctaColor) ctaColor = parsed.ctaColor;
        if (backgroundColor && ctaColor) break;
      }
    }

    return {
      title,
      description,
      ogDescription: getMeta('meta[property="og:description"]'),
      ogImage: ogResolved,
      suggestedLogoUrl: suggestedLogoUrl || ogResolved,
      logoUrlForColors: logoUrlForColors || suggestedLogoUrl || ogResolved,
      themeColor,
      siteName,
      bodySnippet,
      primaryFont: primaryFont || undefined,
      backgroundColor: backgroundColor || undefined,
      ctaColor: ctaColor || undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveUrl(href: string, base: string): string {
  if (!href) return "";
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function parseCssForColors(css: string): { backgroundColor?: string; ctaColor?: string } {
  const out: { backgroundColor?: string; ctaColor?: string } = {};
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const bodyBgMatch = noComments.match(
    /(?:body|html|#root|#__next|main)\s*\{[\s\S]*?background(?:-color)?\s*:\s*([^;}]+)/i
  );
  if (bodyBgMatch?.[1]) {
    const hex = styleValueToHex(bodyBgMatch[1].trim());
    if (hex && HEX_6.test(hex)) out.backgroundColor = hex;
  }
  const buttonMatch = noComments.match(
    /(?:button|\.btn|\.button|\.cta|\[class\*=["']?btn)[\s\S]*?\{[\s\S]*?(?:background(?:-color)?|color)\s*:\s*([^;}]+)/i
  );
  if (buttonMatch?.[1]) {
    const hex = styleValueToHex(buttonMatch[1].trim());
    if (hex && HEX_6.test(hex)) out.ctaColor = hex;
  }
  return out;
}

async function fetchStylesheet(href: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STYLESHEET_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(href, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BlinkifyBrandBot/1.0; +https://blinkify.com)",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("text/css") && !ct.toLowerCase().includes("text/plain")) return "";
    return await res.text();
  } catch {
    clearTimeout(timeout);
    return "";
  }
}

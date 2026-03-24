import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 10_000;
const BODY_SNIPPET_MAX_CHARS = 4000;
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
  /** Best logo URL for brand (prefers raster so uploads/API accept it). */
  suggestedLogoUrl: string;
  /** First non-SVG candidate for storage and vision APIs; empty if only SVG/data URLs exist. */
  suggestedRasterLogoUrl: string;
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
  url?: string;
  aboutSnippet?: string;
  isShopify?: boolean;
  shopifyProducts?: string;
  socialLinks?: {
    instagram?: string;
    tiktok?: string;
    facebook?: string;
    x?: string;
    linkedin?: string;
    pinterest?: string;
    youtube?: string;
    contact_email?: string;
    address?: string;
  };
}

/**
 * Fetch a URL and parse HTML for meta tags and a short body snippet.
 * Caller must validate URL (https only, no localhost) before calling.
 */
const SECONDARY_PAGE_TIMEOUT_MS = 5_000;
const SHOPIFY_PRODUCTS_TIMEOUT_MS = 5_000;
const ABOUT_SNIPPET_MAX_CHARS = 2000;
const SHOPIFY_PRODUCTS_MAX_CHARS = 1500;

const UA_BOT =
  "Mozilla/5.0 (compatible; BlinkifyBrandBot/1.0; +https://blinkify.com)";
/** Some hosts block non-browser user agents; retry with a common Chrome UA. */
const UA_BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const HTML_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

/** Thrown when the public URL cannot be fetched or parsed for brand analysis (caller maps to 422). */
export class WebsiteFetchError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 0) {
    super(message);
    this.name = "WebsiteFetchError";
    this.statusCode = statusCode;
  }
}

function messageForHttpStatus(status: number): string {
  if (status === 403 || status === 401) {
    return "This website blocked automated access (often bot protection or a login wall). Try a different URL or enter your brand details manually.";
  }
  if (status === 404) {
    return "That page was not found (404). Check the URL and try again.";
  }
  if (status === 429) {
    return "The site is rate-limiting requests. Wait a minute and try again, or use another URL.";
  }
  if (status >= 500) {
    return "The website server returned an error. Try again later or use another URL.";
  }
  return `Could not load this URL (HTTP ${status}). Try another link or enter your brand details manually.`;
}

async function fetchPageResponse(
  url: string,
  signal: AbortSignal
): Promise<Response> {
  const commonHeaders: Record<string, string> = {
    Accept: HTML_ACCEPT,
    "Accept-Language": "en-US,en;q=0.9",
  };

  let res = await fetch(url, {
    signal,
    headers: { "User-Agent": UA_BOT, ...commonHeaders },
    redirect: "follow",
  });

  if (
    !res.ok &&
    (res.status === 403 || res.status === 401)
  ) {
    res = await fetch(url, {
      signal,
      headers: { "User-Agent": UA_BROWSER, ...commonHeaders },
      redirect: "follow",
    });
  }

  return res;
}

function isLikelySvgUrl(imageUrl: string): boolean {
  if (!imageUrl) return false;
  const lower = imageUrl.split("?")[0].toLowerCase();
  if (lower.endsWith(".svg")) return true;
  if (lower.startsWith("data:image/svg")) return true;
  return false;
}

function cleanTitleForBrandName(rawTitle: string): string {
  const t = rawTitle.trim();
  if (!t) return "";
  const parts = t.split(/\s*[|\u2013\u2014]\s*/).map((s) => s.trim());
  const first = parts[0] || t;
  return first.length > 80 ? first.slice(0, 80).trim() : first;
}

function normalizeLdType(t: unknown): string[] {
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function collectLdNames(node: unknown, names: string[]): void {
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (Array.isArray(o["@graph"])) {
    for (const g of o["@graph"]) collectLdNames(g, names);
  }
  const types = normalizeLdType(o["@type"]);
  const isBrandish = types.some((type) =>
    /Organization|Corporation|Brand|WebSite|LocalBusiness|SoftwareApplication|ProfessionalService|OnlineStore|Restaurant/i.test(
      type
    )
  );
  if (isBrandish && typeof o.name === "string") {
    const n = o.name.trim();
    if (n && n.length <= 120 && !/^https?:\/\//i.test(n)) names.push(n);
  }
  if (typeof o.alternateName === "string") {
    const n = o.alternateName.trim();
    if (n && n.length <= 120 && !/^https?:\/\//i.test(n)) names.push(n);
  }
  const pub = o.publisher;
  if (pub && typeof pub === "object") collectLdNames(pub, names);
  const parent = o.parentOrganization;
  if (parent && typeof parent === "object") collectLdNames(parent, names);
}

function extractJsonLdBrandNames($: cheerio.CheerioAPI): string[] {
  const names: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (!raw?.trim()) return;
      const data = JSON.parse(raw.trim()) as unknown;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) collectLdNames(item, names);
    } catch {
      // ignore invalid JSON-LD
    }
  });
  return [...new Set(names)];
}

function hostnameBrandLabel(hostname: string): string {
  const base = hostname.replace(/^www\./i, "").split(".")[0] ?? "";
  if (!base) return "";
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

function pickBestSiteName(opts: {
  jsonLdNames: string[];
  applicationName: string;
  ogSiteName: string;
  ogTitle: string;
  twitterTitle: string;
  title: string;
  hostname: string;
}): string {
  const { jsonLdNames, applicationName, ogSiteName, ogTitle, twitterTitle, title, hostname } = opts;
  const clean = (s: string) => s.trim();
  for (const n of jsonLdNames) {
    if (n && n.length <= 80) return n.slice(0, 80);
  }
  if (applicationName) return clean(applicationName).slice(0, 80);
  if (ogSiteName) return clean(ogSiteName).slice(0, 80);
  const ogClean = cleanTitleForBrandName(ogTitle);
  if (ogClean) return ogClean;
  if (twitterTitle) return clean(twitterTitle).slice(0, 80);
  const titleClean = cleanTitleForBrandName(title);
  if (titleClean) return titleClean;
  const fromHost = hostnameBrandLabel(hostname);
  if (fromHost) return fromHost;
  return clean(title).slice(0, 80) || "Brand";
}

export async function fetchAndParseWebsite(url: string): Promise<WebsiteExtract> {
  const normalizedUrl = (() => {
    try {
      return new URL(url).href;
    } catch {
      return url;
    }
  })();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetchPageResponse(url, controller.signal);
    clearTimeout(timeout);

    if (!res.ok) {
      throw new WebsiteFetchError(messageForHttpStatus(res.status), res.status);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new WebsiteFetchError(
        "That URL did not return a web page (HTML). Use your store’s public homepage URL.",
        0
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    let isShopify = false;
    const canonicalHref = $('link[rel="canonical"]').attr("href") ?? "";
    const generator = $('meta[name="generator"]').attr("content") ?? "";
    if (
      canonicalHref.includes("myshopify.com") ||
      generator.includes("Shopify") ||
      html.includes("cdn.shopify.com") ||
      html.includes("window.Shopify")
    ) {
      isShopify = true;
    }

    let shopifyProducts: string | undefined;
    if (isShopify) {
      try {
        const productsUrl = new URL("/products.json", normalizedUrl).href;
        const prodController = new AbortController();
        const prodTimeout = setTimeout(() => prodController.abort(), SHOPIFY_PRODUCTS_TIMEOUT_MS);
        const prodRes = await fetch(productsUrl, {
          signal: prodController.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; BlinkifyBrandBot/1.0; +https://blinkify.com)",
          },
          redirect: "follow",
        });
        clearTimeout(prodTimeout);
        if (prodRes.ok) {
          const data = (await prodRes.json()) as { products?: Array<{ title?: string; body_html?: string }> };
          const products = Array.isArray(data?.products) ? data.products : [];
          const parts: string[] = [];
          for (const p of products.slice(0, 10)) {
            const title = (p.title ?? "").trim();
            const body = (p.body_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            if (title) parts.push(`${title}${body ? `: ${body}` : ""}`);
          }
          const joined = parts.join(" ");
          if (joined) shopifyProducts = joined.slice(0, SHOPIFY_PRODUCTS_MAX_CHARS);
        }
      } catch {
        // ignore
      }
    }

    const getMeta = (selector: string): string =>
      $(selector).attr("content")?.trim() ?? "";
    const title = $("title").first().text().trim();
    let hostname = "";
    try {
      hostname = new URL(normalizedUrl).hostname;
    } catch {
      hostname = "";
    }
    const description =
      getMeta('meta[name="description"]') ||
      getMeta('meta[property="og:description"]');
    const ogImage =
      getMeta('meta[property="og:image"]') ||
      getMeta('meta[name="twitter:image"]');
    const faviconFallback = resolveUrl("/favicon.ico", url);
    const ogResolved = resolveUrl(ogImage, url);

    const appleUrls: string[] = [];
    $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => {
      const href = $(el).attr("href")?.trim();
      if (href) appleUrls.push(resolveUrl(href, url));
    });
    const appleResolved =
      appleUrls.find((u) => u && !isLikelySvgUrl(u)) || appleUrls[0] || "";

    const iconUrls: string[] = [];
    $('link[rel="icon"], link[rel="shortcut icon"]').each((_, el) => {
      const href = $(el).attr("href")?.trim();
      if (href) iconUrls.push(resolveUrl(href, url));
    });
    const iconResolved =
      iconUrls.find((u) => u && !isLikelySvgUrl(u)) || iconUrls[0] || "";

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

    const rasterPriority = [appleResolved, iconResolved, faviconFallback, ogResolved, pageLogoUrl].filter(
      Boolean
    ) as string[];
    const suggestedRasterLogoUrl = rasterPriority.find((u) => !isLikelySvgUrl(u)) || "";

    const displayOrder = [pageLogoUrl, ogResolved, appleResolved, iconResolved, faviconFallback].filter(
      Boolean
    ) as string[];
    const suggestedLogoUrl =
      suggestedRasterLogoUrl ||
      displayOrder.find((u) => !isLikelySvgUrl(u)) ||
      displayOrder[0] ||
      "";

    const logoUrlForColors =
      appleResolved ||
      iconResolved ||
      faviconFallback ||
      (!isLikelySvgUrl(pageLogoUrl) ? pageLogoUrl : "") ||
      ogResolved;
    const rawTheme =
      getMeta('meta[name="theme-color"]') ||
      getMeta('meta[name="msapplication-TileColor"]');
    const themeColor = (rawTheme ? normalizeHexTo6(rawTheme) ?? rawTheme : "") as string;
    const applicationName = getMeta('meta[name="application-name"]');
    const ogSiteName = getMeta('meta[property="og:site_name"]');
    const ogTitle = getMeta('meta[property="og:title"]');
    const twitterTitle = getMeta('meta[name="twitter:title"]');
    const siteName = pickBestSiteName({
      jsonLdNames: extractJsonLdBrandNames($),
      applicationName,
      ogSiteName,
      ogTitle,
      twitterTitle,
      title,
      hostname,
    });

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

    function mergeSocialLinks(
      a: NonNullable<WebsiteExtract["socialLinks"]> | undefined,
      b: NonNullable<WebsiteExtract["socialLinks"]> | undefined
    ): NonNullable<WebsiteExtract["socialLinks"]> | undefined {
      if (!a && !b) return undefined;
      const out: NonNullable<WebsiteExtract["socialLinks"]> = { ...(a ?? {}) };
      for (const [k, v] of Object.entries(b ?? {})) {
        if (!v) continue;
        const key = k as keyof NonNullable<WebsiteExtract["socialLinks"]>;
        if (!out[key]) out[key] = v;
      }
      return out;
    }

    let socialLinks = extractSocialLinks($, normalizedUrl);
    let aboutSnippet: string | undefined;
    const secondaryPaths = [
      "/about",
      "/about-us",
      "/our-story",
      "/pages/about",
      "/pages/our-story",
      "/services",
      "/what-we-do",
      "/work",
      "/menu",
      "/products",
    ];
    const ua = "Mozilla/5.0 (compatible; BlinkifyBrandBot/1.0; +https://blinkify.com)";
    for (const path of secondaryPaths) {
      try {
        const secUrl = new URL(path, normalizedUrl).href;
        const secController = new AbortController();
        const secTimeout = setTimeout(() => secController.abort(), SECONDARY_PAGE_TIMEOUT_MS);
        const secRes = await fetch(secUrl, {
          signal: secController.signal,
          headers: { "User-Agent": ua },
          redirect: "follow",
        });
        clearTimeout(secTimeout);
        if (!secRes.ok) continue;
        const secCt = secRes.headers.get("content-type") ?? "";
        if (!secCt.toLowerCase().includes("text/html")) continue;
        const secHtml = await secRes.text();
        const $sec = cheerio.load(secHtml);
        socialLinks = mergeSocialLinks(socialLinks, extractSocialLinks($sec, secUrl));
        const secMain =
          $sec("main").first().text() ||
          $sec("article").first().text() ||
          $sec("body").text();
        if (secMain) {
          aboutSnippet = secMain
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, ABOUT_SNIPPET_MAX_CHARS);
          break;
        }
      } catch {
        // continue to next path
      }
    }

    return {
      url: normalizedUrl,
      title,
      description,
      ogDescription: getMeta('meta[property="og:description"]'),
      ogImage: ogResolved,
      suggestedLogoUrl: suggestedLogoUrl || ogResolved,
      suggestedRasterLogoUrl: suggestedRasterLogoUrl || (suggestedLogoUrl && !isLikelySvgUrl(suggestedLogoUrl) ? suggestedLogoUrl : ""),
      logoUrlForColors: logoUrlForColors || suggestedLogoUrl || ogResolved,
      themeColor,
      siteName,
      bodySnippet,
      primaryFont: primaryFont || undefined,
      backgroundColor: backgroundColor || undefined,
      ctaColor: ctaColor || undefined,
      aboutSnippet: aboutSnippet || undefined,
      isShopify: isShopify || undefined,
      shopifyProducts: shopifyProducts || undefined,
      socialLinks: socialLinks || undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSocialUrl(href: string, base: string): string | null {
  if (!href) return null;
  const raw = href.trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) return null;
  if (raw.startsWith("mailto:")) return raw;
  const resolved = resolveUrl(raw, base);
  if (!/^https?:\/\//i.test(resolved)) return null;
  return resolved;
}

function extractSocialLinks(
  $: cheerio.CheerioAPI,
  base: string
): NonNullable<WebsiteExtract["socialLinks"]> | undefined {
  const out: NonNullable<WebsiteExtract["socialLinks"]> = {};
  const candidates: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) candidates.push(href);
  });
  for (const href of candidates) {
    const normalized = normalizeSocialUrl(href, base);
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (!out.instagram && /instagram\.com\//.test(lower)) out.instagram = normalized;
    else if (!out.tiktok && /tiktok\.com\//.test(lower)) out.tiktok = normalized;
    else if (!out.facebook && /facebook\.com\//.test(lower)) out.facebook = normalized;
    else if (!out.x && (/(^https?:\/\/x\.com\/)/.test(lower) || /twitter\.com\//.test(lower))) out.x = normalized;
    else if (!out.linkedin && /linkedin\.com\//.test(lower)) out.linkedin = normalized;
    else if (!out.pinterest && /pinterest\./.test(lower)) out.pinterest = normalized;
    else if (!out.youtube && /(youtube\.com\/|youtu\.be\/)/.test(lower)) out.youtube = normalized;
    else if (!out.contact_email && lower.startsWith("mailto:")) {
      const email = normalized.replace(/^mailto:/i, "").split("?")[0]?.trim();
      if (email) out.contact_email = email;
    }
  }

  if (!out.contact_email) {
    const emailText = $("a[href^='mailto:']").first().attr("href") ?? "";
    const email = emailText.replace(/^mailto:/i, "").split("?")[0]?.trim();
    if (email) out.contact_email = email;
  }

  const addressCandidate =
    $("address").first().text().trim() ||
    $("[itemprop='address']").first().text().trim() ||
    $("[class*='address' i], [id*='address' i]").first().text().trim();
  if (addressCandidate) {
    const collapsed = addressCandidate.replace(/\s+/g, " ").trim().slice(0, 240);
    if (collapsed) out.address = collapsed;
  }

  return Object.keys(out).length > 0 ? out : undefined;
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

function isNearWhite(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.7;
}

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function buildCssColors(extract: WebsiteExtract): string[] {
  const colors: string[] = [];
  if (
    extract.themeColor &&
    isValidHex(extract.themeColor) &&
    !isNearWhite(extract.themeColor)
  ) {
    colors.push(extract.themeColor);
  }
  if (
    extract.ctaColor &&
    isValidHex(extract.ctaColor) &&
    extract.ctaColor !== extract.themeColor &&
    !isNearWhite(extract.ctaColor)
  ) {
    colors.push(extract.ctaColor);
  }
  if (
    extract.backgroundColor &&
    isValidHex(extract.backgroundColor) &&
    extract.backgroundColor !== extract.themeColor &&
    extract.backgroundColor !== extract.ctaColor &&
    !isNearWhite(extract.backgroundColor)
  ) {
    colors.push(extract.backgroundColor);
  }
  return colors;
}

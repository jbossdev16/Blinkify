/** Client-built marketing email HTML (Creative Studio email tool). Inline CSS only; no <style> tags. */

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(s: string): string {
  return esc(s).replace(/'/g, "&#39;");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return { r: 59, g: 130, b: 246 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function isLightHex(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq > 180;
}

function socialIconSvg(platform: string, color: string): string {
  const c = escAttr(color);
  switch (platform) {
    case "instagram":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
    case "tiktok":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="${c}"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.73a8.19 8.19 0 0 0 4.79 1.52V6.8a4.85 4.85 0 0 1-1.02-.11z"/></svg>`;
    case "facebook":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="${c}"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`;
    case "x":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="${c}"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
    case "linkedin":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="${c}"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>`;
    case "pinterest":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="${c}"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.236 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.181-.78 1.172-4.97 1.172-4.97s-.299-.598-.299-1.482c0-1.388.806-2.428 1.808-2.428.852 0 1.264.64 1.264 1.408 0 .858-.546 2.141-.828 3.33-.236.995.499 1.806 1.476 1.806 1.772 0 3.136-1.867 3.136-4.562 0-2.387-1.715-4.054-4.163-4.054-2.833 0-4.497 2.124-4.497 4.32 0 .856.33 1.772.741 2.273a.3.3 0 0 1 .069.286c-.076.313-.244.995-.277 1.134-.044.183-.146.222-.337.134-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.473 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.966-.527-2.292-1.148l-.623 2.378c-.226.869-.835 1.958-1.244 2.621.937.29 1.931.446 2.962.446 5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>`;
    case "youtube":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="${c}"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20.06 12 20.06 12 20.06s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon fill="#ffffff" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>`;
    default:
      return "";
  }
}

export interface StandaloneEmailHtmlInput {
  subjectLine: string;
  headline: string;
  introCopy: string;
  closingCopy: string;
  ctaText: string;
  ctaUrl: string;
  footerTagline?: string;
  imageUrls: string[];
  numberOfImages: 1 | 2 | 3;
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  websiteUrl: string;
  logoUrl: string | null;
  socialLinks: Record<string, string>;
  fontFamily: string;
}

export function buildStandaloneMarketingEmailHtml(input: StandaloneEmailHtmlInput): string {
  const {
    subjectLine,
    headline,
    introCopy,
    closingCopy,
    ctaText,
    ctaUrl,
    footerTagline = "",
    imageUrls,
    numberOfImages,
    brandName,
    primaryColor,
    secondaryColor,
    websiteUrl,
    logoUrl,
    socialLinks,
    fontFamily,
  } = input;

  const p = /^#[0-9a-fA-F]{3,8}$/.test(primaryColor.trim()) ? primaryColor.trim() : "#3b82f6";
  const s = /^#[0-9a-fA-F]{3,8}$/.test(secondaryColor.trim()) ? secondaryColor.trim() : "#f8f8f8";
  const headerText = isLightHex(p) ? "#1a1a1a" : "#ffffff";
  const outerBg = isLightHex(s) && s.toLowerCase() !== "#ffffff" ? s : "#f8f8f8";
  const { r, g, b } = hexToRgb(p);
  const footerBg = `rgba(${r},${g},${b},0.15)`;

  const previewText = esc(introCopy.slice(0, 90) || subjectLine);
  const n = Math.min(3, Math.max(1, numberOfImages)) as 1 | 2 | 3;
  const urls = imageUrls.slice(0, n).map((u) => escAttr(u));

  const base = websiteUrl.trim().replace(/\/$/, "") || "";
  const ctaHref = escAttr(ctaUrl.trim() && ctaUrl !== "#" ? ctaUrl : websiteUrl || "#");
  const unsubHref = escAttr(base ? `${base}/unsubscribe` : "#");

  const socialKeys = ["instagram", "tiktok", "facebook", "x", "linkedin", "pinterest", "youtube"] as const;
  const socialRows = socialKeys
    .filter((k) => socialLinks[k]?.trim())
    .map((k) => {
      const href = escAttr(socialLinks[k]!.trim());
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 6px;text-decoration:none;">${socialIconSvg(k, p)}</a>`;
    })
    .join("");

  const socialSection =
    socialRows.length > 0
      ? `<tr><td style="background:#ffffff;padding:24px 40px;text-align:center;font-family:${escAttr(fontFamily)};"><p style="margin:0 0 16px;font-size:13px;color:#999999;text-transform:uppercase;letter-spacing:1px;">Follow Us</p><div style="text-align:center;line-height:0;">${socialRows}</div></td></tr>`
      : "";

  const email = socialLinks.contact_email?.trim();
  const addr = socialLinks.address?.trim();
  const contactBlock = email
    ? `<p style="margin:8px 0 0;font-size:12px;color:#888888;"><a href="mailto:${escAttr(email)}" style="color:#888888;text-decoration:underline;">${esc(email)}</a></p>`
    : "";
  const addrBlock = addr
    ? `<p style="margin:6px 0 0;font-size:11px;color:#999999;font-style:italic;">${esc(addr)}</p>`
    : "";

  const logoBlock = logoUrl
    ? `<tr><td align="center" style="padding:20px 16px;background-color:${escAttr(p)};border-bottom:3px solid rgba(0,0,0,0.15);"><img src="${escAttr(logoUrl)}" alt="" style="max-height:48px;width:auto;max-width:200px;display:block;margin:0 auto;border:0;height:auto;" /></td></tr>`
    : `<tr><td align="center" style="padding:20px 16px;background-color:${escAttr(p)};border-bottom:3px solid rgba(0,0,0,0.15);font-family:${escAttr(fontFamily)};font-size:22px;font-weight:700;color:${headerText};">${esc(brandName)}</td></tr>`;

  const img = (src: string) =>
    src
      ? `<tr><td style="padding:0;font-size:0;line-height:0;"><img src="${src}" width="600" alt="" style="width:100%;max-width:600px;display:block;border:0;border-radius:8px;" /></td></tr>`
      : "";

  let contentRows = "";
  if (n === 1) {
    contentRows = [
      img(urls[0] ?? ""),
      `<tr><td style="background:#ffffff;padding:40px;font-family:${escAttr(fontFamily)};"><h1 style="margin:0 0 12px;font-size:28px;font-weight:700;color:${escAttr(p)};">${esc(headline)}</h1><p style="margin:0 0 24px;font-size:16px;color:#555555;line-height:1.5;">${esc(introCopy.split("\n")[0] ?? "").slice(0, 200)}</p><p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.7;">${esc(introCopy).replace(/\n/g, "<br />")}</p>${closingCopy.trim() ? `<p style="margin:0;font-size:15px;color:#333333;line-height:1.7;">${esc(closingCopy).replace(/\n/g, "<br />")}</p>` : ""}</td></tr>`,
    ].join("");
  } else if (n === 2) {
    contentRows = [
      img(urls[0] ?? ""),
      `<tr><td style="background:#ffffff;padding:40px;font-family:${escAttr(fontFamily)};"><h1 style="margin:0 0 12px;font-size:28px;font-weight:700;color:${escAttr(p)};">${esc(headline)}</h1><p style="margin:0 0 24px;font-size:16px;color:#555555;line-height:1.5;">${esc(introCopy.split("\n")[0] ?? "").slice(0, 200)}</p><p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.7;">${esc(introCopy).replace(/\n/g, "<br />")}</p></td></tr>`,
      img(urls[1] ?? ""),
      `<tr><td style="background:#ffffff;padding:0 40px 40px;font-family:${escAttr(fontFamily)};"><p style="margin:0;font-size:15px;color:#333333;line-height:1.7;">${esc(closingCopy).replace(/\n/g, "<br />")}</p></td></tr>`,
    ].join("");
  } else {
    contentRows = [
      img(urls[0] ?? ""),
      `<tr><td style="background:#ffffff;padding:40px;font-family:${escAttr(fontFamily)};"><h1 style="margin:0 0 12px;font-size:28px;font-weight:700;color:${escAttr(p)};">${esc(headline)}</h1><p style="margin:0 0 24px;font-size:16px;color:#555555;line-height:1.5;">${esc(introCopy.split("\n")[0] ?? "").slice(0, 200)}</p><p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.7;">${esc(introCopy).replace(/\n/g, "<br />")}</p></td></tr>`,
      img(urls[1] ?? ""),
      `<tr><td style="background:#ffffff;padding:0 40px 20px;font-family:${escAttr(fontFamily)};"><p style="margin:0;font-size:15px;color:#333333;line-height:1.7;">${esc(closingCopy).replace(/\n/g, "<br />")}</p></td></tr>`,
      img(urls[2] ?? ""),
    ].join("");
  }

  const ctaRow = `<tr><td style="background:#f9f9f9;padding:30px 40px;text-align:center;font-family:${escAttr(fontFamily)};"><a href="${ctaHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:16px 40px;background-color:${escAttr(p)};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">${esc(ctaText || "Shop now")}</a></td></tr>`;

  const footerRow = `<tr><td style="background:${footerBg};padding:30px 40px;text-align:center;font-family:${escAttr(fontFamily)};"><p style="margin:0;font-size:15px;font-weight:700;color:${escAttr(p)};">${esc(brandName)}</p>${footerTagline ? `<p style="margin:6px 0 0;font-size:13px;color:#666666;">${esc(footerTagline)}</p>` : ""}${contactBlock}${addrBlock}<hr style="border:none;border-top:1px solid #eeeeee;margin:16px 0;" /><p style="font-size:11px;color:#aaaaaa;text-align:center;margin:0;">You received this email because you signed up for updates from ${esc(brandName)}. <a href="${unsubHref}" style="color:#aaaaaa;text-decoration:underline;">Unsubscribe</a> at any time.</p><p style="font-size:11px;color:#bbbbbb;text-align:center;margin:8px 0 0 0;">© ${new Date().getFullYear()} ${esc(brandName)}. All rights reserved.</p></td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>${esc(subjectLine || "Email")}</title>
</head>
<body style="margin:0;padding:0;font-family:${escAttr(fontFamily)};background:${escAttr(outerBg)};">
<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${escAttr(outerBg)};">
<tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
<tbody>
${logoBlock}
${contentRows}
${ctaRow}
<tr><td style="padding:0;"><hr style="border:none;border-top:1px solid #eeeeee;margin:0;" /></td></tr>
${socialSection}
${footerRow}
</tbody>
</table>
</td></tr>
</table>
</body>
</html>`;
}

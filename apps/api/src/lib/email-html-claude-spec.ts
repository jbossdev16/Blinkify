/**
 * Instruction block for Claude: professional marketing email HTML (full campaign).
 * Embedded in buildContentUserPrompt; values are real hex codes for the brand.
 */
export function buildEmailHtmlTemplateSpec(
  primaryColorHex: string,
  secondaryColorHex: string
): string {
  const p = primaryColorHex;
  const s = secondaryColorHex;
  return [
    "Generate a complete, professional HTML marketing email following ALL specifications exactly.",
    "",
    "TECHNICAL REQUIREMENTS:",
    "- Max width: 600px, centered",
    "- All CSS must be inline only — NO <style> tags, NO external CSS, NO class names",
    "- Compatible with Gmail, Outlook, Apple Mail, Yahoo Mail",
    "- Mobile responsive: max-width and percentage widths on tables/images",
    "- Full document from <!DOCTYPE html> to </html>",
    `- Outer background: use ${s} or #f8f8f8 if secondary is very light, or #1a1a1a if primary ${p} is a light/pastel brand (choose readable contrast)`,
    "",
    "EXACT STRUCTURE:",
    "",
    "1. PREHEADER (hidden preview): single div with display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden; containing the exact preview_text value (HTML-escape). Do NOT use placeholder {{PREVIEW_TEXT}} in output — substitute real preview text.",
    "",
    `2. OUTER WRAPPER: table width=100% cellpadding=0 cellspacing=0 border=0 style background-color using ${s} or chosen bg.`,
    "",
    "3. HEADER (best-possible integration): One table row, background " +
      p +
      " only — no second background. Min-height 70px, padding 20px 16px. If BRAND LOGO URL is provided: use a single <img> with src that URL, max-height 48px, width auto, max-width 200px, display block, margin 0 auto, border 0. Do NOT wrap the logo in a box or container that adds another background; the header bar must be the only background so the logo does not appear in a clashing rectangle. If the logo has an opaque or light background that would clash with the header, keep it small (max-height 44px) so the header stays dominant, or omit the logo and use brand name as text instead. Else (no logo URL): center brand name as text, white or dark depending on " +
      p +
      ", bold, font-size 22px. Bottom border 3px solid darker shade of " +
      p +
      ".",
    "",
    "4. HERO: img src={{EMAIL_IMAGE_1}} width=600 style width:100%;max-width:600px;display:block;border:0;",
    "",
    "5. MAIN CONTENT: white #ffffff background, padding 40px. Headline: 28px, font-weight 700, color " +
      p +
      ", margin-bottom 12px. Subheadline: 16px, #555, line-height 1.5, margin-bottom 24px. Body p1: 15px, #333, line-height 1.7, margin-bottom 20px. Then img {{EMAIL_IMAGE_2}} if image will exist (always include img tag; src placeholder). Body p2 same as p1. Then img {{EMAIL_IMAGE_3}}. Use border-radius 8px on inline images via style.",
    "",
    "6. CTA SECTION: background #f9f9f9, padding 30px 40px, center. Button link href={{CTA_URL}}: background " +
      p +
      ", color #fff, padding 16px 40px, border-radius 8px, font-weight 700, display inline-block, text-decoration none. Use cta_primary as button label.",
    "",
    "7. DIVIDER: hr style border:0;border-top:1px solid #eeeeee;margin:0;",
    "",
    "8. SOCIAL MEDIA IN FOOTER (MANDATORY when user configured any): BRAND SOCIAL LINKS are set by the user on the brand page. When that list contains ANY URL for instagram, tiktok, facebook, x, linkedin, pinterest, or youtube, you MUST add a row (above or inside the footer) with heading 'Follow Us' or 'Stay Connected' and a horizontal row of icon links — one link per platform that has a URL in BRAND SOCIAL LINKS. Include ONLY platforms the user actually filled in; omit platforms with no URL. Use inline SVG 30x30 per icon, stroke or fill = " +
      p +
      ". Icons: Instagram, TikTok, Facebook, X, LinkedIn, Pinterest, YouTube (play triangle white). If BRAND SOCIAL LINKS has no social URLs at all, omit this row.",
    "",
    "9. FOOTER: background rgba tint of " +
      p +
      " ~15% or very light mix of primary; padding 30px 40px; all center. Brand name 15px font-weight 700 color " +
      p +
      ". Footer tagline 13px #666 margin-top 6px. If contact_email in social links: 12px #888 margin-top 8px mailto link. If address: 11px #999 italic margin-top 6px. hr 1px #eee margin 16px 0. REQUIRED unsubscribe: <p style='font-size:11px;color:#aaaaaa;text-align:center;margin:0;'>You received this email because you signed up for updates from [brand name]. <a href={{UNSUBSCRIBE_URL}} style='color:#aaaaaa;text-decoration:underline;'>Unsubscribe</a> at any time.</p> Use literal placeholder {{UNSUBSCRIBE_URL}} in HTML output. Copyright: © [current year] [brand name].",
    "",
    "PLACEHOLDERS (keep exactly): {{EMAIL_IMAGE_1}} {{EMAIL_IMAGE_2}} {{EMAIL_IMAGE_3}} {{CTA_URL}} {{UNSUBSCRIBE_URL}}",
    "",
    "COLOR: Use " + p + " and " + s + " as hex in all inline styles. Dark primary → white text on colored bars; light primary → dark text.",
    "",
    "CRITICAL: No <style> tags. Valid complete HTML. Escape double quotes inside JSON string as \\\". Use \\n only as needed in JSON.",
  ].join("\n");
}

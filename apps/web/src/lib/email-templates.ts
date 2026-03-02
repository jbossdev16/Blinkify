/**
 * Email template list for Creative Studio sidebar. IDs must match API (apps/api/src/lib/email-templates.ts).
 */
export const EMAIL_TEMPLATE_IDS = ["beauty", "beauty-product", "ecommerce-email-marketing", "style", "new-season", "fashion"] as const;
export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export interface EmailTemplateOption {
  id: EmailTemplateId;
  name: string;
  description: string;
}

export const EMAIL_TEMPLATE_OPTIONS: EmailTemplateOption[] = [
  { id: "beauty", name: "Natural Beauty & Wellness", description: "Nurture, product showcase, natural tone" },
  { id: "beauty-product", name: "Beauty Product", description: "Natural beauty hero, flat lays, serene earth tones" },
  { id: "ecommerce-email-marketing", name: "Ecommerce Email Marketing", description: "Fixed layout — only products, text & colors change" },
  { id: "style", name: "Style & Discount", description: "Promotional, style + savings" },
  { id: "new-season", name: "New Season Collection", description: "Product launch, catalog feel" },
  { id: "fashion", name: "Curated Fashion", description: "Editorial, diverse inspiration" },
];

export function isEmailTemplateId(v: string | null | undefined): v is EmailTemplateId {
  return typeof v === "string" && EMAIL_TEMPLATE_IDS.includes(v as EmailTemplateId);
}

import path from "path";
import fs from "fs";

/**
 * Built-in email marketing templates. Keyed by id; used when user selects a template in Creative Studio.
 * Each template guides the AI on structure, tone, and focus for generated email copy.
 * Optional image_generation instructs the hero image API so the visual matches the template.
 * Optional template_image_file: filename (e.g. "ecommerce-email-marketing.png") in assets/email-templates/ — AI keeps layout and only replaces products, text, and colors.
 */
export const EMAIL_TEMPLATE_IDS = ["beauty", "beauty-product", "ecommerce-email-marketing", "style", "new-season", "fashion"] as const;
export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

/** Instructions appended to the email hero image prompt when this template is selected. */
export interface TemplateImageGeneration {
  style: string;
  photography: string;
  color_palette: string;
  mood: string;
  composition?: string;
}

export interface EmailTemplateSpec {
  id: EmailTemplateId;
  name: string;
  campaign_metadata: {
    name: string;
    goal: string;
    target_audience: string;
    brand_voice: string;
    unique_value_proposition: string;
  };
  sequence_structure: Array<{
    email_number: number;
    type: string;
    focus: string;
    pain_points: string[];
    solution: string;
    cta: string;
    constraints: { subject_line_count: number; length: string };
  }>;
  visual_elements?: Record<string, unknown>;
  /** When set, the email hero image is generated with these visual instructions. */
  image_generation?: TemplateImageGeneration;
  /** Filename in assets/email-templates/ (e.g. "ecommerce-email-marketing.png"). When set, the template image is sent to the model and the output must preserve layout, only replacing products, text, and colors. */
  template_image_file?: string;
}

const BEAUTY: EmailTemplateSpec = {
  id: "beauty",
  name: "Natural Beauty & Wellness",
  campaign_metadata: {
    name: "Natural Beauty & Wellness",
    goal: "Brand awareness, product discovery, customer engagement",
    target_audience:
      "Individuals interested in natural beauty, organic skincare, wellness, self-care, premium beauty, eco-conscious consumers",
    brand_voice: "Natural, elegant, serene, informative, professional, aspirational, caring",
    unique_value_proposition:
      "Natural ingredients, research-backed innovation, personalized self-care, holistic beauty, premium quality",
  },
  sequence_structure: [
    {
      email_number: 1,
      type: "Nurture / Product Showcase",
      focus:
        "Brand philosophy (natural beauty, health), product innovation, product categories (renewing, pampering, personalized)",
      pain_points: [
        "Desire for effective yet gentle skincare",
        "Difficulty finding suitable products",
        "Need for self-care",
        "Wanting natural beauty solutions",
      ],
      solution:
        "Natural, innovative, high-quality products with specific benefits (renewal, pampering) and personalized solutions",
      cta: "READ MORE (hero); Read more (features); Card links for Renewing Beauty, Pamper Yourself, Find the type of product that suits your skin",
      constraints: { subject_line_count: 3, length: "Medium" },
    },
  ],
  visual_elements: {
    sections: ["hero_with_overlay", "two_column_feature", "two_column_feature", "three_card_grid", "footer_social"],
    color_scheme: "Light beige, muted browns, natural greens",
  },
  image_generation: {
    style: "Natural beauty and wellness: minimalist, clean, elegant. High-quality product photography, ample negative space, soft rounded corners.",
    photography: "Bright, airy, natural light. Flat lays and close-ups. Emphasize textures: wood, fabric, fresh leaves (e.g. eucalyptus). Natural color grading, no harsh shadows.",
    color_palette: "Soft muted earth tones: light beige, cream, warm taupe, muted browns, natural greens. No bright or harsh colors.",
    mood: "Serene, elegant, trustworthy, natural.",
    composition: "Single strong hero visual: product flat lay on light wood or fabric with foliage. Clean composition, conversion-focused.",
  },
};

/** Beauty Product — template from natural-beauty email layout (hero + two-column features + product grid). */
const BEAUTY_PRODUCT: EmailTemplateSpec = {
  id: "beauty-product",
  name: "Beauty Product",
  campaign_metadata: {
    name: "Beauty Product",
    goal: "Brand awareness, product discovery, customer engagement",
    target_audience:
      "Individuals interested in natural beauty, organic skincare, wellness, self-care, premium beauty, eco-conscious consumers",
    brand_voice: "Natural, elegant, serene, informative, professional, aspirational, caring",
    unique_value_proposition:
      "Natural ingredients, research-backed innovation, personalized self-care, holistic beauty, premium quality",
  },
  sequence_structure: [
    {
      email_number: 1,
      type: "Nurture / Product Showcase",
      focus:
        "Brand philosophy (natural beauty, health), product innovation, product categories (rejuvenating, pampering, skin-suited)",
      pain_points: [
        "Desire for effective yet gentle skincare",
        "Difficulty finding suitable products",
        "Need for self-care",
        "Wanting natural beauty solutions",
      ],
      solution:
        "Natural, innovative, high-quality products with specific benefits (rejuvenation, pampering) and personalized solutions",
      cta: "READ MORE (hero); Read more (features); Rejuvenating Beauty, Pamper Yourself, Find the type of product that suits your skin",
      constraints: { subject_line_count: 3, length: "Medium" },
    },
  ],
  visual_elements: {
    sections: ["hero_with_overlay", "two_column_feature", "two_column_feature", "three_card_grid", "footer_social"],
    color_scheme: "Light beige, cream, warm taupe, muted browns, natural greens",
    photography_style: "Flat lays, close-ups, natural light, textures (wood, fabric, leaves)",
    mood: "Serene, elegant, trustworthy, natural",
  },
  image_generation: {
    style: "Natural beauty product email hero: minimalist, clean, elegant. High-quality product photography, ample white space, soft rounded corners. No long text or headlines in the image.",
    photography: "Bright, airy, natural light. Flat lay of beauty/wellness products (jars, creams, small vessels) on a light wooden circular board or textured white fabric. Include fresh green leaves (e.g. eucalyptus) and natural details (wooden spoon, soft fabric). Consistent natural color grading, no harsh shadows.",
    color_palette: "Soft muted earth tones only: light beige, cream, warm taupe, muted browns, natural greens. No bright or saturated colors.",
    mood: "Serene, elegant, trustworthy, natural. Conveys quality and self-care.",
    composition: "Single hero visual: product flat lay, centered. Clean composition with negative space. Conversion-focused, suitable for email hero/banner.",
  },
};

const STYLE: EmailTemplateSpec = {
  id: "style",
  name: "Style & Discount",
  campaign_metadata: {
    name: "Style Collection & Discount Offer",
    goal: "Drive product discovery and purchases through style inspiration and discounts",
    target_audience: "Fashion-conscious individuals, shoppers looking for trendy items and deals",
    brand_voice: "Modern, sophisticated, direct, promotional",
    unique_value_proposition: "Discover curated styles with significant savings",
  },
  sequence_structure: [
    {
      email_number: 1,
      type: "Promotional / Sales Announcement",
      focus: "Showcasing STYLE and UP TO 50% OFF offer",
      pain_points: ["Desire for new fashion items", "Seeking value or discounts on stylish clothing"],
      solution: "Access to trendy pieces at an attractive price point",
      cta: "SHOP NOW, BUY NOW",
      constraints: { subject_line_count: 3, length: "Medium" },
    },
  ],
  visual_elements: {
    sections: ["header_logo", "hero_full_bleed", "discount_block", "two_column_feature", "footer_social"],
    color_scheme: "White, grey, black, vibrant orange accents",
  },
};

const NEW_SEASON: EmailTemplateSpec = {
  id: "new-season",
  name: "New Season Collection",
  campaign_metadata: {
    name: "New Season Collection Launch",
    goal: "Announce new arrivals, drive engagement, facilitate direct purchases",
    target_audience: "Trend-conscious shoppers seeking fresh fashion updates",
    brand_voice: "Fresh, exciting, product-focused, modern",
    unique_value_proposition: "Early access to the latest season's fashion",
  },
  sequence_structure: [
    {
      email_number: 1,
      type: "Product Launch / Catalog",
      focus: "NEW SEASON collection and individual product offerings",
      pain_points: ["Desire to refresh wardrobe", "Needing inspiration for new outfits"],
      solution: "Easy discovery and purchase of new, stylish items",
      cta: "SHOP NOW, BUY NOW (per product)",
      constraints: { subject_line_count: 3, length: "Medium" },
    },
  ],
  visual_elements: {
    sections: ["header_logo", "hero_two_column", "product_grid_3col", "secondary_cta", "footer_social"],
    color_scheme: "White, black, vibrant orange",
  },
};

const FASHION: EmailTemplateSpec = {
  id: "fashion",
  name: "Curated Fashion",
  campaign_metadata: {
    name: "Curated Fashion Insights & Products",
    goal: "Inspire fashion choices, promote items, encourage exploration",
    target_audience: "Fashion enthusiasts interested in trends and diverse styling",
    brand_voice: "Curated, sophisticated, informative, promotional",
    unique_value_proposition: "Diverse fashionable items in an engaging, accessible way",
  },
  sequence_structure: [
    {
      email_number: 1,
      type: "Content-rich Promotional / Editorial",
      focus: "Diverse fashion inspiration and direct purchase opportunities",
      pain_points: ["Difficulty finding cohesive outfits", "Needing varied fashion options and inspiration"],
      solution: "Curated selection of stylish choices with clear paths to purchase",
      cta: "SHOP NOW, BUY NOW",
      constraints: { subject_line_count: 3, length: "Medium" },
    },
  ],
  visual_elements: {
    sections: ["header_logo", "hero_two_column", "content_block", "content_block", "content_block", "footer_social"],
    color_scheme: "White, dark grey, orange accents",
  },
};

/** Ecommerce email marketing — layout from template image; AI replaces only products, text, and colors. */
const ECOMMERCE_EMAIL_MARKETING: EmailTemplateSpec = {
  id: "ecommerce-email-marketing",
  name: "Ecommerce Email Marketing",
  campaign_metadata: {
    name: "Ecommerce Email Marketing",
    goal: "Drive product discovery, promotions, and conversions",
    target_audience: "Online shoppers, deal-seekers, fashion and lifestyle buyers",
    brand_voice: "Clear, promotional, modern, conversion-focused",
    unique_value_proposition: "Strong offers and product presentation in a proven email layout",
  },
  sequence_structure: [
    {
      email_number: 1,
      type: "Promotional / Product Showcase",
      focus: "Hero + product blocks + CTA in a fixed layout",
      pain_points: ["Need high-converting email layout", "Want consistent structure"],
      solution: "Use this template layout; only the products and copy change",
      cta: "SHOP NOW, BUY NOW, or CTA from copy",
      constraints: { subject_line_count: 3, length: "Medium" },
    },
  ],
  visual_elements: {
    sections: ["hero", "product_blocks", "cta", "footer"],
    color_scheme: "Match brand; template layout preserved",
  },
  template_image_file: "ecommerce-email-marketing.png",
};

const TEMPLATES: Record<EmailTemplateId, EmailTemplateSpec> = {
  beauty: BEAUTY,
  "beauty-product": BEAUTY_PRODUCT,
  "ecommerce-email-marketing": ECOMMERCE_EMAIL_MARKETING,
  style: STYLE,
  "new-season": NEW_SEASON,
  fashion: FASHION,
};

export function getEmailTemplate(id: EmailTemplateId | string | null | undefined): EmailTemplateSpec | null {
  if (!id || typeof id !== "string") return null;
  return TEMPLATES[id as EmailTemplateId] ?? null;
}

/** Build a prompt suffix for hero image generation from the template's image_generation spec. */
export function buildTemplateImagePromptSuffix(template: EmailTemplateSpec): string {
  const ig = template.image_generation;
  if (!ig) return "";
  const parts = [
    `VISUAL STYLE (match this template): ${ig.style}`,
    `PHOTOGRAPHY: ${ig.photography}`,
    `COLOR PALETTE: ${ig.color_palette}`,
    `MOOD: ${ig.mood}`,
  ];
  if (ig.composition?.trim()) parts.push(`COMPOSITION: ${ig.composition}`);
  return "\n\n" + parts.join(". ");
}

const EMAIL_TEMPLATES_ASSET_DIR = "email-templates";

/** Resolve path to a template image file. Tries: cwd/assets/email-templates, cwd/apps/api/assets/email-templates, cwd/../assets/email-templates. */
function resolveTemplateImagePath(filename: string): string | null {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "assets", EMAIL_TEMPLATES_ASSET_DIR, filename),
    path.join(cwd, "apps", "api", "assets", EMAIL_TEMPLATES_ASSET_DIR, filename),
    path.join(cwd, "..", "assets", EMAIL_TEMPLATES_ASSET_DIR, filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Load template image from assets/email-templates/ as base64. Returns null if file not found or template has no template_image_file.
 */
export function loadTemplateImage(template: EmailTemplateSpec): { data: string; mimeType: string } | null {
  const filename = template.template_image_file?.trim();
  if (!filename) return null;
  const resolved = resolveTemplateImagePath(filename);
  if (!resolved) return null;
  try {
    const buf = fs.readFileSync(resolved);
    const ext = path.extname(filename).toLowerCase().slice(1) || "png";
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
    };
    return {
      data: buf.toString("base64"),
      mimeType: mimeMap[ext] ?? "image/png",
    };
  } catch {
    return null;
  }
}

/** Build the hero prompt when using a template image: preserve layout, only replace products, text, and colors. */
export function buildTemplateReplacePrompt(emailCopy: { headline: string; introCopy: string; closingCopy: string; ctaText: string }): string {
  const introSnippet = emailCopy.introCopy.slice(0, 400).replace(/\n/g, " ");
  const closingSnippet = emailCopy.closingCopy.slice(0, 200).replace(/\n/g, " ");
  return `The first image above is the exact email template layout. Generate a new image that preserves this template layout and structure exactly. Do not change the layout, sections, or composition.

ONLY replace:
1. Products — Replace any product photos or hero imagery with products that fit the campaign and brand. Keep the same positions and framing.
2. Text — Replace all visible text (headline, body, CTA, any labels) with the following copy. Use the same typography style and placement as the template.
3. Colors — Adjust colors only to better match the brand if needed; keep the same overall structure.

COPY TO USE:
- Headline: "${emailCopy.headline}"
- Body / intro: "${introSnippet}"
- Closing: "${closingSnippet}"
- CTA button/text: "${emailCopy.ctaText}"

Output a single image that looks like the template but with these products, this text, and optional brand color tweaks.`;
}

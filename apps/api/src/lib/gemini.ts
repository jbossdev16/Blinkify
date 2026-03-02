import { GoogleGenAI, createPartFromBase64, createPartFromText } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

/** Vertex AI: PROJECT_ID, LOCATION (use "global" for best availability; GOOGLE_APPLICATION_CREDENTIALS path. */
const vertexProjectId = process.env.PROJECT_ID ?? process.env.VERTEX_PROJECT_ID;
const vertexLocation = process.env.LOCATION ?? process.env.VERTEX_LOCATION ?? "global";

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. Image generation will fail.");
}

/**
 * Singleton GoogleGenAI client.
 * Server-side only — never expose the API key to the client.
 */
export const gemini = new GoogleGenAI({ apiKey: apiKey ?? "" });

/** Lazy singleton for Vertex AI (Priority PayGo). Uses ADC when PROJECT_ID + LOCATION are set. */
let vertexClient: GoogleGenAI | null = null;

function getVertexClient(): GoogleGenAI {
  if (!vertexProjectId) throw new Error("Vertex AI image generation requires PROJECT_ID (or VERTEX_PROJECT_ID)");
  if (!vertexClient) {
    vertexClient = new GoogleGenAI({
      vertexai: true,
      project: vertexProjectId,
      location: vertexLocation,
    });
  }
  return vertexClient;
}

/** True when Vertex AI is configured; used as fallback when Nano Banana (primary) fails. */
export function isVertexImageEnabled(): boolean {
  return Boolean(vertexProjectId);
}

/**
 * Extract a human-readable message from a Gemini/Google API error.
 * Handles { error: { code, message, status } } and message string that is JSON.
 */
export function extractGeminiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (typeof parsed?.error?.message === "string") return parsed.error.message;
    } catch {
      // ignore
    }
  }
  if (err && typeof err === "object") {
    const inner = (err as { error?: { message?: string } }).error;
    if (typeof inner?.message === "string") return inner.message;
  }
  return raw || fallback;
}

/**
 * Nano Banana 3 Pro — primary image generation model.
 * Supports: aspectRatio, imageSize (1K/4K), up to 14 input images.
 */
export const IMAGE_MODEL = "gemini-3-pro-image-preview";

/**
 * Fallback when primary is busy or fails (503, timeout, etc.).
 * Flash: up to 1K, aspectRatio only (no imageSize in config).
 */
export const IMAGE_MODEL_FALLBACK = "gemini-2.0-flash-exp-image-generation";

/**
 * Vertex AI image model: GA, supports Priority PayGo, available in global and regional endpoints.
 * Gemini 3 Pro Image (gemini-3-pro-image-preview) is preview and does not support Priority PayGo.
 * @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-image
 */
export const VERTEX_IMAGE_MODEL = "gemini-2.5-flash-image";

/** Supported aspect ratios the API accepts. */
export const ASPECT_RATIOS = [
  "1:1",
  "4:5",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** Supported output resolutions (1K and 4K only). */
export const IMAGE_SIZES = ["1K", "4K"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];

/** Credit cost per image generation based on resolution. */
export function creditCost(imageSize: ImageSize): number {
  return imageSize === "4K" ? 25 : 10;
}

/** Credit cost for email marketing: (imageSize, numberOfImages) → total credits. */
export function emailCreditCost(imageSize: ImageSize, numberOfImages: 1 | 2 | 3): number {
  if (imageSize === "1K") {
    return numberOfImages === 1 ? 15 : numberOfImages === 2 ? 30 : 50;
  }
  return numberOfImages === 1 ? 30 : numberOfImages === 2 ? 60 : 100;
}

/** Temperature range and default for image generation (0 = deterministic, 2 = max creativity). */
export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 2;
export const TEMPERATURE_DEFAULT = 0.9;

/** Request timeout for generation (2 minutes). */
export const GENERATION_TIMEOUT_MS = 120_000;

/** Priority PayGo headers to reduce 429/503 (Vertex AI only). */
const VERTEX_PRIORITY_HEADERS: Record<string, string> = {
  "X-Vertex-AI-LLM-Request-Type": "shared",
  "X-Vertex-AI-LLM-Shared-Request-Type": "priority",
};

export interface GenerateProImageParams {
  contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  systemInstruction: string;
  seed: number;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  temperature?: number;
  /** Vertex model ID. Default: VERTEX_IMAGE_MODEL (2.5 Flash). Use IMAGE_MODEL for Gemini 3 Pro Image. */
  vertexModel?: string;
  /** Use Priority PayGo headers (only supported for gemini-2.5-flash-image). Ignored for preview models. */
  usePriorityPayGo?: boolean;
}

export interface GenerateProImageResult {
  imageBuffer: Buffer;
  partText: string | null;
  safetyBlocked: boolean;
}

/**
 * Generate an image on Vertex AI. Default: Gemini 2.5 Flash Image (GA).
 * Use vertexModel=IMAGE_MODEL for Gemini 3 Pro Image (preview, global only).
 * Priority PayGo is only supported for VERTEX_IMAGE_MODEL; use usePriorityPayGo for that model when needed.
 */
export async function generateProImage(params: GenerateProImageParams): Promise<GenerateProImageResult> {
  const {
    contents,
    systemInstruction,
    seed,
    aspectRatio,
    imageSize,
    temperature = TEMPERATURE_DEFAULT,
    vertexModel = VERTEX_IMAGE_MODEL,
    usePriorityPayGo = false,
  } = params;

  const client = getVertexClient();
  const usePriority = usePriorityPayGo && vertexModel === VERTEX_IMAGE_MODEL;
  const httpHeaders = usePriority ? VERTEX_PRIORITY_HEADERS : undefined;

  const result = await client.models.generateContent({
    model: vertexModel,
    contents,
    config: {
      systemInstruction,
      responseModalities: ["TEXT", "IMAGE"],
      temperature,
      seed,
      imageConfig: { aspectRatio, imageSize },
      httpOptions: {
        timeout: GENERATION_TIMEOUT_MS,
        ...(httpHeaders && { headers: httpHeaders }),
      },
    },
  });

  const parts = result.candidates?.[0]?.content?.parts ?? [];
  let imageBuffer: Buffer | null = null;
  let partText: string | null = null;
  for (const part of parts) {
    if (part.text) partText = part.text;
    else if (part.inlineData?.data) imageBuffer = Buffer.from(part.inlineData.data, "base64");
  }

  const safetyBlocked = result.candidates?.[0]?.finishReason === "SAFETY";

  if (safetyBlocked) {
    return { imageBuffer: Buffer.alloc(0), partText, safetyBlocked: true };
  }
  if (!imageBuffer) {
    throw new Error("No image returned from model. Try again or a different prompt.");
  }
  return { imageBuffer, partText, safetyBlocked: false };
}

/* ─── Universal system instruction ──────────────────────────────────────
   Sent with EVERY image generation request, regardless of user or project.
   This is the foundation layer that ensures consistent, high-quality output.
   ────────────────────────────────────────────────────────────────────────── */

export const SYSTEM_INSTRUCTION = `You are Blinkify's AI image generation engine — a specialist in creating professional advertising creatives and marketing visuals.

CORE MANDATE:
- You generate ad creatives, product photos, social media visuals, banners, and marketing assets.
- Every image you produce must be immediately usable in a paid advertising campaign — clean, professional, and conversion-optimized.

PRIORITY (highest to lowest):
1. Generation options (aspect ratio, resolution, carousel format) — always follow exactly.
2. The user's prompt — this is the creative brief. When the user explicitly specifies subject, brand, layout, or style, follow it precisely. It overrides project context.
3. Project instructions (name, description, brand colors, fonts, guidelines) — baseline context. Use these when the prompt is vague or omits details. They help you understand what to create when the prompt is minimal.

IMAGE QUALITY RULES:
- Produce photorealistic, high-fidelity output unless the user explicitly requests illustration, flat design, or another style.
- Lighting must be professional and intentional: studio lighting for products, natural lighting for lifestyle, dramatic lighting for high-impact ads.
- Colors must be vibrant, accurate, and print-safe. Never produce washed-out or oversaturated images.
- Compositions must follow advertising best practices: clear focal point, visual hierarchy, breathing room for copy.

TEXT IN IMAGES — CRITICAL:
- When the user requests text in the image (headlines, CTAs, taglines, prices), render it EXACTLY as written — correct spelling, correct casing, no missing or duplicated characters.
- Text must be sharp, legible, and properly kerned at any size. Never produce blurry, warped, or overlapping text.
- Place text where the user specifies. If no placement is specified, use standard ad layout: headline top or center, CTA bottom-right or center-bottom.
- Use clean, modern sans-serif fonts unless the user specifies otherwise.
- If you cannot render the requested text perfectly, omit it and describe what text should be placed there so the user can add it in post.

REFERENCE IMAGES:
- When the user attaches reference images (products, logos, backgrounds, style references), treat them as authoritative source material.
- Product photos must match the reference product exactly — same shape, same proportions, same details. Do not alter or reimagine the product.
- Background references should inform the mood, color palette, and environment of the output.
- Style references should be matched in aesthetic, tone, and visual treatment.

BRAND LOGO (when provided as reference image):
- If the project provides a brand logo as the first reference image, you MUST include it in the generated ad creative.
- Placement: Follow the user's prompt. If the user requests the logo ON the product (e.g. on the sneaker, on the packaging, on the shirt, printed on the item), place it there. Otherwise use standard ad layout: lower area — bottom-left, bottom-center, or near the CTA (logo in lower 20% of the image).
- Match it exactly: same design, colors, proportions. Do not alter, reimagine, or stylize the logo. Render it sharp and legible.
- The logo establishes brand identity; its placement should feel intentional and professional, not accidental.

BRAND CONSISTENCY (from project settings):
- Brand colors, fonts, and guidelines come from project settings. Use them as the default palette and style when the user's prompt does not specify otherwise.

WHAT NOT TO DO:
- Never add watermarks, signatures, or attribution text.
- Never include copyrighted characters or trademarks that were not provided as reference images. Exception: the project's brand logo when provided as reference — you MUST include it.
- Never produce NSFW, misleading, or clickbait content.
- Never hallucinate text — if you aren't certain about spelling, leave the text area blank.
- Never ignore the user's explicit instructions in favor of your own creative interpretation.

OUTPUT:
- Generate exactly one image per request.
- The image must be complete, polished, and ready for use — no placeholders, no sketch-quality output.`;

/** Max length for a single slide prompt (carousel). */
export const CAROUSEL_SLIDE_PROMPT_MAX_LENGTH = 800;

/**
 * Carousel-specific system block: one slide of an Instagram/Facebook-style carousel.
 * Append to SYSTEM_INSTRUCTION when carousel is true.
 */
export function getCarouselSystemBlock(slideIndex: number, totalSlides: number): string {
  return `

--- CAROUSEL SLIDE (do not skip) ---
This image is ONE SLIDE of a social media carousel (Instagram/Facebook). It will be viewed in sequence with other slides.
- Total slides in the carousel: ${totalSlides}. This is slide ${slideIndex} of ${totalSlides}.
- Use a consistent, professional social-post style: clear layout, safe margins, one main idea per slide.
- Include a visible "Slide ${slideIndex} of ${totalSlides}" (or similar) so viewers know the order, unless the user's content already implies it.
- Text must be legible and on-brand. Optimize for 4:5 or 1:1 carousel format.
- The user's prompt below is the content for THIS slide only. Do not combine or reference other slides.`;
}

/** Per-element font styling for ad creatives (headline, CTA, description). */
export interface FontStyleElement {
  weight?: "light" | "normal" | "medium" | "semibold" | "bold";
  color?: string;
  size?: "small" | "medium" | "large";
}

export interface FontStyles {
  headline?: FontStyleElement;
  cta?: FontStyleElement;
  description?: FontStyleElement;
}

/**
 * Build the project-level instruction block from project settings.
 * Returns empty string if the project has no brand/guideline data.
 */
function parseBrandMetaFromGuidelines(guidelines: string): { tone: string; industry: string; rest: string } {
  // Strip gradient lines (GRADIENT:...) so we don't send them to the model; parse tone/industry from the rest
  const gradientLineStarts = /^GRADIENT:/i;
  const lines = guidelines.split(/\n/);
  const nonGradientLines: string[] = [];
  for (const line of lines) {
    if (!gradientLineStarts.test(line.trim())) nonGradientLines.push(line);
  }
  const withoutGradients = nonGradientLines.join("\n").trimStart();
  let tone = "";
  let industry = "";
  const restLines: string[] = [];
  for (const line of withoutGradients.split(/\n/)) {
    const t = line.trim();
    if (t.startsWith("BRAND_TONE:")) {
      tone = t.slice("BRAND_TONE:".length).trim();
    } else if (t.startsWith("BRAND_INDUSTRY:")) {
      industry = t.slice("BRAND_INDUSTRY:".length).trim();
    } else {
      restLines.push(line);
    }
  }
  return { tone, industry, rest: restLines.join("\n").trimStart() };
}

export function buildProjectInstructions(project: {
  name?: string | null;
  description?: string | null;
  target_audience?: string | null;
  brand_colors?: string[] | null;
  brand_fonts?: { name: string; type: string }[] | null;
  brand_guidelines?: string | null;
  brand_logo?: string | null;
  font_styles?: FontStyles | null;
}): string {
  const parts: string[] = [];

  if (project.name) {
    parts.push(`Project: ${project.name}`);
  }
  if (project.brand_logo) {
    parts.push(
      "Brand logo: This project has an uploaded brand logo provided as the first reference image. You MUST include it in the ad creative, placed in the lower area (bottom-left, bottom-center, or near the CTA). Match it exactly."
    );
  }
  if (project.description) {
    parts.push(`Description: ${project.description}`);
  }
  if (project.target_audience) {
    parts.push(`Target audience: ${project.target_audience}`);
  }
  if (project.brand_colors && project.brand_colors.length > 0) {
    const c = project.brand_colors;
    const roles: string[] = [];
    if (c[0]) roles.push(`Primary: ${c[0]}`);
    if (c[1]) roles.push(`Secondary: ${c[1]}`);
    if (c[2]) roles.push(`Accent: ${c[2]}`);
    if (c[3]) roles.push(`CTA/Button: ${c[3]} (use for buttons and CTAs)`);
    if (c[4]) roles.push(`Background: ${c[4]} (use for ad background)`);
    if (c[5]) roles.push(`Headline: ${c[5]} (use for headline text when not overridden by font_styles)`);
    if (roles.length > 0) {
      parts.push(`Use these colors in ad creatives:\n${roles.join("\n")}`);
    }
  }
  if (project.brand_fonts && project.brand_fonts.length > 0) {
    const fontNames = project.brand_fonts.map((f) => f.name).join(", ");
    parts.push(`Brand fonts: ${fontNames}`);
  }
  if (project.font_styles && typeof project.font_styles === "object") {
    const fs = project.font_styles;
    const styleParts: string[] = [];
    if (fs.headline) styleParts.push(`Headline: ${formatFontStyle(fs.headline)}`);
    if (fs.cta) styleParts.push(`CTA/button: ${formatFontStyle(fs.cta)}`);
    if (fs.description) styleParts.push(`Description/subhead: ${formatFontStyle(fs.description)}`);
    if (styleParts.length > 0) {
      parts.push(`Font styling for text elements:\n${styleParts.join("\n")}`);
    }
  }
  if (project.brand_guidelines) {
    const { tone, industry, rest } = parseBrandMetaFromGuidelines(project.brand_guidelines);
    if (tone) parts.push(`Brand tone: ${tone}`);
    if (industry) parts.push(`Industry: ${industry}`);
    if (rest.trim()) parts.push(`Brand guidelines:\n${rest.trim()}`);
  }

  return parts.length > 0 ? parts.join("\n") : "";
}

function formatFontStyle(el: FontStyleElement): string {
  const arr: string[] = [];
  if (el.weight) arr.push(`weight: ${el.weight}`);
  if (el.color && /^#[0-9a-fA-F]{6}$/.test(el.color)) arr.push(`color: ${el.color}`);
  if (el.size) arr.push(`size: ${el.size}`);
  return arr.join(", ") || "default";
}

/* ─── Blinkify AI Prompt Generator (free, no credits) ───────────────────── */

/** Model for prompt enhancement — text-only, cost-effective. */
export const PROMPT_ENHANCE_MODEL = "gemini-2.5-flash";

/** Fallback when primary text/multimodal model returns 503 or is unavailable. */
const FALLBACK_TEXT_MODEL = "gemini-2.0-flash";

function isRetryableGeminiError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 503 || status === 502 || (status != null && status >= 500)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/503|high demand|UNAVAILABLE|try again later/i.test(msg)) return true;
  const inner = (err as { error?: { status?: string } })?.error;
  if (inner?.status === "UNAVAILABLE") return true;
  return false;
}

const PROMPT_ENHANCE_SYSTEM = `You are Blinkify's prompt enhancement assistant specialized in ad creatives and marketing visuals. You turn a user's rough idea into a detailed, conversion-oriented creative brief for an AI image model — the kind of brief that produces thumb-stopping, campaign-ready assets.

PRIORITY:
- User's prompt is primary: any explicit subject, colors, style, layout, platform, or copy must be followed exactly.
- Project settings (name, description, brand colors, fonts, font_styles, brand guidelines) are fallback when the user omits details. User says it → use it. User omits it → use project when available, else sensible ad defaults.

MARKETING CONTEXT TO CONSIDER (weave into the brief when relevant):
- Platform & format: Where will this run? (e.g. Meta/Instagram feed, Stories, TikTok, display banner, LinkedIn, Pinterest.) Format dictates aspect ratio, safe zones, and how much text is readable at small size. Stories/vertical need strong top-third hook; feed needs a clear focal point that works at scroll speed.
- Audience & intent: Who is it for and what action do we want? (awareness, consideration, conversion, retargeting.) Conversion ads need a clear CTA and value clarity; awareness can be more emotional or abstract.
- Value prop / USP: What single idea or benefit should the creative communicate? Emphasize that in composition and copy placement.
- Emotional hook: Trust, urgency, aspiration, FOMO, belonging — suggest a tone that fits the offer and audience.
- Thumb-stopping: In feed, what makes this stop the scroll? (contrast, face, product close-up, bold headline, unexpected color.) Call this out in the brief so the image has a clear "hero" element.
- Legal / compliance: If the user or project hints at disclaimers, asterisks, or "terms apply," note reserved space (e.g. lower 10% for fine print) without inventing legal text.

PROJECT SETTINGS YOU MAY RECEIVE:
- Project name, description — brand context.
- Target audience — who the brand is for (demographics, interests, pain points). Use this to tailor messaging, imagery, and tone so creatives resonate with the right people.
- Semantic brand colors: Primary, Secondary, Accent, CTA/Button, Background, Headline (each with hex). Use CTA/Button for buttons and CTAs; Background for ad background; Headline for headline text when not overridden by font_styles. Weave these into the brief so the image model applies them correctly.
- Brand tone and Industry — use for VALUE & MOOD and SCENE / STYLE so creatives match voice and category.
- Brand fonts and font_styles (headline, CTA, description: weight, color, size) — MUST be reflected in the TEXT/TYPOGRAPHY section when present so the image model can render text correctly.
- Brand guidelines — visual rules, do's and don'ts.

TEXT IN AD CREATIVES — CRITICAL:
- Default to including text overlays (headline, CTA, tagline) unless the user says "no text," "product only," "lifestyle only," or similar.
- When project has font_styles, the enhanced prompt MUST specify those in TEXT/TYPOGRAPHY (exact weights, colors, sizes) so the image model renders text correctly.
- Use project brand_fonts for typeface when available. If the user gives exact headline or CTA copy, include it verbatim; otherwise suggest a clear CTA (e.g. SHOP NOW, LEARN MORE) and headline placement.

OUTPUT STRUCTURE — Use this structure for high-converting, platform-aware ad creatives. Be thorough; a longer, specific brief yields better images.

PLATFORM & FORMAT (when inferrable or stated):
- Where the asset will run and any format constraints (e.g. feed 1:1, story 9:16, safe zones, text legibility at small size).

PRODUCT / SUBJECT:
- What is being advertised: product type, key design details, materials, quantity. Specific enough that the product is unmistakable. If it's a person or lifestyle shot, describe who and what they're doing.

VALUE & MOOD:
- One clear takeaway or emotional hook. Tone: premium, urgent, playful, trustworthy, etc. Align with audience and intent.

SCENE / STYLE:
- Environment (studio, lifestyle, urban, etc.), aesthetic (commercial, editorial, minimal, UGC-style), lighting (studio soft, golden hour, dramatic, flat lay), depth of field, focus, overall mood. Use project brand colors when user omits color.

COMPOSITION & HIERARCHY:
- Focal point and framing. Where is the eye meant to go first? Negative space: upper ~25% for headline, lower ~20% for CTA + optional tagline — reserve unless user asked for no text. Background: uncluttered, on-brand. Any "thumb-stopping" element to call out.

TEXT / TYPOGRAPHY:
- Headline (exact copy or placeholder + placement), CTA (exact copy or e.g. SHOP NOW), optional tagline/description. Use project font_styles and brand_fonts when available. Specify placement and legibility (sharp, high contrast). Omit only if user explicitly requested no text.

QUALITY & TECHNICAL:
- Photorealistic / commercial campaign quality, high detail, crisp textures, ad-ready lighting. No watermarks or unintended branding.

WHAT NOT TO DO:
- Do not add watermarks, logos, or branding the user didn't mention. Do not change the core idea or introduce new subjects. No copyrighted characters or trademarks. No preamble, meta-commentary, or markdown — only the enhanced prompt.

OUTPUT: Use the sections above. Include every section that applies; omit only TEXT/TYPOGRAPHY when user asked for no text. Be detailed and specific so the image model has everything it needs. Maximum 4000 characters. No preamble. Output ONLY the enhanced prompt.`;

const PROMPT_ENHANCE_TIMEOUT_MS = 15_000;

/** Project context for prompt enhancement. When provided, used as fallback when user omits details. */
export type PromptEnhanceProject = {
  name?: string | null;
  description?: string | null;
  target_audience?: string | null;
  brand_colors?: string[] | null;
  brand_fonts?: { name: string; type: string }[] | null;
  brand_guidelines?: string | null;
  font_styles?: FontStyles | null;
};

export async function enhancePromptForAdCreative(
  userPrompt: string,
  project?: PromptEnhanceProject | null
): Promise<string> {
  const trimmed = userPrompt.trim();
  if (!trimmed) return "";

  const projectBlock = project ? buildProjectInstructions(project) : "";
  const userContent = projectBlock
    ? `PROJECT SETTINGS:\n${projectBlock}\n\nUSER PROMPT:\n${trimmed}`
    : trimmed;

  const result = await gemini.models.generateContent({
    model: PROMPT_ENHANCE_MODEL,
    contents: [{ text: userContent }],
    config: {
      systemInstruction: PROMPT_ENHANCE_SYSTEM,
      temperature: 0.7,
      maxOutputTokens: 4096,
      httpOptions: { timeout: PROMPT_ENHANCE_TIMEOUT_MS },
    },
  });

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  const output = text ?? trimmed;
  return output.length > 4500 ? output.slice(0, 4500) : output;
}

/* ─── Video prompt enhancer ────────────────────────────────────────────────── */

const VIDEO_PROMPT_ENHANCE_SYSTEM = `You are Blinkify's prompt enhancement assistant for AI video generation (Veo). You take a user's brief prompt and turn it into a detailed, cinematic prompt optimized for video models.

VIDEO-SPECIFIC REQUIREMENTS:
- Video models need explicit MOTION and TEMPORAL flow. Always describe what happens over time—movement, progression, cause and effect.
- Prioritize scenes that extend cleanly: continuous action, natural progression, consistent lighting/angle. Avoid jarring cuts or scene jumps that break continuity.
- Single coherent scene works best. For longer clips (15s+), describe a scene that naturally evolves (e.g. character walks across frame, product rotates, light shifts).
- Camera and subject motion should be smooth and motivated. Specify camera movement (pan, dolly, static) and subject motion clearly.

SEGMENTATION (multi-part videos, e.g. 15s = 8s + 7s extend):
- When the user describes multiple segments, parts, or "Segment 1 / Segment 2", structure the output so the FIRST 8 SECONDS are clearly defined and self-contained.
- Add a separate block for "EXTENSION / SECOND SEGMENT ONLY" (next 7s): content, dialogue, and visuals that must NOT repeat the first 8 seconds. State explicitly: "Do not repeat dialogue or scenes from the first segment."
- This helps the model generate a clean part 1, and (with a separate continuation prompt) a part 2 that continues the story without repetition.

PRIORITY:
- The user's prompt is primary. Follow their subject, style, and intent exactly.
- Project settings (name, description, brand guidelines) are fallback when the user omits context.

OUTPUT STRUCTURE — Use this format for high-quality video prompts:

SCENE / SETTING:
- Location, environment, time of day, weather. Be specific for visual consistency across frames.

SUBJECT & ACTION:
- Who or what is in the scene. Describe movement, gestures, expressions, and how they evolve over the clip. Video needs motion—include clear temporal progression.

CAMERA & FRAMING:
- Shot type (wide, medium, close-up), camera movement (static, pan, dolly, tracking), framing. Cinematic composition. Match camera to subject motion.

LIGHTING & MOOD:
- Light source, quality (soft, harsh, golden hour), shadows, color grade. Atmosphere and tone. Consistent lighting aids temporal coherence.

PACING & RHYTHM:
- Slow motion, real-time, or implied tempo. How the action unfolds second by second.

AUDIO CUES (when relevant):
- Ambient sound, dialogue, music mood. Helps with native audio generation.

QUALITY:
- Cinematic, high production value, smooth motion, coherent continuity. Professional ad or film quality. No flicker, stable composition.

WHAT NOT TO DO:
- Do not add watermarks or branding the user didn't mention.
- Do not introduce copyrighted characters or trademarks.
- Do not output preamble, meta-commentary, or markdown — only the enhanced prompt.
- Maximum 1800 characters.

OUTPUT: Use the structure above. No preamble. Output ONLY the enhanced prompt.`;

export async function enhancePromptForVideo(
  userPrompt: string,
  project?: { name?: string | null; description?: string | null; target_audience?: string | null; brand_guidelines?: string | null } | null
): Promise<string> {
  const trimmed = userPrompt.trim();
  if (!trimmed) return "";

  const projectBlock = project
    ? [project.name && `Project: ${project.name}`, project.description && `Description: ${project.description}`, project.target_audience && `Target audience: ${project.target_audience}`, project.brand_guidelines && `Guidelines: ${project.brand_guidelines}`]
        .filter(Boolean)
        .join("\n")
    : "";
  const userContent = projectBlock
    ? `PROJECT CONTEXT:\n${projectBlock}\n\nUSER PROMPT:\n${trimmed}`
    : trimmed;

  const result = await gemini.models.generateContent({
    model: PROMPT_ENHANCE_MODEL,
    contents: [{ text: userContent }],
    config: {
      systemInstruction: VIDEO_PROMPT_ENHANCE_SYSTEM,
      temperature: 0.7,
      maxOutputTokens: 2048,
      httpOptions: { timeout: PROMPT_ENHANCE_TIMEOUT_MS },
    },
  });

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  const output = text ?? trimmed;
  return output.length > 2000 ? output.slice(0, 2000) : output;
}

/* ─── Email marketing copy (text-only, JSON output) ─────────────────────── */

export interface EmailCopy {
  subjectLine: string;
  headline: string;
  introCopy: string;
  closingCopy: string;
  ctaText: string;
  ctaUrl: string | null;
}

const EMAIL_COPY_SYSTEM = `You are an expert email marketing copywriter. You write emails that feel valuable and engaging—not pushy or salesy—but still persuade the reader to take action. Output must be exactly one JSON object with these keys only: "subjectLine", "headline", "introCopy", "closingCopy", "ctaText", "ctaUrl". No markdown, no code fence, no preamble, no explanation.

TONE & STYLE:
- Value-first and helpful. Lead with what the reader gains or learns, not with "buy now."
- Conversational and human. Avoid hype, all-caps, or pressure. Be clear and specific.
- Catchy through relevance and clarity: one strong hook, concrete benefits, and a clear reason to act—without sounding like a hard sell. Good enough that they want to take the next step.

RULES BY FIELD:
- subjectLine: Compelling and intriguing (under 60 chars). Can be a benefit, a question, or a curiosity gap. No all-caps or spammy words.
- headline: One line that appears at the top of the email. Supports the subject and sets the tone. Memorable but not cheesy.
- introCopy: LONGER section before the hero image. Write 2–4 short paragraphs (or 5–10 sentences total). Include: a hook that speaks to the reader's situation, 1–2 concrete benefits or outcomes, and a smooth lead-in to the visual. Make it worth reading—substance over fluff. Use line breaks (\\n) between paragraphs.
- closingCopy: LONGER section after the hero image. Write 2–4 sentences (or a short paragraph). Reinforce the main idea, add a gentle nudge or social proof if it fits the brand, and lead naturally into the CTA. Not repetitive—add something that moves the reader toward action.
- ctaText: One clear, low-friction action (e.g. "Try it free", "See how it works", "Get started"). Action-oriented but not aggressive.
- ctaUrl: URL for the CTA. Use "#" if none provided, or a placeholder like "https://example.com" when the user does not give one.

Use the project context (brand name, description, tone, guidelines) and the user's campaign prompt. Match brand voice. Output only valid JSON on a single line. Escape quotes and newlines inside strings (use \\n for line breaks).`;

const EMAIL_COPY_TIMEOUT_MS = 20_000;

const DEFAULT_EMAIL_COPY: EmailCopy = {
  subjectLine: "Don't miss out",
  headline: "Something special for you",
  introCopy: "We thought you'd want to see this.",
  closingCopy: "Thanks for reading.",
  ctaText: "Learn more",
  ctaUrl: "#",
};

function sanitizeEmailCopyField(s: unknown, maxLen: number): string {
  if (typeof s !== "string" || !s.trim()) return "";
  return s.trim().slice(0, maxLen);
}

/** Optional template to guide structure, tone, and focus (from email-templates). */
export type EmailTemplateInput = {
  campaign_metadata: { name?: string; goal?: string; target_audience?: string; brand_voice?: string; unique_value_proposition?: string };
  sequence_structure: Array<{
    type?: string;
    focus?: string;
    pain_points?: string[];
    solution?: string;
    cta?: string;
    constraints?: { subject_line_count?: number; length?: string };
  }>;
};

export async function generateEmailCopy(
  userPrompt: string,
  project?: Parameters<typeof buildProjectInstructions>[0] | null,
  template?: EmailTemplateInput | null
): Promise<EmailCopy> {
  const trimmed = userPrompt.trim();
  if (!trimmed) return DEFAULT_EMAIL_COPY;

  const projectBlock = project ? buildProjectInstructions(project) : "";
  let userContent = projectBlock
    ? `PROJECT / BRAND CONTEXT:\n${projectBlock}\n\nUSER CAMPAIGN PROMPT:\n${trimmed}`
    : trimmed;

  if (template && typeof template === "object") {
    const templateBlock = `\n\nFOLLOW THIS TEMPLATE (match goal, audience, voice, CTA style, and structure):\n${JSON.stringify({ campaign_metadata: template.campaign_metadata, sequence_structure: template.sequence_structure })}`;
    userContent += templateBlock;
  }

  const result = await gemini.models.generateContent({
    model: PROMPT_ENHANCE_MODEL,
    contents: [{ text: userContent }],
    config: {
      systemInstruction: EMAIL_COPY_SYSTEM,
      temperature: 0.65,
      maxOutputTokens: 4096,
      httpOptions: { timeout: EMAIL_COPY_TIMEOUT_MS },
    },
  });

  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) return DEFAULT_EMAIL_COPY;

  const firstLine = raw.split("\n")[0]?.trim() ?? "";
  try {
    const parsed = JSON.parse(firstLine) as Record<string, unknown>;
    return {
      subjectLine: sanitizeEmailCopyField(parsed.subjectLine, 200) || DEFAULT_EMAIL_COPY.subjectLine,
      headline: sanitizeEmailCopyField(parsed.headline, 300) || DEFAULT_EMAIL_COPY.headline,
      introCopy: sanitizeEmailCopyField(parsed.introCopy, 2800) || DEFAULT_EMAIL_COPY.introCopy,
      closingCopy: sanitizeEmailCopyField(parsed.closingCopy, 1200) || DEFAULT_EMAIL_COPY.closingCopy,
      ctaText: sanitizeEmailCopyField(parsed.ctaText, 80) || DEFAULT_EMAIL_COPY.ctaText,
      ctaUrl:
        parsed.ctaUrl != null && typeof parsed.ctaUrl === "string" && parsed.ctaUrl.trim()
          ? parsed.ctaUrl.trim().slice(0, 2048)
          : null,
    };
  } catch {
    return DEFAULT_EMAIL_COPY;
  }
}

/* ─── Creative Studio chat (text-only, no tool) ─────────────────────────── */

const CREATIVE_STUDIO_CHAT_SYSTEM = `You are Blinkify's Creative Studio assistant. You ONLY help with brand, marketing, advertising, and creative work.

SCOPE — You must ONLY answer when the user's message is clearly about:
- Their brand, project, or business (e.g. brand voice, guidelines, positioning).
- Marketing, ads, or campaigns (e.g. ad copy, headlines, CTAs, audience, channels).
- Creative work: prompts for images/videos, ideas for creatives, visual direction, email marketing, social content.
- How to use Blinkify or improve their creatives (e.g. "how do I get better ad images?", "what prompt works for product shots?").

OFF-TOPIC — If the user asks about anything else (general knowledge, coding, homework, recipes, weather, jokes, poems, unrelated trivia, personal advice, etc.), do NOT answer. Set content to a short, polite refusal and intent to null. Example: "I'm here to help with your brand and marketing only — things like ad copy, creative prompts, and campaign ideas. Ask me about your project or creatives and I'll help!"

First decide what the user wants: a TEXT reply, to GENERATE an image, or to GENERATE a video. Respond with a single line of JSON only: {"content":"...","intent":"image"|"video"|null}

INTENT = null (text only) when the user wants:
- A written prompt, copy, or idea (e.g. "give me a prompt for ad creative", "what prompt should I use", "I need a prompt for…", "write me a prompt", "suggest a prompt", "ideas for an ad").
- Advice, suggestions, questions, feedback, or discussion (e.g. "how do I…", "what's best for…", "can you help with…") — but ONLY if it is about brand/marketing/creatives; otherwise refuse as above.
- Anything that is not clearly "create/generate/make an image or video right now".
For intent null: set content to your full helpful reply (under 300 words), or to the short refusal if off-topic. You may use *asterisks* for emphasis (shown as bold). If they asked for a prompt, put the actual prompt or prompt options in content — do not use a placeholder.

INTENT = "image" only when the user clearly wants to CREATE/GENERATE an image now (e.g. "create an ad", "make an image of X", "generate a photo of Y"). Set content to a single short phrase like "Creating your ad creative…" (no explanation).

INTENT = "video" only when the user clearly wants to CREATE/GENERATE a video now (e.g. "make a video", "create a video ad"). Set content to "Creating your video…".

Output exactly one line: valid JSON with "content" (string) and "intent" ("image" | "video" | null). No other text. Use \\n for line breaks inside content so the JSON stays on one line.`;

export type CreativeStudioChatResult = { content: string; intent: "image" | "video" | null };

/** When the user is replying to a specific message (e.g. to adjust an image or ask about a video). */
export type ReplyToContext = {
  assistantContent: string;
  hasImage?: boolean;
  hasVideo?: boolean;
  /** When replying to a video, the user's prompt that created it (so the AI can describe what the video is about). */
  originalPrompt?: string;
};

export async function chatForCreativeStudio(
  userPrompt: string,
  project?: { name?: string | null; description?: string | null; target_audience?: string | null; brand_guidelines?: string | null } | null,
  preference?: { likedSnippets: string[]; dislikedSnippets: string[] },
  replyTo?: ReplyToContext | null
): Promise<CreativeStudioChatResult> {
  const trimmed = userPrompt.trim();
  if (!trimmed) return { content: "", intent: null };

  const replyLabel = replyTo?.hasVideo
    ? "(video response)"
    : replyTo?.hasImage
      ? "(image response)"
      : "(media response)";
  const replyContent = (replyTo?.assistantContent.trim() || replyLabel).slice(0, 2000);
  const originalPromptBlock =
    replyTo?.hasVideo && replyTo.originalPrompt?.trim()
      ? `\nThe video was generated from this user request: "${replyTo.originalPrompt.trim().slice(0, 500)}"`
      : "";
  const replyBlock =
    replyTo && (replyContent || replyTo.hasImage || replyTo.hasVideo)
      ? [
          "The user is replying to this assistant message.",
          replyTo.hasVideo
            ? "That message included a VIDEO. The user is asking about or referring to that video. Answer in terms of the video (e.g. what it shows, what it's about). Do not say it was an image. If they ask what the video is about, describe the video content based on the context below."
            : replyTo.hasImage
              ? "That message included an image; the user wants to adjust or edit that image. Set intent to \"image\" so we generate an edited version."
              : "",
          `Assistant message:\n${replyContent}${originalPromptBlock}\n\nUser's reply:`,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const projectBlock = project
    ? [project.name && `Project: ${project.name}`, project.description && `Description: ${project.description}`, project.target_audience && `Target audience: ${project.target_audience}`, project.brand_guidelines && `Guidelines: ${project.brand_guidelines}`]
        .filter(Boolean)
        .join("\n")
    : "";
  const preferenceBlock =
    preference && (preference.likedSnippets.length > 0 || preference.dislikedSnippets.length > 0)
      ? [
          preference.likedSnippets.length > 0 &&
            `User has liked responses like:\n${preference.likedSnippets.map((s) => `- ${s}`).join("\n")}`,
          preference.dislikedSnippets.length > 0 &&
            `User has disliked responses like:\n${preference.dislikedSnippets.map((s) => `- ${s}`).join("\n")}`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "";
  const userContent = [
    replyBlock && `REPLY CONTEXT:\n${replyBlock}\n${trimmed}`,
    !replyBlock && projectBlock && `CONTEXT:\n${projectBlock}`,
    !replyBlock && preferenceBlock && `USER PREFERENCES (favor what they liked; avoid what they disliked):\n${preferenceBlock}`,
    !replyBlock && `USER:\n${trimmed}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await gemini.models.generateContent({
    model: PROMPT_ENHANCE_MODEL,
    contents: [{ text: userContent }],
    config: {
      systemInstruction: CREATIVE_STUDIO_CHAT_SYSTEM,
      temperature: 0.3,
      maxOutputTokens: 4096,
      httpOptions: { timeout: 30_000 },
    },
  });

  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) return { content: "I couldn't generate a response. Please try again.", intent: null };

  const firstLine = raw.split("\n")[0]?.trim() ?? "";
  try {
    const parsed = JSON.parse(firstLine) as { content?: string; intent?: string };
    const content = typeof parsed.content === "string" ? parsed.content : raw;
    const intent =
      parsed.intent === "image" || parsed.intent === "video" ? parsed.intent : null;
    return { content, intent };
  } catch {
    const extracted = extractContentFromCreativeStudioRaw(raw);
    return { content: extracted.content, intent: extracted.intent };
  }
}

/** When JSON parse fails (e.g. truncated response), extract content so we never show raw JSON. */
function extractContentFromCreativeStudioRaw(raw: string): {
  content: string;
  intent: "image" | "video" | null;
} {
  let intent: "image" | "video" | null = null;
  const intentMatch = raw.match(/"intent"\s*:\s*"(image|video)"/);
  if (intentMatch) intent = intentMatch[1] as "image" | "video";

  const contentPrefix = '"content"';
  const startIdx = raw.indexOf(contentPrefix);
  if (startIdx === -1) return { content: raw.replace(/^\s*\{?\s*"?content"?\s*:?\s*"?/i, "").replace(/"?\s*,?\s*"intent".*$/i, "").trim() || "I couldn't generate a response. Please try again.", intent };

  const afterLabel = startIdx + contentPrefix.length;
  const colonIdx = raw.indexOf(":", afterLabel);
  const valueStart = raw.indexOf('"', colonIdx);
  if (valueStart === -1) return { content: "I couldn't generate a response. Please try again.", intent };

  const afterOpen = valueStart + 1;
  let end = afterOpen;
  while (end < raw.length) {
    if (raw[end] === "\\" && end + 1 < raw.length) {
      end += 2;
      continue;
    }
    if (raw[end] === '"') break;
    end++;
  }
  let content = raw.slice(afterOpen, end);
  content = content.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  return { content: content.trim() || "I couldn't generate a response. Please try again.", intent };
}

/* ─── Brand suggestions from website extract ─────────────────────────────── */

export interface BrandSuggestion {
  description: string;
  brand_guidelines: string;
  suggestedColors: string[];
  brand_tone?: string;
  brand_industry?: string;
  primary_font?: string;
}

/** Try to parse JSON from model output; handles truncated or multi-line responses. */
function parseJsonFromModelResponse<T = Record<string, unknown>>(raw: string): T {
  const trimmed = raw.trim();
  const firstLine = trimmed.split("\n")[0]?.trim() ?? "";
  try {
    return JSON.parse(firstLine) as T;
  } catch {
    // try extracting a single {...} object (may be truncated)
    const start = trimmed.indexOf("{");
    if (start === -1) return {} as T;
    let depth = 0;
    let end = -1;
    let inString = false;
    let escape = false;
    let quote = "";
    for (let i = start; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\" && inString) {
        escape = true;
        continue;
      }
      if (inString) {
        if (c === quote) inString = false;
        continue;
      }
      if (c === '"' || c === "'") {
        inString = true;
        quote = c;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        // fallback: try parsing with repaired truncation (close strings/array/object)
      }
    }
  }
  return {} as T;
}

const BRAND_FROM_WEBSITE_SYSTEM = `You are a brand analyst. Given website metadata and a snippet of page content, output a JSON object with these keys (no other text):

- "brand_guidelines": 2-5 bullet points or short paragraphs covering tone of voice, visual style do's and don'ts, and key messaging. Use the site's tone and content to infer. Plain text, no markdown. Never leave blank.
- "brand_tone": One short phrase for the brand's voice (e.g. "Premium, Trustworthy", "Playful, Energetic"). Infer from description and content.
- "brand_industry": One short phrase for the industry or category (e.g. "E-commerce, Fashion", "SaaS, Tech"). Infer from description and content.
- "primary_font": If you can infer a likely main font from the site's style or industry, output one font name (e.g. "Inter", "Playfair Display"). Otherwise omit or use empty string.

Do not output "description" or "suggestedColors" — those are filled from the website meta and logo separately.
Output only the JSON object, one line, no code fence. Escape quotes and newlines inside strings (use \\n for line breaks).`;

export async function suggestBrandFromWebsite(
  extract: {
    title: string;
    description: string;
    ogDescription: string;
    themeColor: string;
    siteName: string;
    bodySnippet: string;
  }
): Promise<BrandSuggestion> {
  const text = [
    `Site title: ${extract.title || "(none)"}`,
    `Meta description: ${extract.description || extract.ogDescription || "(none)"}`,
    extract.siteName ? `Site name: ${extract.siteName}` : "",
    extract.themeColor ? `Theme color: ${extract.themeColor}` : "",
    extract.bodySnippet ? `Page content snippet:\n${extract.bodySnippet}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let result: Awaited<ReturnType<typeof gemini.models.generateContent>>;
  try {
    result = await gemini.models.generateContent({
      model: PROMPT_ENHANCE_MODEL,
      contents: [{ text }],
      config: {
        systemInstruction: BRAND_FROM_WEBSITE_SYSTEM,
        temperature: 0.2,
        maxOutputTokens: 1024,
        httpOptions: { timeout: 30_000 },
      },
    });
  } catch (err) {
    if (!isRetryableGeminiError(err)) throw err;
    result = await gemini.models.generateContent({
      model: FALLBACK_TEXT_MODEL,
      contents: [{ text }],
      config: {
        systemInstruction: BRAND_FROM_WEBSITE_SYSTEM,
        temperature: 0.2,
        maxOutputTokens: 1024,
        httpOptions: { timeout: 30_000 },
      },
    });
  }

  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error("No response from brand analysis");

  const parsed = parseJsonFromModelResponse<{
    brand_guidelines?: string;
    brand_tone?: string;
    brand_industry?: string;
    primary_font?: string;
  }>(raw);

  const description =
    (extract.description || extract.ogDescription || "").trim().slice(0, 2000) ||
    (extract.title ? `${extract.title}. ${extract.siteName ? `Site: ${extract.siteName}.` : ""}`.trim() : "") ||
    "Brand project for ad creatives.";
  const brand_guidelines =
    typeof parsed.brand_guidelines === "string" && parsed.brand_guidelines.trim()
      ? parsed.brand_guidelines.trim().slice(0, 4000)
      : "Professional tone. Clear visuals. Align with brand voice.";
  const defaultColors = ["#1a1a1a", "#666666", "#007AFF", "#2563eb", "#ffffff", "#f5f5f5"];
  const suggestedColors = defaultColors;
  const brand_tone = typeof parsed.brand_tone === "string" ? parsed.brand_tone.trim().slice(0, 200) : undefined;
  const brand_industry = typeof parsed.brand_industry === "string" ? parsed.brand_industry.trim().slice(0, 200) : undefined;
  const primary_font = typeof parsed.primary_font === "string" ? parsed.primary_font.trim().slice(0, 120) : undefined;

  return {
    description,
    brand_guidelines,
    suggestedColors,
    ...(brand_tone && { brand_tone }),
    ...(brand_industry && { brand_industry }),
    ...(primary_font && { primary_font }),
  };
}

const LOGO_COLORS_MODEL = "gemini-2.5-flash";
const LOGO_COLORS_TIMEOUT_MS = 15_000;

/** Translate text to English. Returns original if empty or on failure. Used for brand import description. */
export async function translateToEnglish(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const contents = [{ text: `Translate the following to English. Preserve the meaning. Output only the translation, no quotes or explanation.\n\n${trimmed}` }];
  const genConfig = { temperature: 0.2, maxOutputTokens: 512, httpOptions: { timeout: 10_000 } };
  try {
    let result: Awaited<ReturnType<typeof gemini.models.generateContent>>;
    try {
      result = await gemini.models.generateContent({
        model: PROMPT_ENHANCE_MODEL,
        contents,
        config: genConfig,
      });
    } catch (err) {
      if (!isRetryableGeminiError(err)) throw err;
      result = await gemini.models.generateContent({
        model: FALLBACK_TEXT_MODEL,
        contents,
        config: genConfig,
      });
    }
    const out = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return (out && out.length > 0) ? out.slice(0, 2000) : trimmed;
  } catch {
    return trimmed;
  }
}

/** True if most of the hex colors are grayscale (R≈G≈B). Used to retry with full logo when favicon yields only grays. */
export function isMostlyGrayscale(hexColors: string[]): boolean {
  if (hexColors.length === 0) return true;
  const GRAY_THRESHOLD = 35;
  let grayscaleCount = 0;
  for (const hex of hexColors) {
    const m = hex.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
    if (!m) continue;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (spread <= GRAY_THRESHOLD) grayscaleCount++;
  }
  return grayscaleCount >= Math.ceil(hexColors.length * 0.6);
}

/** Extract up to 6 dominant hex colors from a logo image (URL). Used for brand import. */
export async function extractColorsFromLogoImage(logoUrl: string): Promise<string[]> {
  if (!logoUrl || !logoUrl.startsWith("http")) return [];
  let buffer: ArrayBuffer;
  let mime = "image/png";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(logoUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const ct = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (!ct.includes("image")) return [];
    if (ct.includes("jpeg") || ct.includes("jpg")) mime = "image/jpeg";
    else if (ct.includes("webp")) mime = "image/webp";
    buffer = await res.arrayBuffer();
  } catch {
    return [];
  }
  const base64 = Buffer.from(buffer).toString("base64");
  const prompt = `Look at this image. It is a logo or brand icon.

Step 1: Scan the image and identify the colors in it. What are the main colors you see? (e.g. one blue, one red, black, white—whatever is actually in the logo.)

Step 2: Decide how those colors should be used for brand roles. Output exactly 6 hex codes in this order: [primary, secondary, accent, cta/button, background, headline]. Use only colors you see in the logo; you choose which color goes to which role. If the logo has fewer than 6 colors, repeat some and use #000000 or #ffffff only where it makes sense (e.g. background or headline).

Return a JSON object with one key: "suggestedColors", an array of exactly 6 hex codes. Output only the JSON object, one line, no other text.`;

  const contents = [createPartFromText(prompt), createPartFromBase64(base64, mime)];
  const genConfig = { temperature: 0.2, maxOutputTokens: 256, httpOptions: { timeout: LOGO_COLORS_TIMEOUT_MS } };

  let result: Awaited<ReturnType<typeof gemini.models.generateContent>>;
  try {
    result = await gemini.models.generateContent({
      model: LOGO_COLORS_MODEL,
      contents,
      config: genConfig,
    });
  } catch (err) {
    if (!isRetryableGeminiError(err)) throw err;
    result = await gemini.models.generateContent({
      model: FALLBACK_TEXT_MODEL,
      contents,
      config: genConfig,
    });
  }

  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) return [];
  const parsed = parseJsonFromModelResponse<{ suggestedColors?: unknown }>(raw);
  const rawColors = Array.isArray(parsed.suggestedColors)
    ? (parsed.suggestedColors as unknown[])
        .filter((c): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c))
        .slice(0, 6)
    : [];
  const padOnlyBlackWhite = ["#ffffff", "#000000"];
  return rawColors.length >= 6
    ? rawColors
    : [...rawColors, ...padOnlyBlackWhite, ...padOnlyBlackWhite].slice(0, 6);
}

# Blinkify — image generation prompts (reference)

This document lists **image-only** prompt text and system instructions used in the product: **Ad Creative** (`POST /workspaces/:workspaceId/projects/:projectId/generate`), the **prompt enhancer**, **client-side ad style wrapping**, and **Marketing Email** image generation. **Video prompts are excluded.**

Sources: `apps/api/src/lib/gemini.ts`, `apps/api/src/routes/generations.ts`, `apps/web/src/components/dashboard/creative-studio-chat.tsx`, `apps/api/src/lib/ad-styles.json`.

---

## 1. Request flow (Ad Creative)

1. The web app sends a **user prompt** (optionally wrapped with ad style — see §7).
2. The API builds **`baseSystemInstruction`** = `SYSTEM_INSTRUCTION` + optional `--- PROJECT INSTRUCTIONS ---` + `buildProjectInstructions(project)`.
3. **Contents** sent to the image model are either:
   - **Single / multi (non-carousel):** `[{ text: prompt }, …reference images as inlineData]`
   - **Carousel:** per slide, `[{ text: "Slide i of N. Content for this slide: …" }, …images]` and **carousel system block** appended (see §5).
4. **`enhancePromptForAdCreative`** is **not** called inside the main `/generate` route for Ad Creative; it is used by **`POST …/enhance-prompt`** and by **email** image prompts (see §8–9).

---

## 2. Universal system instruction (`SYSTEM_INSTRUCTION`)

Every Ad Creative and email image call uses this as the base system instruction (before project block and carousel block):

```text
You are Blinkify's AI image generation engine — a specialist in creating professional advertising creatives and marketing visuals.

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
- The image must be complete, polished, and ready for use — no placeholders, no sketch-quality output.
```

---

## 3. Project instructions block (`buildProjectInstructions`)

Appended when the project has data, under:

`--- PROJECT INSTRUCTIONS ---`

Built from (non-empty fields only):

| Field | Line pattern |
|--------|----------------|
| Name | `Project: {name}` |
| Website | `Website URL (use for CTA and link buttons in marketing emails): {url}` |
| Brand logo | Fixed paragraph: logo must appear in the ad, lower area, match exactly |
| Description | `Description: …` |
| Target audience | `Target audience: …` |
| Brand colors | `Primary/Secondary` hex lines + `Background: always use white (#FFFFFF)` + `Accent: always use white (#FFFFFF)` |
| Brand fonts | `Brand fonts: …` |
| Font styles | `Headline/CTA/Description` lines from `font_styles` |
| Guidelines | Parsed `BRAND_TONE:`, `BRAND_INDUSTRY:`, and remaining guideline text (gradient lines stripped) |

---

## 4. Multiple images without carousel (`numberOfImages` 2–4, `carousel: false`)

- **User text:** The same **`prompt`** string is used for **every** image in the batch.
- **Contents:** Identical `[{ text: prompt }, …input images]` for each parallel generation.
- **Variation:** Different **random seeds** per image (`seed` per index); index `0` can use a client-provided `seed` if sent.
- **System instruction:** `baseSystemInstruction` only — **no** carousel block.

---

## 5. Carousel mode (`carousel: true`, `numberOfImages` 2–4)

When carousel is on, the API requires **`slidePrompts`** — an array of length **`numberOfImages`**, each slide non-empty, max **800** characters per slide (`CAROUSEL_SLIDE_PROMPT_MAX_LENGTH`).

### 5.1 Per-generation user text (contents)

For slide index `i` (0-based):

```text
Slide {i+1} of {numberOfImages}. Content for this slide: {slidePrompts[i]}
```

Then the same **reference images** (`inputImages`) are appended as `inlineData` parts.

### 5.2 Extra system instruction (`getCarouselSystemBlock(slideIndex, totalSlides)`)

Appended to `baseSystemInstruction` for that slide:

```text

--- CAROUSEL SLIDE (do not skip) ---
This image is ONE SLIDE of a social media carousel (Instagram/Facebook). It will be viewed in sequence with other slides.
- Total slides in the carousel: {totalSlides}. This is slide {slideIndex} of {totalSlides}.
- Use a consistent, professional social-post style: clear layout, safe margins, one main idea per slide.
- Include a visible "Slide {slideIndex} of {totalSlides}" (or similar) so viewers know the order, unless the user's content already implies it.
- Text must be legible and on-brand. Optimize for 4:5 or 1:1 carousel format.
- The user's prompt below is the content for THIS slide only. Do not combine or reference other slides.
```

---

## 6. Reference images & edit-from-previous

- **User uploads:** `inputImages[]` (base64 + mime) — merged with optional **brand logo** prepended (logo first, then user images, capped by `MAX_INPUT_IMAGES`).
- **Reply / edit:** If `editFromGenerationId` is set, the **previous generation’s result image** is downloaded from storage and prepended (before logo merge logic) so the model edits from that asset.

---

## 7. Client-side: Ad style wrapper (`buildImagePromptWithAdStyle`)

When **Ad style** is not `"none"` and a style exists in config, the prompt sent to the API is:

```text
{userPrompt}

{nano_banana_suffix from ad-styles config}

Aspect ratio: {imageOptions.aspectRatio}. Brand primary color: {primaryHex}. Brand secondary color: {secondaryHex}.
```

### `nano_banana_suffix` values (from `apps/api/src/lib/ad-styles.json`)

| Style id | Suffix |
|----------|--------|
| `luxury_editorial` | Ultra high resolution commercial product photography. CGI rendered. Luxury cosmetics advertisement. Clean studio environment. Professional retouching. No people. Product focused. |
| `element_explosion` | Dynamic product advertisement photography. Liquid splash elements in motion freeze-frame. Dramatic studio lighting. Commercial advertising aesthetic. CGI composite. Ultra sharp product. No people. |
| `product_in_action` | Dramatic product advertisement with ingredient explosion. Dark background. Commercial food and beverage photography. High contrast. Ultra sharp product details with visible label. Dynamic composition. No people. |

---

## 8. Prompt enhancement (Blinkify AI Prompt Generator)

Used by **`POST …/enhance-prompt`** and inside **email** image prompt building (`enhancePromptForAdCreative`).

### 8.1 User content to the enhancer

- If project has data:  
  `PROJECT SETTINGS:\n{buildProjectInstructions(project)}\n\nUSER PROMPT:\n{trimmed user prompt}`
- Else:  
  `{trimmed user prompt}`

### 8.2 System: `PROMPT_ENHANCE_SYSTEM`

Full text lives in `apps/api/src/lib/gemini.ts` (expert prompt engineer for Nano Banana 2; hierarchy: user → project → defaults; product vs lifestyle vs static ad vs content; composition; text in image; lighting; brand; references; **single flowing paragraph output**, max **4000** characters in instructions; output clipped to **4500** when passed downstream).

---

## 9. Marketing Email — image prompts (1–3 images, not video)

Uses the same **`SYSTEM_INSTRUCTION`** + project block as Ad Creative.

Shared suffixes:

```text
EMAIL_REALISM_SUFFIX = " Ultra realistic, photorealistic, real-life photography, 8K quality, sharp detail. No fantasy, cartoon, or artificial look — must look like a real photograph."

NO_CTA = " Do not include any buttons, CTAs, or call-to-action elements in the image; the email HTML will add those separately."
```

### 9.1 Hero (image 1 of 1, 2, or 3)

**Non-template** path builds `heroPromptBase`:

```text
Email hero/banner image for this campaign. {onlyOrFirst} Headline: "{emailCopy.headline}". Mood and message: {first 300 chars of introCopy}. Single strong visual, on-brand, professional. Do not put long text or headlines in the image — the email copy will provide that.{NO_CTA} Conversion-focused, clean composition.{EMAIL_REALISM_SUFFIX}
```

Where `onlyOrFirst` is one of:

- 1 image: `This is the only image in the email — make it the single hero that carries the whole message.`
- 2 images: `This is the first of two images. Opening/hero visual.`
- 3 images: `This is the first of three images. Opening hero visual.`

Then **`enhancePromptForAdCreative(heroPromptBase, project)`** runs (fallback to base on error). Template emails may use **`buildTemplateReplacePrompt`** / **`buildTemplateImagePromptSuffix`** instead.

### 9.2 Second image (when `numberOfImages >= 2`)

Base before enhancement:

```text
This is the second of two images. Must be clearly different from the first — different angle, scene, or detail. Supporting/mid-email visual for the same campaign. Headline: "{headline}". Mood: {first 200 chars of introCopy}. No long text.{NO_CTA} Professional, on-brand. Do not repeat or duplicate the first image's composition or subject.{EMAIL_REALISM_SUFFIX}
```

Then **`enhancePromptForAdCreative(secondBase, project)`**.

### 9.3 Third image (when `numberOfImages >= 3`)

Base before enhancement:

```text
This is the third of three images. Closing visual — distinct from the first and second. Different angle, scene, or focus. Headline: "{headline}". Mood: {first 200 chars of introCopy}. No long text.{NO_CTA} Professional, on-brand. Do not repeat the previous two images.{EMAIL_REALISM_SUFFIX}
```

Then **`enhancePromptForAdCreative(thirdBase, project)`**.

---

## 10. Limits (Ad Creative route)

| Item | Limit |
|------|--------|
| `prompt` (non-carousel) | 4500 characters |
| Each carousel slide | 800 characters |
| `numberOfImages` | 1–4 |

---

## 11. Claude — Full Campaign image prompts only (`claude.ts`)

**Where this runs:** `generateCampaignImagePrompts()` in `apps/api/src/lib/claude.ts`. Claude writes **Nano Banana–ready `generation_prompt` strings** (plus on-image overlay copy) for the **Full Campaign** flow — **not** the Creative Studio **Ad Creative** `/generate` route (that path uses Gemini with §2–§5 in this doc).

**Outputs (image-related):** six structured image prompts — `image_feed_1..3` (4:5 Meta feed) and `image_story_1..3` (9:16 stories) — plus `email_image_prompts` (three email image briefs). Below focuses on **static image** instructions; **Veo video** strings in the same JSON are omitted here.

### 11.1 System messages

**`BASE_SYSTEM`**

- Creative director for Blinkify; **JSON only** (no prose/markdown).
- Image prompts: be specific about **lighting, composition, mood, colors, style**.
- Final copy only — no placeholders; use real product details.

**`IMAGE_SYSTEM`** (appended to base)

- Outputs feed **Nano Banana** (image) and Veo (video) — for this doc, only the image side matters.

**`AD_STYLES_SYSTEM`** (large block appended to `IMAGE_SYSTEM`)

Tells Claude how to **choose and apply** creative styles, exclude bad style/industry pairs, apply **campaign goal** modifiers (new launch, flash sale, seasonal, brand awareness), apply **industry-specific** atmosphere/composition rules, and follow the **IMAGE PROMPT FORMULA**: `[STYLE TAG]` → product description → background rules (bright vs dark product → background color logic) → lighting mode → atmospheric elements → composition → quality line (“Ultra high resolution commercial product photography…”). The same file also embeds **VIDEO PROMPT FORMULA** and headline/email rules — **ignore video** if you only care about images.

**Authoritative copy:** `apps/api/src/lib/claude.ts` (`BASE_SYSTEM`, `IMAGE_SYSTEM`, `AD_STYLES_SYSTEM`).

### 11.2 User message: brand context + lighting + style lock (`buildBrandContext` + start of `buildImagePromptsUserPrompt`)

Claude receives **BRAND DETAILS** (name, description, industry, audience, tone, colors, website, logo, guidelines, social links), **CREATIVE STYLE PREFERENCE** (or Auto), **CAMPAIGN PARAMETERS** (product line, goal, platforms, extra context), and either:

- “A product photo is attached…” → use it for **all** image prompts, or  
- Generate scenes from brand text only.

**Industry:** optional **INDUSTRY BACKGROUND RULE** from `getIndustryBackgroundRule`.

**LIGHTING MODE** (one for **all** campaign images): chosen from brand tone — `DRAMATIC_STUDIO`, `SOFT_NATURAL`, `LUXURY_DIFFUSED`, `CLINICAL_FLAT`, `WARM_GOLDEN`, default `SOFT_NATURAL`. Must be **applied consistently** in every image prompt; must not mismatch tone (e.g. no dramatic studio for a warm/natural brand).

**STYLE LOCK:** Pick **one** creative style (Luxury Editorial, Element Explosion, Product In Action, Lifestyle Context, Clean Minimal, per the AD_STYLES rules). State it in **`image_feed_1.style_chosen`**, then use the **same** style for **all remaining feed/story images** and the **three email image briefs** — **do not re-pick style** per image.

### 11.3 Multiple images / “variations” — **CRITICAL VARIATION RULE**

Claude is explicitly told (before the JSON schema):

```text
You are generating 6 images of the same product (3 feed images (4:5 vertical), 3 story images (9:16)). They MUST look like 6 different photographs taken by a professional photographer in the same studio session.
Same: creative style, color palette, lighting philosophy, atmospheric elements.
Different: camera position, framing, composition, depth of field, crop.
The shot type tag ([HERO FRONT], [45 DEGREE], [MACRO DETAIL], [HERO VERTICAL], [LOW HEROIC], [FLAT LAY VERTICAL]) is a hard assignment — not a suggestion.
Lock the creative style chosen in image_feed_1 and use it identically for all 6 images.
Do not re-evaluate style for story images.
```

So for **2 or more “variations”** in this pipeline: **same brand/style/lighting family**, **six distinct shot types** — not six copies of the same framing.

### 11.4 The six Nano Banana image prompts (shot types)

Each `generation_prompt` must **start with the bracketed tag** and follow the long inline instructions in code (length 120–200 words depending on shot). Summary:

| Key | Format | Shot concept |
|-----|--------|----------------|
| `image_feed_1` | 4:5 | **[HERO FRONT]** — straight-on, eye level, centered hero, deep focus, front diffused light. |
| `image_feed_2` | 4:5 | **[45 DEGREE]** — 45° left, elevated; product on right third; shallow depth of field; side-key light. |
| `image_feed_3` | 4:5 | **[MACRO DETAIL]** — extreme close-up on one compelling product detail; very shallow DOF; raking light. |
| `image_story_1` | 9:16 | **[HERO VERTICAL]** — product in **center vertical third**; space for text top/bottom. |
| `image_story_2` | 9:16 | **[LOW HEROIC]** — camera below product, looking up; towering hero, dramatic light from above. |
| `image_story_3` | 9:16 | **[FLAT LAY VERTICAL]** — overhead flat lay with 5–7 contextual props; vertical 9:16 composition. |

Each object also includes **`overlay_headline`**, **`overlay_cta`**, **`overlay_subtext`** with max word counts (feed vs story differ slightly).

### 11.5 How this relates to Creative Studio “2+ variations” (§4–§5)

| Feature | Mechanism |
|--------|-----------|
| **Creative Studio Ad Creative** — 2–4 images, **not** carousel | Same user **prompt** + **different random seeds** per image (§4). |
| **Creative Studio** — **carousel** | Per-slide **slidePrompts** + carousel system block (§5). |
| **Full Campaign (Claude)** | **Six** fixed **shot-type** prompts + **style/lighting lock** + variation rule (§11.3–11.4). |

---

## 12. Not covered here (by design)

- **Video** generation prompts (Veo, `video-generations`, `video_veo` / `veo_*` in `ad-styles.json`, and the **video** portions of `AD_STYLES_SYSTEM` in `claude.ts`).
- **Full campaign** execution in `campaign.ts` (orchestration), beyond what Claude is **asked** to output above.
- **Creative Studio chat** assistant (`CREATIVE_STUDIO_CHAT_SYSTEM`) — text/JSON intent only, not the image model’s system prompt.

**Source of truth:** **`gemini.ts`** + **`generations.ts`** (Creative Studio / email API images); **`claude.ts`** (Full Campaign Claude → Nano Banana prompt JSON).

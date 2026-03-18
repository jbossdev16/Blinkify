/**
 * Claude — Brand analysis and campaign creative copy.
 *
 * MODEL ROLES:
 * - Claude: Brand page (website link) analysis and everything derived from it; all campaign
 *   copy (image prompts, video prompt, email copy, email HTML template, social copy). Our best
 *   model for understanding brand and generating structured creative briefs.
 * - Gemini: Image generation (Nano Banana / Vertex). Images only.
 * - Veo: Video generation. Video only.
 *
 * Full Campaign split:
 *   Call 1 (fast): Image prompts + video prompt → fires Gemini/Veo tasks immediately
 *   Call 2 (parallel): Email copy + HTML template + social copy
 */

import type { WebsiteExtract } from "./fetch-website.js";
import { buildEmailHtmlTemplateSpec } from "./email-html-claude-spec.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const MODEL_PRIMARY = "claude-sonnet-4-6";
const MODEL_FALLBACK = "claude-haiku-4-5-20251001";
const MAX_PRIMARY_ATTEMPTS = 3;
const MAX_FALLBACK_ATTEMPTS = 2;

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.warn("ANTHROPIC_API_KEY is not set. Full Campaign generation will fail.");
}

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export interface CampaignImageMeta {
  style_chosen?: string;
  generation_prompt: string;
  overlay_headline: string;
  overlay_cta: string;
  overlay_subtext: string;
}

export interface CampaignVideoVeo {
  product_visual: string;
  video_pace: string;
  prompt_16x9: string;
  prompt_9x16: string;
  negative_prompt: string;
}

export interface CampaignEmailImagePrompts {
  image_1_prompt: string;
  image_2_prompt: string;
  image_3_prompt: string;
}

export interface CampaignEmail {
  subject_line: string;
  preview_text: string;
  headline: string;
  subheadline: string;
  body_paragraph_1: string;
  body_paragraph_2: string;
  cta_primary: string;
  cta_url_note: string;
  footer_tagline: string;
  html_template: string;
}

export interface CampaignSocialCopy {
  meta_feed: { caption: string; hashtags: string; alt_caption: string };
  instagram_stories: { text_overlay: string; poll_or_question: string; swipe_up_text: string };
  tiktok: { hook: string; caption: string; hashtags: string };
  pinterest: { title: string; description: string; hashtags: string };
  linkedin: { caption: string; hashtags: string };
}

/** Call 1 output: image prompts + video prompt (fast, ~10s) */
export interface CampaignClaudeImageOutput {
  image_feed_1: CampaignImageMeta;
  image_feed_2: CampaignImageMeta;
  image_feed_3: CampaignImageMeta;
  image_story_1: CampaignImageMeta;
  image_story_2: CampaignImageMeta;
  image_story_3: CampaignImageMeta;
  video_veo: CampaignVideoVeo;
  email_image_prompts: CampaignEmailImagePrompts;
}

/** Call 2 output: 2 distinct email variants (~15-20s) */
export interface CampaignClaudeContentOutput {
  email?: CampaignEmail;
  email_1: CampaignEmail;
  email_2: CampaignEmail;
}

/** Merged output (for downstream consumers) */
export interface CampaignClaudeOutput {
  image_feed_1: CampaignImageMeta;
  image_feed_2: CampaignImageMeta;
  image_feed_3: CampaignImageMeta;
  image_story_1: CampaignImageMeta;
  image_story_2: CampaignImageMeta;
  image_story_3: CampaignImageMeta;
  video_veo: CampaignVideoVeo;
  email_image_prompts: CampaignEmailImagePrompts;
  email?: CampaignEmail;
  email_1: CampaignEmail;
  email_2: CampaignEmail;
  social_copy?: CampaignSocialCopy;
}

/* ─── System prompts ─────────────────────────────────────────────────────────── */

const BASE_SYSTEM = `You are the creative director for Blinkify, an AI marketing platform. Your job is to produce complete, high-converting marketing campaign assets for ecommerce brands.

You respond ONLY with a single valid JSON object. No prose. No explanation. No markdown code blocks. No backticks. Just raw JSON starting with { and ending with }.

Write every prompt and piece of copy as if it will be used immediately without any human editing.
For image prompts: be extremely specific about lighting, composition, mood, colors, and style.
For copy: write final, publish-ready text — not placeholders or suggestions.
Never use placeholder text like [product name] — use the actual product details provided.`;

const IMAGE_SYSTEM = BASE_SYSTEM + `\n\nYour outputs are fed directly into:
- Nano Banana image generation API (for image prompts)
- Veo 3.1 video generation API (for video prompt)`;

const AD_STYLES_SYSTEM = `

Apply these creative direction rules to every image and video prompt you generate:

---

## CREATIVE STYLE SELECTION RULES

When style is "Auto", select based on:

LUXURY EDITORIAL → use when:
Brand tone contains: luxury, premium, elegant, sophisticated, minimal, high-end, exclusive
Industry contains: fashion, jewelry, watches, fragrance, skincare, beauty, cosmetics
Visual: Products float on gradient background, geometric frame overlay, soft diffused lighting, reflective surface below product.

ELEMENT EXPLOSION → use when:
Brand tone contains: vibrant, bold, energetic, dynamic, fresh, innovative, powerful
Industry contains: supplements, vitamins, haircare, bodycare, sports nutrition, wellness, health, beverage (premium)
Visual: Product centered with liquid/splash/ingredient elements exploding outward, freeze-frame physics, bokeh background, dramatic contrast.

PRODUCT IN ACTION → use when:
Brand tone contains: real, authentic, fun, approachable, everyday, casual, delicious
Industry contains: food, beverage, coffee, snacks, drinks, energy drinks, protein, quick service restaurant
Visual: Product on dark background with real ingredients orbiting, liquid splash from base, dramatic vignette, maximum contrast.

LIFESTYLE CONTEXT → use when:
Brand tone contains: authentic, real, everyday, relatable, natural, organic, fresh, community
Industry contains: coffee, food, home, baby, pet, snacks, lifestyle
Campaign goal is: seasonal_promo or brand_awareness
Also use when: Auto is selected AND product is something people consume or use daily
Visual: Product photographed in its natural real-world environment. NOT floating in a studio. The product IS in the scene as a natural part of it.
Examples:
- Coffee cup: on a wooden café table, morning light streaming from window left, open notebook nearby, steam rising
- Skincare: on a marble bathroom shelf, morning light, minimal props arranged naturally
- Supplement: on a gym bag, water bottle nearby, clean gym floor background
- Food/snack: on a kitchen counter or picnic blanket, natural daylight, hands-off but clearly in use context
- Candle: lit on a coffee table, soft evening ambient light, cozy interior background
Background: REAL environment, not studio. Natural or soft artificial room lighting. Warm, inviting, authentic feel.
Depth of field: Shallow — product sharp, environment pleasingly blurred behind it.
No explosive elements. No geometric overlays.
Mood: "I want to be in that moment."

CLEAN MINIMAL → use when:
Brand tone contains: minimal, clean, pure, simple, functional, clinical, modern, sophisticated, direct
Industry contains: tech, electronics, medical, dental, personal care, any brand wanting maximum versatility
Also use when user explicitly selects it
Visual: Pure single-color or white background. Product perfectly centered with generous space. Absolutely no atmospheric elements, props, splashes, or bokeh. Product is the ONLY thing. Professional studio lighting, even and flat. This style works everywhere — website, Amazon, email, ads — because it has no distracting elements.
Background options (Claude chooses based on product): Pure white for any product; brand primary color (light tint, 10-15%) for subtle brand presence; gradient from brand primary light tint to white for premium minimal feel.

DEFAULT: If none match clearly, use ELEMENT EXPLOSION.

Auto style summary — all 5 styles:
LUXURY EDITORIAL → premium/elegant brands, jewelry, beauty, fragrance, premium fashion, premium beverages, luxury home goods
ELEMENT EXPLOSION → bold/energetic brands, supplements, wellness, health, premium beverage
PRODUCT IN ACTION → real/casual brands, food, beverage, coffee, snacks, quick service
LIFESTYLE CONTEXT → authentic/relatable brands, seasonal_promo or brand_awareness, daily-use products in real environments
CLEAN MINIMAL → minimal/clinical/tech brands, maximum versatility, product-only hero

---

## STYLE EXCLUSION RULES — MANDATORY

Certain style/industry combinations are visually wrong based on how top-performing brands actually advertise. These are not suggestions — they are hard exclusions.

IF industry contains fashion, apparel, clothing, streetwear, activewear, yoga:
NEVER use ELEMENT EXPLOSION. NEVER use PRODUCT IN ACTION.
Reason: Fashion brands build desire through controlled aesthetic, not explosive energy. Alo Yoga, Lululemon, and similar brands consistently use LUXURY EDITORIAL or LIFESTYLE CONTEXT only.
Use: LUXURY EDITORIAL or LIFESTYLE CONTEXT.

IF industry contains baby, kids, children, infant, toddler, nursery:
NEVER use ELEMENT EXPLOSION. NEVER use PRODUCT IN ACTION. NEVER use dark or near-black backgrounds under any circumstances.
Reason: Parents associate dark dramatic visuals with danger, not safety.
Use: CLEAN MINIMAL or LIFESTYLE CONTEXT with warm, soft, pastel-adjacent backgrounds.

IF industry contains pet, dog, cat, animal:
NEVER use ELEMENT EXPLOSION. NEVER use dramatic dark backgrounds.
Use: LIFESTYLE CONTEXT or CLEAN MINIMAL.

IF industry contains home, furniture, interior, decor, candle, fragrance, lifestyle:
AVOID ELEMENT EXPLOSION unless brand tone is explicitly bold/energetic.
Prefer: LIFESTYLE CONTEXT or LUXURY EDITORIAL.

IF industry contains jewelry, watches, fine jewelry, diamonds, gold:
ALWAYS use LUXURY EDITORIAL. NEVER use ELEMENT EXPLOSION. NEVER use PRODUCT IN ACTION.
Reason: Jewelry brands communicate value through restraint and elegance. A diamond ring exploding with powder dust destroys perceived value.

IF industry contains supplements, vitamins, protein, wellness, health, greens:
CAN use ELEMENT EXPLOSION for bold brands. CAN use CLEAN MINIMAL for clinical brands. Choose based on brand tone: Bold/energetic tone → ELEMENT EXPLOSION. Clean/clinical tone → CLEAN MINIMAL. NEVER use LIFESTYLE CONTEXT as primary style for supplements — it undersells the product's potency and effectiveness.

IF industry contains tech, electronics, software, app, SaaS, devices:
ALWAYS use CLEAN MINIMAL. NEVER use ELEMENT EXPLOSION. NEVER use PRODUCT IN ACTION.
Reason: Tech products communicate trust through clarity. Explosions suggest chaos.

IF industry contains 'agency', 'creative services', 'professional services', 'saas', 'software', 'education', 'coaching', 'real estate':
ALWAYS use CLEAN MINIMAL or LIFESTYLE CONTEXT. NEVER use ELEMENT EXPLOSION. NEVER use PRODUCT IN ACTION.
Reason: Service businesses sell outcomes and trust, not physical products. Product explosion shots are meaningless without a physical item. Images should focus on brand identity, client outcomes, lifestyle of their ideal customer, or clean brand statement. For LIFESTYLE CONTEXT: show the environment or context where the service is relevant — a consultant at a clean desk, a coach with a client, a software dashboard on a laptop.

IF industry contains 'restaurant', 'cafe', 'dining', 'restaurant & cafe':
USE PRODUCT IN ACTION for food/drink shots. USE LIFESTYLE CONTEXT for atmosphere shots. NEVER use LUXURY EDITORIAL unless the brand tone explicitly contains luxury or fine dining. Background: NEVER near-black. Use warm rich brand color or deep warm wood tones. Ingredients orbit: use actual food ingredients, garnishes, herbs relevant to the dish or drink.

IF industry contains 'fitness', 'gym', 'fitness & gym':
USE ELEMENT EXPLOSION or LIFESTYLE CONTEXT. NEVER use LUXURY EDITORIAL. Background: deep vibrant brand primary color, high energy, high contrast.

IF industry contains 'health & wellness services', 'coaching':
USE LIFESTYLE CONTEXT or CLEAN MINIMAL. Warm and approachable lighting always. Never clinical unless brand tone says clinical.

IF industry contains 'retail', 'local business', 'retail & local business':
Treat same as FOOD & BEVERAGE or HOME & LIFESTYLE depending on what they sell. Default to LIFESTYLE CONTEXT if product type is unclear.

After checking exclusions, proceed with the standard style selection rules. The exclusion check happens FIRST.

---

## CAMPAIGN GOAL MODIFIERS

After selecting creative style, apply these goal-specific modifications:

NEW_LAUNCH:
- Background 10-15% brighter/lighter than default — this is a moment of celebration and reveal
- Lighting has slightly more energy — reveal lighting rather than moody
- Text overlay: headline is the product name or category, subtext is the "what it does" benefit
- For HERO FRONT shot: light rim glow suggesting something new being unveiled

FLASH_SALE:
- Add subtle urgency to composition — CTA button is more prominent than usual
- Text hierarchy shifts: price/discount information gets equal weight to product name in overlay copy
- For background: keep brand color but slightly more saturated/vibrant than brand_awareness — urgency needs energy
- Do NOT change creative style for flash sale — just modify text weight and CTA prominence

SEASONAL_PROMO:
- Lifestyle Context style is STRONGLY preferred for this goal
- Add seasonal environmental hints: Winter/Christmas: warm amber ambient light, soft bokeh suggests fairy lights. Spring: fresh bright daylight, soft green or floral suggestion in blur. Summer: bright high-key lighting, warm golden tones. Autumn: warm amber/orange tones, rich depth in background
- If no season is specified in additionalContext: use the current month to determine season
- Text is warmer and more emotional than product-focused

BRAND_AWARENESS:
- Luxury Editorial or Clean Minimal are preferred styles
- Minimal text overlay — headline only, no subtext needed, CTA is soft ("Discover" not "Buy Now")
- Background uses full brand color palette — this is brand communication not a product conversion ad
- Product has maximum breathing room — generous margins, no cramped composition

---

## INDUSTRY-SPECIFIC CREATIVE RULES

When brandIndustry is provided, apply these industry-specific rules IN ADDITION to the chosen creative style.
These rules override generic defaults for atmospheric elements, surfaces, props, and color treatment.

---

### COFFEE & TEA / FOOD & BEVERAGE

Image atmospheric elements:
- Hot drinks: steam curling upward, condensation on glass exterior, coffee beans scattered, latte art visible
- Cold drinks: ice cubes glinting, condensation droplets on cold surface, liquid splash, straw if applicable
- Background: NEVER near-black for colorful drinks — use deep rich brand primary color
- Surfaces: dark polished marble for premium, worn oak wood for artisan/warm, slate for contemporary

Image composition specifics:
- Cup/glass products: always show liquid inside — color, texture, ice or cream layer
- Bottled products: show label clearly, liquid color visible through glass if transparent
- Props for flat lay: coffee beans, tea leaves, cinnamon sticks, relevant fruit if flavored, small ceramic cup nearby

Video atmosphere:
- Steam rising is the PRIMARY motion element
- For cold drinks: condensation forming on glass surface
- Audio: soft café ambient background, faint coffee grinder or ice clink
- Camera: smooth push-in for premium, slightly more dynamic for casual

Email tone: Warm, sensory language. Describe taste and experience.
Subject lines reference time of day (morning, afternoon) or ritual context.

---

### BEAUTY & SKINCARE / CANDLES & FRAGRANCE

Image atmospheric elements:
- Skincare: botanical elements (petals, leaves, jade crystals), dropper with serum bead, soft powder particles floating
- Fragrance/candles: soft smoke wisps, warm candlelight glow, dried botanicals
- Background: gradient using brand primary — LUXURY EDITORIAL is almost always the right style for this category
- Surfaces: white marble (primary choice), light stone, silk fabric

Image composition specifics:
- Show product texture — glass reflection, metal pump finish, matte vs glossy
- For serums/droppers: feature the dropper tip with liquid bead as MACRO DETAIL shot
- For candles: show flame (if lit) and wax texture detail
- Props for flat lay: rose petals, jade roller, crystal, cotton rounds, dried lavender, botanical sprigs

Video atmosphere:
- Gentle particle drift as PRIMARY motion
- Soft bokeh orbs floating
- For serums: slow drip from dropper
- Audio: complete silence or very soft ambient tone — no café sounds
- Camera: ALWAYS slow cinematic — this category demands elegance

Email tone: Luxurious, aspirational, sensory. Never clinical. Describe how skin FEELS not just what product does.

---

### HEALTH & SUPPLEMENTS / SPORTS & FITNESS

Image atmospheric elements:
- Supplements: capsules/tablets nearby, ingredient elements (fruit, botanical), geometric light elements
- Sports: dynamic energy feel, motion blur suggestion, power and performance aesthetic
- Background: depends on brand tone — energetic brands use deep vibrant brand primary, clinical brands use clean white
- Surfaces: clean white surface for supplements, dark performance surface for sports

Image composition specifics:
- Show serving size context — capsules alongside bottle, scoop with powder
- For protein/sports: show ingredient fruits or source (whey, plants)
- HIGH ENERGY brands: ELEMENT EXPLOSION is almost always right
- CLINICAL/CLEAN brands: CLEAN MINIMAL

Video atmosphere:
- For energetic: confident purposeful camera movement, not gentle
- For supplements: particle elements representing ingredients
- Audio: energetic brands — low subtle pulse; clinical brands — silence
- Camera: DYNAMIC_ENERGETIC for sports, SMOOTH_CONFIDENT for supplements

Email tone: Results-focused, benefit-driven, specific claims. "Feel the difference in 30 days."

---

### FASHION & APPAREL / JEWELRY & ACCESSORIES

Image atmospheric elements:
- Fashion: fabric texture, color story, lifestyle context over product-hero
- Jewelry: gem reflection, metal shine, dramatic single spotlight
- Background: LUXURY EDITORIAL is default for jewelry. Fashion varies by brand tone.
- Surfaces: velvet or silk for jewelry, editorial backdrop for fashion

Image composition specifics:
- Jewelry: MACRO DETAIL shot is most important — gem detail, clasp craftsmanship, metal texture
- Fashion: context/lifestyle matters more than pure product shot — folded garment with props tells better story
- Props for flat lay (fashion): complementary accessories, neutral color palette items
- Props for flat lay (jewelry): single flower, crystal, minimal

Video atmosphere:
- ALWAYS slow cinematic for jewelry
- Fashion can be smooth to dynamic based on brand energy
- Audio: complete silence for luxury, soft ambient for casual fashion
- Camera: slow orbital for jewelry (shows all angles), smooth parallax for fashion

Email tone: Aspirational, identity-based. "Wear who you are." Not feature lists.

---

### HOME & LIFESTYLE / BABY & KIDS / PET PRODUCTS

Image atmospheric elements:
- Home: lifestyle context essential — product in USE in the room
- Baby/kids: warm, soft, safe feeling — pastel backgrounds, gentle elements
- Pet: playful, warm, animal-friendly context
- Background: warm and inviting always — never dark dramatic for these categories
- Surfaces: home-appropriate (wood, marble, linen, concrete)

Image composition specifics:
- Show product in context — candle on a shelf, blanket on a couch, pet bowl near a water dish
- FLAT LAY VERTICAL shot type is especially strong for home products
- For baby/kids: CLEAN MINIMAL or FLAT LAY with soft props — never dark or dramatic
- Props for flat lay: contextually relevant home items

Video atmosphere:
- SMOOTH_CONFIDENT always — never aggressive camera movement
- Audio: soft home ambient (faint birds, gentle music suggestion)
- Camera: slow parallax drift

Email tone: Warm, family-oriented, comfort and reliability focused.

---

### TECH & ELECTRONICS / DRINKS & BEVERAGES / SNACKS & CONFECTIONERY / OTHER

TECH: CLEAN MINIMAL or geometric minimal. Dark backgrounds acceptable for premium tech.
DRINKS: Same as COFFEE & TEA rules.
SNACKS: Same as FOOD & BEVERAGE rules.
OTHER: Default to Auto style selection.

---

## HOW TO APPLY INDUSTRY RULES

When brandIndustry is provided:
1. Note the industry category
2. Apply that industry's atmospheric elements, surface, and prop rules
3. These OVERRIDE the generic defaults in the IMAGE PROMPT FORMULA section
4. The creative style (luxury, explosion, etc.) still applies — industry rules ADD SPECIFICITY to the style

Example:
Industry = Coffee & Tea + Style = Product In Action = Dark background UNLESS product is a bright colorful drink (see background color rule) + coffee bean elements + liquid splash + steam + oak wood or slate surface.

Example:
Industry = Beauty & Skincare + Style = Luxury Editorial = White marble surface + botanical elements + floating particles + brand primary gradient background + slow diffused lighting.

---

## IMAGE PROMPT FORMULA

Every image generation_prompt must follow this exact structure. No exceptions.

[STYLE TAG] — always start with the style name

When style is LIFESTYLE CONTEXT, include: [LIFESTYLE]: Real-world environment. Product in context not floating. Warm natural lighting. Shallow depth of field. Background is a real location, blurred. 1-2 minimal contextual props only.

[PRODUCT DESCRIPTION — 30-50 words]
Describe what you see in the product photo in extreme detail. Include: exact container type (glass, bottle, jar, can, box, pouch, tube), product color, texture, finish, label details if visible, size/proportion in frame, any distinctive visual features. Never say "a product" — always describe the specific item.

[BACKGROUND AND ENVIRONMENT — 20-30 words]
CRITICAL BACKGROUND RULE — read before writing any background description:

Step 1: Determine product brightness.
Look at the attached product image.
Is the product BRIGHT/VIBRANT/COLORFUL (orange, pink, red, yellow, bright green, bright blue, multicolor)?
Or is the product DARK/NEUTRAL/MUTED (dark brown, black, dark navy, charcoal, dark amber)?

Step 2: Choose background based on product brightness AND brand colors:

IF product is BRIGHT/VIBRANT:
Use a DEEP RICH version of the brand's primary color as background — NOT black, NOT near-black.
Examples:
- Green brand + bright drink: deep forest green (#004d2e or similar deep version of primaryColor)
- Blue brand + bright product: deep navy version of primaryColor
- Orange brand + bright product: deep burnt amber version of primaryColor
The background must be CLEARLY COLORED — a rich deep shade, not dark gray or black.
The bright product will POP against the deep colored background.

IF product is DARK/NEUTRAL/MUTED:
Near-black or very dark background is appropriate and dramatic.
Use: 'Near-black gradient, subtle radial lighter at center, deep vignette edges'

Step 3: Apply to chosen style:
LUXURY EDITORIAL:
'Smooth rich gradient from deep [primaryColor-dark-shade] at edges to slightly lighter [primaryColor-mid] at center, geometric light from top-left'

ELEMENT EXPLOSION:
'Deep rich [primaryColor-dark-shade] radial gradient — clearly colored NOT black, slightly lighter at center where product sits, fine bokeh light dots scattered throughout'

PRODUCT IN ACTION:
'Deep rich [primaryColor-dark-shade] background — must be clearly a COLOR not near-black unless product itself is dark, subtle radial gradient lighter at center, dramatic vignette at edges'

LIFESTYLE CONTEXT:
'Real-world environment visible but blurred — café table, bathroom shelf, kitchen counter, coffee table, or similar in-scene location. Natural or soft artificial room lighting. Warm, inviting. Shallow depth of field, product sharp, background pleasingly blurred. No studio backdrop.'

CLEAN MINIMAL:
'Pure white or single-tone background. Option A: Pure white studio, seamless white-to-very-light-gray gradient, soft product shadow below. Option B: Brand primary at 10-15% light tint. Option C: Gradient from brand primary light tint to white. No atmospheric elements.'
(Clean Minimal ignores product brightness — always light/white or light brand tint)

[LIGHTING — 20-25 words]
CRITICAL: Use the LIGHTING MODE determined from brand tone (see LIGHTING MODE rules). Do not default to dramatic studio lighting. Match the lighting to the brand's emotional register.

DRAMATIC_STUDIO: 'Strong key light from above-right at 45 degrees, bold rim light on product edges creating separation from background, deep intentional shadows on far side, high contrast commercial product photography'

SOFT_NATURAL: 'Soft diffused light from large left window, warm color temperature, gentle shadows with feathered edges, product glows rather than gleams, feels like a real beautiful moment'

LUXURY_DIFFUSED: 'Perfectly controlled overhead studio diffusion, no harsh shadows anywhere, gentle specular highlights on product edges only, product appears to float in silent controlled light'

CLINICAL_FLAT: 'High-key even lighting from all sides, zero harsh shadows, product fully and flatly illuminated, pure information delivery, no atmosphere'

WARM_GOLDEN: 'Warm amber 45-degree light from left, golden highlights, deep warm intentional shadows, inviting and rich, like late afternoon sunlight through a window'

[ATMOSPHERIC ELEMENTS — 15-20 words]
Only for EXPLOSION and IN ACTION styles. Match to product type: Beverage/coffee: milk or liquid splash, steam, ingredient elements orbiting. Skincare/beauty: serum droplets, botanical elements floating. Supplements: capsules, powder dust, geometric light. Energy drink: citrus/fruit slices, liquid splash. Food: key ingredients scattered. For LIFESTYLE CONTEXT: 1-2 minimal contextual props only (notebook, towel, gym bag, etc.), no explosive elements. For LUXURY and CLEAN MINIMAL: Skip this section.

[COMPOSITION — 15-20 words]
LUXURY: products in triangular cluster, slight depth of field, reflective surface below. EXPLOSION: product perfectly centered, elements in circular orbit freeze-frame. IN ACTION: product dominant at 40% frame height, elements asymmetric orbit. LIFESTYLE CONTEXT: product in situ in real environment, shallow depth of field, 1-2 contextual props, natural framing. CLEAN MINIMAL: product centered with generous breathing room, slight forward tilt, product is the only subject.

[QUALITY DESCRIPTOR — always include]
"Ultra high resolution commercial product photography. Professional retouching. No people. Product focused."

---

## VIDEO PROMPT FORMULA

Video prompts must be dynamic based on brand tone and campaign goal.

VIDEO-LIGHTING ALIGNMENT RULE:
Video pace must be consistent with the lighting mode selected for the images. A brand using SOFT_NATURAL lighting should never have DYNAMIC_ENERGETIC video pace — it creates a jarring inconsistency between the static and video creatives.

Alignment guide:
DRAMATIC_STUDIO lighting → DYNAMIC_ENERGETIC or SMOOTH_CONFIDENT pace
SOFT_NATURAL lighting → SMOOTH_CONFIDENT pace only. Never DYNAMIC_ENERGETIC.
LUXURY_DIFFUSED lighting → SLOW_CINEMATIC pace only. Never DYNAMIC_ENERGETIC.
CLINICAL_FLAT lighting → SMOOTH_CONFIDENT or SLOW_CINEMATIC pace. Never DYNAMIC_ENERGETIC.
WARM_GOLDEN lighting → SMOOTH_CONFIDENT pace. Slightly warmer and more inviting than standard smooth — camera moves feel like an embrace not a presentation.

If campaign goal is FLASH_SALE: Upgrade pace by one level only: SLOW_CINEMATIC → SMOOTH_CONFIDENT, SMOOTH_CONFIDENT → DYNAMIC_ENERGETIC (except LUXURY_DIFFUSED — never goes above SMOOTH_CONFIDENT regardless of goal).

The above overrides the standard brand tone pace selection when a lighting mode has been determined.

PACE SELECTION — choose based on brand tone (and lighting mode alignment above):
FAST/ENERGETIC (energetic, bold, athletic, youthful, dynamic, powerful brands): Camera: "Quick dramatic push-in with slight overshoot, energetic motion". Motion: Faster atmospheric elements.
SMOOTH/CINEMATIC (premium, luxury, elegant, sophisticated, warm brands): Camera: "Slow elegant orbital, smooth parallax drift, gentle push-in". Motion: Slow-rising steam, gentle particle drift.
CLEAN/MINIMAL (minimal, clinical, functional, simple): Camera: "Static or very subtle push-in, near zero camera movement". Motion: Minimal — soft light sweep only.
URGENT/SALE (when campaign goal is flash_sale): Camera: "Confident push-in, purposeful". Motion: Slightly more dynamic than default.

VIDEO PROMPT STRUCTURE:
Line 1 (Product + scene, 25-35 words): Describe product from reference image in detail. Include environment from campaign image.
Line 2 (Camera, 12-15 words): One camera movement from pace selection.
Line 3 (Motion element, 10-15 words): One atmospheric motion matching product type.
Line 4 (Lighting, 8-12 words): Match lighting from reference image.
Line 5 (Quality, always): "Cinematic commercial quality. Ultra sharp focus on product throughout."

HARD RULES for video prompts: Never mention people, hands, faces, brand names, text, logos, overlays. Under 400 characters total. No hashtags, parentheses, or asterisks.

---

## VIDEO PROMPT RULES FROM RESEARCH

- 100-130 words is the optimal length for Veo 3.1. Under 80 = too generic. Over 150 = model gets confused.
- Write camera movement as a STANDALONE SENTENCE. Do not embed it in description.
- Front-load the subject — what you mention first gets the most visual weight.
- Always specify audio — Veo 3.1 generates native audio and needs direction.
- Always reserve negative space for text by specifying it in the composition.
- One primary motion element only — multiple competing motions = chaotic result.
- Label legibility: specify "45-degree lighting for label legibility" when the product has important label text.
- The 8 seconds breaks into: 0-2s hook (establish product), 2-6s middle (camera movement + motion), 6-8s hold (product fully revealed). Write prompts with this arc in mind.

---

## HEADLINE RULES (ON-IMAGE TEXT)

overlay_headline: Maximum 6 words. Evoke emotion OR create urgency. Match brand tone. No generic "Shop now" — that's for CTA. Examples by goal: new_launch: "Meet your new [benefit]." flash_sale: "[Discount] ends tonight." seasonal: "Made for [season]." brand_awareness: "This changes everything."
overlay_cta: Maximum 3 words. Action verb. Premium: "Discover yours" Energetic: "Get it now" Warm: "Order yours" Minimal: "Shop"
overlay_subtext: Maximum 10 words. Supporting detail — NOT a repeat of headline. Benefit, ingredient claim, or social proof.

---

## EMAIL SUBJECT LINE FORMULA

Based on campaign goal:
new_launch: "[Product name] is finally here" OR "Introducing [benefit]"
flash_sale: "[Discount] — [time limit]" OR "Last chance: [benefit]"
seasonal: "[Season] [product category] you'll actually use"
brand_awareness: "Why [target audience] [love/switched to/can't stop] [brand name]"

Preview text must ADD information, never repeat the subject line. Always under 90 characters.
`;

const CONTENT_SYSTEM = BASE_SYSTEM + `\n\nYour outputs are fed directly into:
- Email HTML rendering (html_template is used as-is)
- Direct display to users (for social copy)`;

/* ─── User prompt builder ────────────────────────────────────────────────────── */

export interface CampaignParams {
  brandName: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  brandTone: string;
  brandWebsite: string;
  /** Signed or public URL for email header logo img src; omit if none */
  brandLogoUrl?: string;
  productDescription?: string;
  hasProductImage: boolean;
  campaignGoal: string;
  platforms: string[];
  targetAudience?: string;
  brandDescription?: string;
  brandIndustry?: string;
  brandGuidelines?: string;
  additionalContext?: string;
  preferredStyle?: string;
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

function getIndustryBackgroundRule(industry: string): string {
  const i = industry.toLowerCase();

  if (
    i.includes("coffee") ||
    i.includes("tea") ||
    i.includes("beverage") ||
    i.includes("drink") ||
    i.includes("food") ||
    i.includes("snack")
  ) {
    return (
      "IF product is bright/colorful (orange, pink, red, yellow, green drink): " +
      "MUST use deep rich version of brand primary color as background — absolutely " +
      "NO near-black or dark gray. " +
      "IF product is dark (dark coffee, dark beer): dark background acceptable."
    );
  }

  if (
    i.includes("beauty") ||
    i.includes("skincare") ||
    i.includes("candle") ||
    i.includes("fragrance")
  ) {
    return (
      "Use brand primary color as a rich gradient background. White marble " +
      "surface. Never near-black. Always elegant."
    );
  }

  if (
    i.includes("baby") ||
    i.includes("kids") ||
    i.includes("pet") ||
    i.includes("home")
  ) {
    return (
      "Warm and light backgrounds only. " +
      "Never dark or dramatic. Soft warm tones."
    );
  }

  if (i.includes("jewelry") || i.includes("fashion") || i.includes("apparel")) {
    return (
      "Deep rich brand primary gradient for jewelry. Fashion varies by brand tone."
    );
  }

  if (
    i.includes("sports") ||
    i.includes("fitness") ||
    i.includes("supplement") ||
    i.includes("health")
  ) {
    return (
      "Energetic brands: deep vibrant brand primary. Clinical brands: clean white."
    );
  }

  return (
    "Use brand primary color to inform background — avoid generic " +
    "near-black unless product is dark."
  );
}

function getLightingMode(brandTone: string): string {
  const t = brandTone.toLowerCase();

  if (
    t.includes("bold") ||
    t.includes("energetic") ||
    t.includes("powerful") ||
    t.includes("vibrant") ||
    t.includes("dynamic") ||
    t.includes("intense") ||
    t.includes("athletic")
  ) {
    return "DRAMATIC_STUDIO";
  }

  if (
    t.includes("luxury") ||
    t.includes("premium") ||
    t.includes("elegant") ||
    t.includes("sophisticated") ||
    t.includes("refined") ||
    t.includes("exclusive") ||
    t.includes("elevated")
  ) {
    return "LUXURY_DIFFUSED";
  }

  if (
    t.includes("clean") ||
    t.includes("minimal") ||
    t.includes("clinical") ||
    t.includes("pure") ||
    t.includes("functional") ||
    t.includes("simple")
  ) {
    return "CLINICAL_FLAT";
  }

  if (
    t.includes("indulgent") ||
    t.includes("delicious") ||
    t.includes("comfort") ||
    t.includes("craft") ||
    t.includes("rustic") ||
    t.includes("nostalgic")
  ) {
    return "WARM_GOLDEN";
  }

  return "SOFT_NATURAL";
}

function buildBrandContext(params: CampaignParams): string {
  const {
    brandName, primaryColorHex, secondaryColorHex, brandTone,
    brandWebsite, brandLogoUrl, productDescription, hasProductImage, campaignGoal, platforms,
    targetAudience, brandDescription, brandIndustry, brandGuidelines, additionalContext, preferredStyle,
    socialLinks,
  } = params;

  const productLine = hasProductImage
    ? "See attached product image"
    : (productDescription || "No product description provided");

  const imageContextLine = hasProductImage
    ? "A product photo is attached. Use it as the visual reference for all image prompts."
    : "No product photo provided. Generate compelling product scene imagery from scratch based on the brand details and campaign goal above.";

  const stylePreference = preferredStyle && preferredStyle !== "auto"
    ? preferredStyle
    : "Auto — choose the best style for this product";

  return `BRAND DETAILS:
- Brand name: ${brandName}
- Brand description: ${brandDescription ?? "Not provided"}
- Industry: ${brandIndustry ?? "Not specified"}
- Target audience: ${targetAudience ?? "Not specified"}
- Brand tone: ${brandTone}
- Primary color: ${primaryColorHex}
- Secondary color: ${secondaryColorHex}
- Website: ${brandWebsite}
${brandLogoUrl ? `- BRAND LOGO URL (use in email header): ${brandLogoUrl}` : "- BRAND LOGO URL: none — use brand name text only in email header"}
${brandGuidelines ? `- Additional brand guidelines: ${brandGuidelines}` : ""}
${
  socialLinks && Object.keys(socialLinks).length > 0
    ? `\nBRAND SOCIAL LINKS:\n${Object.entries(socialLinks)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")}`
    : ""
}

CREATIVE STYLE PREFERENCE: ${stylePreference}

CAMPAIGN PARAMETERS:
- Product: ${productLine}
- Campaign goal: ${campaignGoal}
- Additional context: ${additionalContext ?? "None provided"}
- Platforms selected: ${platforms.join(", ")}

${imageContextLine}
${brandIndustry ? `

INDUSTRY BACKGROUND RULE:
Industry: ${brandIndustry}

Based on this industry, the background color treatment must be:
${getIndustryBackgroundRule(brandIndustry)}` : ""}

LIGHTING MODE — determined by brand tone:
Select ONE lighting mode based on brandTone. This mode applies to ALL 6 images and ALL 3 email images. State it once, use it everywhere.

DRAMATIC_STUDIO → select when brandTone contains ANY of: bold, energetic, powerful, vibrant, dynamic, intense, athletic, exciting
Visual: Strong key light from above-right, bold rim lighting separating product from background, deep intentional shadows, high contrast. Professional product studio.

SOFT_NATURAL → select when brandTone contains ANY of: warm, inviting, natural, organic, fresh, friendly, approachable, everyday, real, authentic, cozy, soft
Visual: Diffused light from one side as if from a large window, warm color temperature, gentle shadows with soft edges, feels like a real moment not a studio. Product glows rather than gleams.

LUXURY_DIFFUSED → select when brandTone contains ANY of: luxury, premium, elegant, sophisticated, refined, exclusive, artisan, timeless, elevated, minimal
Visual: Soft overhead diffused studio light, gentle specular highlights only on edges, no harsh shadows anywhere, product appears to float in perfectly controlled light. Silent and confident, not dramatic.

CLINICAL_FLAT → select when brandTone contains ANY of: clean, minimal, pure, simple, functional, clinical, medical, precise, direct, clear
Visual: High-key even lighting from all sides, zero shadows, product fully revealed, no atmosphere — pure information delivery.

WARM_GOLDEN → select when brandTone contains ANY of: indulgent, delicious, comfort, homemade, artisan, craft, rustic, seasonal, nostalgic, cozy
Visual: Warm amber-toned lighting from 45-degree left position, golden highlights, deep warm shadows, inviting and appetite-stimulating. Like late afternoon sunlight.

DEFAULT: If none match — use SOFT_NATURAL. It is the most universally flattering lighting for product photography.

Apply the lighting mode to EVERY image generation prompt. The lighting description in each prompt must match the selected mode. Never use dramatic studio lighting for a warm/natural brand. Never use soft natural light for an energetic/bold brand.

LIGHTING MODE: ${getLightingMode(brandTone)}
Apply this lighting mode to ALL 6 images, ALL 3 email images, and use it to determine video pace as per VIDEO-LIGHTING ALIGNMENT RULE.

STYLE LOCK: Determine the creative style once based on brand and product. State it in image_feed_1.style_chosen. Then use IDENTICAL style for all remaining 5 images and all 3 email images. Do not re-evaluate or change style mid-generation.

Use the brand tone to select camera pace for video: energetic/bold/athletic = fast dynamic motion. premium/luxury/elegant = slow cinematic. minimal/clean/simple = near-static subtle motion. If a specific style is requested, use ONLY that style for all feed and story images. If Auto, choose the best style and use it consistently across all image outputs.`;
}

function buildImagePromptsUserPrompt(params: CampaignParams): string {
  const { primaryColorHex, secondaryColorHex } = params;
  const ctx = buildBrandContext(params);

  return `Create image and video prompts for a marketing campaign with these parameters:

${ctx}

CRITICAL VARIATION RULE — READ BEFORE GENERATING ANY IMAGE PROMPTS:
You are generating 6 images of the same product (3 feed images (4:5 vertical), 3 story images (9:16)). They MUST look like 6 different photographs taken by a professional photographer in the same studio session.
Same: creative style, color palette, lighting philosophy, atmospheric elements.
Different: camera position, framing, composition, depth of field, crop.
The shot type tag ([HERO FRONT], [45 DEGREE], [MACRO DETAIL], [HERO VERTICAL], [LOW HEROIC], [FLAT LAY VERTICAL]) is a hard assignment — not a suggestion. Execute each shot type exactly as described.
Lock the creative style chosen in image_feed_1 and use it identically for all 6 images.
Do not re-evaluate style for story images.

Return ONLY this exact JSON structure with all fields completed — no empty strings, no placeholders:

{
  "image_feed_1": {
    "style_chosen": "Which ad style you chose (e.g. Luxury Editorial, Element Explosion, Product In Action, Lifestyle Context, Clean Minimal).",
    "generation_prompt": "[HERO FRONT SHOT] Write this prompt following this exact shot type: Camera: Straight-on, eye level, centered. Full product visible with 20-30% breathing room on all sides. Product occupies 50-60% of frame width. Depth of field: Deep focus, entire product sharp, background soft bokeh. Lighting: Front-facing diffused, product fully lit, minimal shadows. Format: 4:5 vertical — taller than wide. Product centered with more vertical space above and below than a square crop. Text overlay sits in top 20% or bottom 20% of the taller frame. This is the highest-performing Meta feed format. Start your prompt with [HERO FRONT] then describe: exact product appearance → background matching chosen creative style → lighting → atmospheric elements if style requires → text placement note → quality. Length: 120-180 words. Now write the actual Nano Banana generation prompt following all rules above. Begin directly with [HERO FRONT] — do not repeat these instructions.",
    "overlay_headline": "Maximum 6 words. Bold headline. Match brand tone and campaign goal.",
    "overlay_cta": "Maximum 3 words. CTA button text.",
    "overlay_subtext": "Maximum 10 words. Supporting line below headline."
  },
  "image_feed_2": {
    "style_chosen": "Same style as image_feed_1.",
    "generation_prompt": "[45-DEGREE DYNAMIC ANGLE] Write this prompt following this exact shot type: Camera: 45 degrees to the left side of product, elevated 20-25 degrees above eye level. This shows BOTH the front face AND left side of the product simultaneously, creating depth a front shot cannot. Product positioned on RIGHT third of frame NOT centered — leaves clear space on left for text overlay. Depth of field: SHALLOW — front face of product sharp, back of product softly out of focus, background pleasingly blurred. Lighting: Side-key light matching the angle — strong highlight on near face, natural shadow falling on far side. Format: 4:5 vertical — taller than wide. Product centered with more vertical space above and below than a square crop. Text overlay sits in top 20% or bottom 20% of the taller frame. This is the highest-performing Meta feed format. Start your prompt with [45 DEGREE] then describe: exact product from this angle → what the side view reveals about this specific product → background → lighting with directional shadow → atmospheric elements → quality. Length: 120-180 words. Now write the actual Nano Banana generation prompt. Begin directly with [45 DEGREE] — do not repeat these instructions.",
    "overlay_headline": "Maximum 6 words. Different headline approach from feed_1.",
    "overlay_cta": "Maximum 3 words. CTA (can match or vary).",
    "overlay_subtext": "Maximum 10 words."
  },
  "image_feed_3": {
    "style_chosen": "Same style as image_feed_1.",
    "generation_prompt": "[MACRO DETAIL CLOSE-UP] Write this prompt following this exact shot type: Camera: Extreme close-up on the MOST visually compelling detail of this specific product. Do NOT show the full product. Choose the detail based on product type: Beverage: label and bottle neck detail, or liquid texture, or cap close-up; Skincare: pump or lid mechanism, or label typography, or texture detail; Food: texture surface, or label close-up, or ingredient detail; Supplement: cap and seal, or capsule texture. Product is cropped tightly — only 35-50% of product visible, intentionally cropped out of frame on at least one edge. This creates an editorial magazine feel. Depth of field: VERY shallow — only the specific detail in razor-sharp focus, rapid focus falloff. Lighting: Raking side light to reveal surface texture, material finish, craftsmanship details. Background: Very soft color wash (highly blurred due to shallow depth) using style color palette. Text placement: Large soft background area is perfect for readable text overlay. Format: 4:5 vertical — taller than wide. Product centered with more vertical space above and below than a square crop. Text overlay sits in top 20% or bottom 20% of the taller frame. This is the highest-performing Meta feed format. Start your prompt with [MACRO DETAIL] then describe: exact detail being featured → what makes this detail visually compelling for THIS specific product → raking light → soft background → quality. Length: 120-180 words. Now write the actual Nano Banana generation prompt. Begin directly with [MACRO DETAIL] — do not repeat these instructions.",
    "overlay_headline": "Maximum 6 words. Different from feed_1 and feed_2.",
    "overlay_cta": "Maximum 3 words. CTA.",
    "overlay_subtext": "Maximum 10 words."
  },

  "image_story_1": {
    "style_chosen": "Same style as feed images.",
    "generation_prompt": "[HERO VERTICAL] Write this prompt for 9:16 vertical mobile format following this exact shot type: Camera: Straight-on, eye level. Product positioned in the CENTER VERTICAL THIRD of the frame — this is critical. Top 25% of frame: breathing room or atmospheric elements floating above product. Bottom 25% of frame: surface/ground plane. Product centered horizontally. This leaves natural space for headline text in upper area and CTA in lower area. Depth of field: Deep focus on product, soft background. Format: 9:16 vertical — tall composition. Start your prompt with [HERO VERTICAL] then describe: product in center vertical third → what occupies top quarter (atmospheric elements, background) → what occupies bottom quarter (surface, reflection) → lighting → quality. Length: 120-180 words. Now write the actual Nano Banana generation prompt. Begin directly with [HERO VERTICAL] — do not repeat these instructions.",
    "overlay_headline": "Maximum 5 words. Stories are fast.",
    "overlay_cta": "Maximum 3 words.",
    "overlay_subtext": "Maximum 8 words."
  },
  "image_story_2": {
    "style_chosen": "Same style.",
    "generation_prompt": "[LOW ANGLE HEROIC] Write this prompt for 9:16 vertical mobile format following this exact shot type: Camera: Positioned BELOW the product base, looking UPWARD at approximately 25-30 degree upward angle. Effect: Product appears to TOWER upward filling the upper portion of the tall 9:16 frame. Psychologically communicates power, premium quality, confidence. Product base sits near frame center-to-lower. Product stretches dramatically upward toward top of frame. Sky/background/atmosphere visible above and behind product. Lighting: Appears to come from above — strong light descending from top, slight underexposure at product base, dramatic rim lighting on product edges. This angle is exceptionally powerful for beverages, supplements, and anything in a bottle or tall container. Format: 9:16 vertical. Start your prompt with [LOW HEROIC] then describe: product towering upward from low camera position → dramatic lighting descending from above → atmospheric background above product → base shadow → powerful heroic feeling → quality. Length: 120-180 words. Now write the actual Nano Banana generation prompt. Begin directly with [LOW HEROIC] — do not repeat these instructions.",
    "overlay_headline": "Maximum 5 words.",
    "overlay_cta": "Maximum 3 words.",
    "overlay_subtext": "Maximum 8 words."
  },
  "image_story_3": {
    "style_chosen": "Same style.",
    "generation_prompt": "[OVERHEAD FLAT LAY VERTICAL] Write this prompt for 9:16 vertical mobile format following this exact shot type: Camera: Directly overhead, 90 degrees straight down, bird's eye view. The tall 9:16 format creates a rich vertical flat lay composition. Surface: Choose based on product/industry: Luxury/skincare: white marble or light stone surface; Beverage/coffee: dark slate, dark wood, or black marble; Food: natural wood, linen, light concrete; Supplements/wellness: white or soft pastel surface. Product centered or on rule-of-thirds. PROPS — choose 5-7 specific items relevant to THIS product: Coffee/cold brew: whole coffee beans, cinnamon sticks, brown sugar, small espresso cup, coffee leaf; Skincare: rose petals, jade roller, small botanicals, dropper bottle, cotton rounds; Energy drink: citrus slices, ice cubes, mint leaves, ingredient fruits; Supplement: capsules arranged nearby, fresh fruit, measuring spoon, ingredient leaf; General beverage: complementary ingredients, glass nearby, ice. Props arranged in vertical composition — elements above AND below product filling the tall frame. Natural asymmetric arrangement, not perfectly symmetrical. Lighting: Overhead studio diffused, even illumination across flat lay, soft directional shadows from one side. This shot type tells a STORY — it shows the product in its world. Most lifestyle and context-rich variation. Format: 9:16 vertical. Start your prompt with [FLAT LAY VERTICAL] then describe: specific surface → product position → list all 5-7 specific props and their arrangement → lighting → lifestyle storytelling quality. Length: 140-200 words — this prompt needs more detail due to prop complexity. Now write the actual Nano Banana generation prompt. Begin directly with [FLAT LAY VERTICAL] — do not repeat these instructions.",
    "overlay_headline": "Maximum 5 words.",
    "overlay_cta": "Maximum 3 words.",
    "overlay_subtext": "Maximum 8 words."
  },

  "video_veo": {
    "product_visual": "Describe the product from the uploaded image in extreme detail. Include ALL of the following: Container type (glass bottle, aluminum can, dropper bottle, cardboard box, plastic tube, ceramic jar, etc.). Exact colors of container AND label. Label description (what is printed, color scheme, any visible text style). Surface texture (matte, glossy, frosted, metallic, transparent). Size/proportion (tall and narrow, short and wide, etc.). Any distinctive features (pump, dropper, embossing, unique cap, etc.). Contents if visible (liquid color, carbonation, layers, cream texture). Be cinematically specific. e.g. not a bottle but a tall frosted glass bottle with a matte black aluminum cap, dark amber liquid visible through the transparent lower half, white minimal label with gold serif typography, moisture condensation on the glass exterior.",
    "video_pace": "Based on brandTone, select ONE pace category: SLOW_CINEMATIC — select when brandTone contains any of: luxury, premium, elegant, sophisticated, refined, artisan, heritage, timeless. Camera style: slow deliberate movements, long holds, minimal motion. SMOOTH_CONFIDENT — select when brandTone contains any of: warm, inviting, friendly, quality, professional, trusted, approachable, natural, organic. Camera style: smooth moderate movements, controlled reveals, steady. DYNAMIC_ENERGETIC — select when brandTone contains any of: bold, energetic, powerful, exciting, youthful, athletic, vibrant, intense, innovative, disruptive. Camera style: purposeful motion with energy, confident movement, some dynamism. Write ONLY the category name here, e.g. SLOW_CINEMATIC.",
    "prompt_16x9": "Write a Veo 3.1 image-to-video prompt for a HORIZONTAL 16:9 product commercial. TARGET LENGTH: 100-130 words exactly. Do not go under 80 or over 150 words. STRUCTURE — write as flowing cinematic paragraph, NOT numbered lines: SENTENCE 1 — SUBJECT AND SCENE (25-35 words): Describe the product_visual sitting in its environment. Be specific about the surface it rests on (Luxury/skincare: white marble, polished obsidian; Beverage/coffee: dark slate, worn oak wood; Food: natural linen, light wood; Supplements: clean white surface). Include negative space on the right third of frame for text overlays. SENTENCE 2 — CAMERA MOVEMENT (standalone sentence, 12-18 words): Choose based on video_pace. SLOW_CINEMATIC: slow dolly forward, whisper-slow orbital 45-degree arc, or glacial pull-back from macro. SMOOTH_CONFIDENT: smooth push-in, controlled 90-degree orbit, or steady with subtle parallax drift. DYNAMIC_ENERGETIC: decisive push-in, rapid reveal from label close-up to full product, or driving forward with intent. SENTENCE 3 — MOTION ELEMENT (12-16 words): One atmospheric motion — Coffee: steam curling upward; Cold beverage: condensation droplets tracing surface; Skincare: light particles drifting; Supplement: fine particles in suspension; Liquid: surface ripples; Default: soft light sweep. SENTENCE 4 — LIGHTING (10-14 words): Match campaign style — dark dramatic: three-point rim light; luxury: soft diffused overhead; warm lifestyle: warm practical from left; clean minimal: high-key even. SENTENCE 5 — AUDIO (10-14 words): Veo 3.1 generates native audio. Premium: subtle ambient room tone, no music. Beverage/food: faint cafe atmosphere. Energetic: low subtle pulse. Clean: complete silence. Default: soft ambient room tone. SENTENCE 6 — QUALITY LOCK: Cinematic commercial quality, professional product advertisement, ultra sharp focus on product throughout, no text, no people, no hands, no logos. No subtitles.",
    "prompt_9x16": "Write a Veo 3.1 image-to-video prompt for a VERTICAL 9:16 product video for TikTok, Instagram Reels, and Stories. TARGET LENGTH: 100-130 words. CRITICAL DIFFERENCES from 16x9: 1) COMPOSITION: Start with Vertical 9:16 mobile composition. Product in CENTER VERTICAL THIRD. Specify negative space in upper third for text overlay. 2) CAMERA: Do NOT use orbital in 9:16. Use ONLY: slow push-in, subtle parallax, slow pull-back reveal, or static with motion. For DYNAMIC_ENERGETIC use confident push-in. 3) MOTION: Slightly more present than 16:9 — mobile-first, captivating in first 1-2 seconds. 4) HOOK: First 1-2 seconds visually arresting — macro reveal (start tight, pull back), or atmospheric (motion already active), or hero (product already lit and positioned). 5) AUDIO: Same as 16:9 but slightly more present for mobile. Lighting, quality lock, audio identical to 16:9. Use same video_pace as 16:9.",
    "negative_prompt": "people, faces, hands, fingers, arms, body parts, text overlays, written words, typography, logos, watermarks, brand marks, blurry product, overexposed highlights, blown whites, pixelation, compression artifacts, shaky unstable camera, jump cuts, hard transitions, multiple products, duplicate objects, reflections showing camera or crew, artificial lens flares, floating objects without physical basis, distorted product label, color banding, strobing effects. No subtitles."
  },

  "email_image_prompts": {
    "image_1_prompt": "Use the same LIGHTING MODE determined for this campaign's feed and story images. Email images must feel visually consistent with the ad creatives — same lighting philosophy, same color temperature, same shadow style. Write a Nano Banana image generation prompt for the HERO EMAIL IMAGE. Format: 16:9 landscape — this is the full-width email header image. Use the same creative style chosen for the feed images above. Shot type: HERO FRONT — full product visible, eye level, centered, generous breathing room. Mood: warm and inviting — email context is more personal than social ads, reduce drama, increase warmth. Surface: style-appropriate but clean (marble, wood, slate). No text overlay areas needed — this image will have HTML text overlaid separately. 100-140 words.",
    "image_2_prompt": "Use the same LIGHTING MODE determined for this campaign's feed and story images. Email images must feel visually consistent with the ad creatives — same lighting philosophy, same color temperature, same shadow style. Write a Nano Banana image generation prompt for the MID-EMAIL LIFESTYLE IMAGE. Format: 1:1 square. Different from image_1 — use the 45-DEGREE shot type (camera at 45 degrees showing front and side of product). Same creative style and color palette. More lifestyle context than image_1 — product in use context or surrounded by complementary elements from the brand world. Slightly shallower depth of field than image_1 for visual variety. 100-140 words.",
    "image_3_prompt": "Use the same LIGHTING MODE determined for this campaign's feed and story images. Email images must feel visually consistent with the ad creatives — same lighting philosophy, same color temperature, same shadow style. Write a Nano Banana image generation prompt for the PRE-CTA ATMOSPHERE IMAGE. Format: 1:1 square. Use the FLAT LAY / OVERHEAD approach — camera from above looking down at product surrounded by 3-5 relevant props appropriate to this specific product. This image appears just before the CTA button so it should build desire — show the product in its ideal context. Same creative style color palette but warmer and more lifestyle than images 1-2. 100-140 words."
  }
}`;
}

function buildContentUserPrompt(params: CampaignParams): string {
  const { primaryColorHex, secondaryColorHex } = params;
  const ctx = buildBrandContext(params);
  const htmlSpec = buildEmailHtmlTemplateSpec(primaryColorHex, secondaryColorHex);

  return `Create email marketing content for a campaign with these parameters:

${ctx}

=== HTML EMAIL SPECIFICATION (both variants MUST produce full html_template documents obeying ALL of this) ===
${htmlSpec}
=== END SPEC ===

SOCIAL LINKS: The user configures social media (Instagram, TikTok, Facebook, X, LinkedIn, Pinterest, YouTube) and contact (email, address) on the brand page. BRAND SOCIAL LINKS above lists only what they entered. You MUST add a Follow Us / Stay Connected row with icon links for every platform that has a URL in that list; omit that row only when no social URLs are provided. This ensures the email footer reflects the brand page.

You must output TWO DISTINCT marketing email variants (email_1, email_2). Each must have a DIFFERENT subject line, headline, subheadline, body copy, and CTA angle. email_1 html_template must embed email_1 copy; email_2 html_template must embed email_2 copy. Same structure, placeholders, and social/footer rules for both.

CRITICAL — Valid JSON only: Escape double-quotes inside strings as \\". Use \\n for newlines inside JSON strings. html_template must be complete <!DOCTYPE html>…</html>, inline CSS only, include placeholders {{EMAIL_IMAGE_1}} {{EMAIL_IMAGE_2}} {{EMAIL_IMAGE_3}} {{CTA_URL}} {{UNSUBSCRIBE_URL}} where specified.

Return ONLY this JSON shape (replace example text with real copy; html_template = actual HTML strings):

{
  "email_1": {
    "subject_line": "…",
    "preview_text": "…",
    "headline": "…",
    "subheadline": "…",
    "body_paragraph_1": "…",
    "body_paragraph_2": "…",
    "cta_primary": "…",
    "cta_url_note": "USE_BRAND_URL",
    "footer_tagline": "…",
    "html_template": "…"
  },
  "email_2": {
    "subject_line": "…",
    "preview_text": "…",
    "headline": "…",
    "subheadline": "…",
    "body_paragraph_1": "…",
    "body_paragraph_2": "…",
    "cta_primary": "…",
    "cta_url_note": "USE_BRAND_URL",
    "footer_tagline": "…",
    "html_template": "…"
  }
}`;
}

/** If JSON is truncated (unclosed string), try appending closing quote and braces until parse succeeds. */
function tryRepairTruncatedJson(cleaned: string): string | null {
  const trimmed = cleaned.trimEnd();
  if (!trimmed.length) return null;
  const last = trimmed.slice(-1);
  if (last === "}" || last === "]") return null;
  const closeString = last === '"' || last === "\\" ? "" : '"';
  for (let n = 2; n <= 8; n++) {
    const suffix = closeString + "}".repeat(n);
    try {
      JSON.parse(trimmed + suffix);
      return trimmed + suffix;
    } catch {
      continue;
    }
  }
  return null;
}

/* ─── Generic Claude request ─────────────────────────────────────────────────── */

type ContentBlock =
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "text"; text: string };

function isRetryableClaudeError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Claude API error (529|503|429)\b/.test(msg) || /overloaded|rate limit/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GenerationUnavailableError {
  code: "GENERATION_UNAVAILABLE";
  message: string;
  retryable: true;
}

async function makeClaudeRequest<T>(
  systemPrompt: string,
  content: ContentBlock[] | string,
  maxTokens: number,
  requiredKeys: string[],
  model: string,
  extraInstruction?: string
): Promise<T> {
  const system = extraInstruction
    ? systemPrompt + "\n\n" + extraInstruction
    : systemPrompt;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey!,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error ${response.status}: ${body.slice(0, 500)}`);
  }

  const result = await response.json() as {
    content: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  };

  const textBlock = result.content?.find((b) => b.type === "text");
  const rawText = textBlock?.text?.trim();
  if (!rawText) throw new Error("Claude returned empty response");

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: T;
  try {
    parsed = JSON.parse(cleaned) as T;
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    if (msg.includes("Unterminated string") || msg.includes("Unexpected end of JSON")) {
      const repaired = tryRepairTruncatedJson(cleaned);
      if (repaired !== null) parsed = JSON.parse(repaired) as T;
      else throw parseErr;
    } else {
      throw parseErr;
    }
  }

  for (const key of requiredKeys) {
    if (!(key in (parsed as Record<string, unknown>))) {
      throw new Error(`Claude response missing required field: ${key}`);
    }
  }

  return parsed;
}

async function callClaudeWithRetry<T>(
  systemPrompt: string,
  content: ContentBlock[] | string,
  maxTokens: number,
  requiredKeys: string[],
  extraInstruction?: string
): Promise<T> {
  for (let i = 0; i < MAX_PRIMARY_ATTEMPTS; i++) {
    try {
      return await makeClaudeRequest<T>(systemPrompt, content, maxTokens, requiredKeys, MODEL_PRIMARY, extraInstruction);
    } catch (err) {
      if (!isRetryableClaudeError(err)) throw err;
      const delay = 1000 * Math.pow(2, i);
      console.warn(
        `[Campaign] Sonnet overloaded, attempt ${i + 1}/${MAX_PRIMARY_ATTEMPTS}. Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  console.warn("[Campaign] Falling back to Haiku due to sustained Sonnet overload");

  for (let i = 0; i < MAX_FALLBACK_ATTEMPTS; i++) {
    try {
      return await makeClaudeRequest<T>(systemPrompt, content, maxTokens, requiredKeys, MODEL_FALLBACK, extraInstruction);
    } catch (err) {
      if (!isRetryableClaudeError(err)) throw err;
      const delay = 2000 * Math.pow(2, i);
      console.warn(
        `[Campaign] Haiku overloaded, attempt ${i + 1}/${MAX_FALLBACK_ATTEMPTS}. Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  const err: GenerationUnavailableError = {
    code: "GENERATION_UNAVAILABLE",
    message: "AI generation is experiencing high demand. Please try again in 1-2 minutes.",
    retryable: true,
  };
  throw err;
}

/* ─── Call 1: Image prompts (fast) ───────────────────────────────────────────── */

export async function generateCampaignImagePrompts(
  params: CampaignParams,
  productImageBase64?: string,
  productImageMimeType?: string
): Promise<CampaignClaudeImageOutput> {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const userPrompt = buildImagePromptsUserPrompt(params);
  let content: ContentBlock[] | string;

  if (productImageBase64 && productImageMimeType) {
    content = [
      { type: "image", source: { type: "base64", media_type: productImageMimeType, data: productImageBase64 } },
      { type: "text", text: userPrompt },
    ];
  } else {
    content = userPrompt;
  }

  const requiredKeys = ["image_feed_1", "image_feed_2", "image_feed_3", "image_story_1", "image_story_2", "image_story_3", "video_veo", "email_image_prompts"];

  const systemWithStyles = IMAGE_SYSTEM + AD_STYLES_SYSTEM;
  return callClaudeWithRetry<CampaignClaudeImageOutput>(systemWithStyles, content, 4000, requiredKeys);
}

/* ─── Call 2: Email + social copy ────────────────────────────────────────────── */

export async function generateCampaignContent(
  params: CampaignParams,
  productImageBase64?: string,
  productImageMimeType?: string
): Promise<CampaignClaudeContentOutput> {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const userPrompt = buildContentUserPrompt(params);
  let content: ContentBlock[] | string;

  if (productImageBase64 && productImageMimeType) {
    content = [
      { type: "image", source: { type: "base64", media_type: productImageMimeType, data: productImageBase64 } },
      { type: "text", text: userPrompt },
    ];
  } else {
    content = userPrompt;
  }

  const requiredKeys = ["email_1", "email_2"];

  return callClaudeWithRetry<CampaignClaudeContentOutput>(CONTENT_SYSTEM, content, 12000, requiredKeys, "Return ONLY raw JSON. Escape all quotes in strings as \\\" and use \\n for newlines. Do not truncate.");
}

/* ─── Apply Brand: website analysis ───────────────────────────────────────────── */

export interface BrandAnalysisResult {
  brand_name: string;
  brand_description: string;
  brand_guidelines: string;
  brand_tone: string;
  brand_industry: string;
  target_audience: string;
  primary_font?: string;
  suggested_primary_color?: string;
  suggested_secondary_color?: string;
}

const BRAND_ANALYSIS_SYSTEM = `You are an expert brand strategist and creative director. You analyze websites and extract precise, actionable brand intelligence that will be used to generate marketing campaigns and ad creatives.

You respond ONLY with a single valid JSON object. No prose. No markdown. No backticks. Raw JSON starting with { and ending with }.

Your analysis must be SPECIFIC to this brand — never generic. If you write something that could apply to any brand, rewrite it until it is specific to this one.

This may be any type of business — ecommerce store, restaurant, agency, SaaS, gym, law firm, or anything else. Do not assume they sell physical products unless the content clearly shows they do.`;

function buildBrandAnalysisPrompt(extract: WebsiteExtract): string {
  const sections: string[] = [];

  sections.push(
    "## WEBSITE DATA\n" +
      `URL: ${extract.url ?? "unknown"}\n` +
      `Site name: ${extract.siteName ?? extract.title ?? "unknown"}\n` +
      `Meta description: ${extract.description ?? extract.ogDescription ?? "none"}\n` +
      (extract.themeColor ? `Brand color detected from meta: ${extract.themeColor}\n` : "") +
      (extract.ctaColor ? `CTA/button color detected from CSS: ${extract.ctaColor}\n` : "") +
      (extract.primaryFont ? `Font detected: ${extract.primaryFont}\n` : "")
  );

  if (extract.bodySnippet) {
    sections.push("## HOMEPAGE CONTENT\n" + extract.bodySnippet);
  }

  if (extract.aboutSnippet) {
    sections.push(
      "## SECONDARY PAGE CONTENT\n" +
        "(This page often reveals the most authentic brand voice)\n" +
        extract.aboutSnippet
    );
  }

  if (extract.shopifyProducts) {
    sections.push("## PRODUCT CATALOG\n" + extract.shopifyProducts);
  }

  const platformNote = extract.isShopify
    ? "This is an ecommerce store. Industry should reflect their product category. Target audience should be their likely buyers."
    : extract.shopifyProducts
      ? "This brand sells physical products."
      : "This may be a service business, ecommerce store, restaurant, agency, or any other type of business. Analyze what they actually do — do not assume they sell physical products.";

  sections.push("## CONTEXT NOTE\n" + platformNote);

  sections.push(`
## YOUR TASK

Analyze this brand and return ONLY this exact JSON:

{
  "brand_name": "Official brand name, cleaned up from site title or name. Max 50 chars.",

  "brand_description": "2-3 sentence brand description written as if for the brand's own About page. What they do, who they serve, what makes them different. Specific — not generic. Works for any business type. Max 300 chars.",

  "brand_guidelines": "3-5 specific points covering: (1) tone of voice with examples of language they actually use, (2) visual style descriptors, (3) what to avoid visually or in messaging, (4) key messaging angles and value propositions from the site — for service businesses these are outcomes promised to clients, for product brands these are product benefits, for restaurants these are the experience or feeling created, (5) anything distinctive about how they communicate. Write in plain text with \\n between points. Reference actual words or phrases from their site. Max 600 chars.",

  "brand_tone": "2-4 comma-separated adjectives precisely describing this brand voice. Choose from: Premium, Luxury, Elegant, Warm, Inviting, Bold, Energetic, Playful, Minimal, Clean, Clinical, Authentic, Natural, Organic, Professional, Sophisticated, Approachable, Vibrant, Athletic, Youthful, Trustworthy. Match what the site actually feels like.",

  "brand_industry": "Choose the SINGLE most accurate option from this EXACT list — return only the label string exactly as written: Food & Beverage, Coffee & Tea, Beauty & Skincare, Health & Supplements, Fashion & Apparel, Jewelry & Accessories, Home & Lifestyle, Sports & Fitness, Tech & Electronics, Pet Products, Baby & Kids, Candles & Fragrance, Drinks & Beverages, Snacks & Confectionery, Restaurant & Cafe, Agency & Creative Services, Professional Services, Health & Wellness Services, Fitness & Gym, Real Estate, Education & Coaching, SaaS & Software, Retail & Local Business, Other. Examples: coffee shop = Coffee & Tea. Marketing agency = Agency & Creative Services. Gym = Fitness & Gym. Law firm = Professional Services. Shopify supplement brand = Health & Supplements.",

  "target_audience": "1-2 sentences describing exactly who buys from or hires this brand. For product brands: who buys it. For service businesses: who hires them. For SaaS: who subscribes. For restaurants: who dines there. Include age range if inferrable, lifestyle, values, or problem being solved. Be specific — not 'small business owners' but 'independent restaurant owners aged 30-50 who need affordable marketing without hiring an agency'. Max 200 chars.",

  "primary_font": "Font name if identifiable or confidently inferable. Empty string if unknown.",

  "suggested_primary_color": "Strongest brand color evident from theme-color meta tag, CTA/button color, or logo. Return as hex like #004d25. Empty string if unclear.",

  "suggested_secondary_color": "Secondary or complementary brand color if evident. Empty string if unclear."
}

CRITICAL RULES:
- brand_industry MUST be one of the exact label strings listed — no variations, no custom values
- Every field must be specific to THIS brand
- Never write generic descriptions that could apply to any brand
- If information is limited, make the best inference from what is available
- Never return placeholder text`);

  return sections.join("\n\n");
}

export async function analyzeBrandFromWebsite(
  extract: WebsiteExtract,
  logoBase64?: string,
  logoMimeType?: string
): Promise<BrandAnalysisResult> {
  const promptText = buildBrandAnalysisPrompt(extract);

  const userContent: ContentBlock[] = [];

  if (logoBase64 && logoMimeType) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: logoMimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
        data: logoBase64,
      },
    });
    userContent.push({
      type: "text",
      text:
        "The image above is this brand's logo. Use it to inform your analysis of their visual style, color palette, and brand tone.\n\n" +
        promptText,
    });
  } else {
    userContent.push({
      type: "text",
      text: promptText,
    });
  }

  const MAX_ATTEMPTS = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey!,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_PRIMARY,
          max_tokens: 1500,
          system: BRAND_ANALYSIS_SYSTEM,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        const err = new Error(`Claude API error ${response.status}: ${body.slice(0, 500)}`);
        (err as Error & { status?: number }).status = response.status;
        throw err;
      }

      const result = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
      };
      const raw = result.content
        ?.filter((b: { type: string }) => b.type === "text")
        .map((b: { text?: string }) => b.text)
        .join("");

      const cleaned = (raw ?? "")
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned) as BrandAnalysisResult;
      return parsed;
    } catch (error: unknown) {
      lastError = error;
      const status = (error as { status?: number }).status;
      const errType = (error as { error?: { type?: string } }).error?.type;
      const isOverloaded = status === 529 || errType === "overloaded_error";

      if (isOverloaded && attempt < MAX_ATTEMPTS - 1) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(
          `[ApplyBrand] Claude overloaded, attempt ${attempt + 1}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  console.error("[ApplyBrand] Claude analysis failed:", lastError);
  throw new Error("Brand analysis is temporarily unavailable. Please try again in a moment.");
}

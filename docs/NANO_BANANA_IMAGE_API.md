# Blinkify — Nano Banana Image Generation API Reference

**Purpose:** Source of truth for implementing image generation (Phase 3).  
**Last updated:** Feb 11, 2026

---

## 1. Model Overview

**Nano Banana** is Google's name for Gemini's native image generation capabilities. Two models:

| Model | ID | Best for | Resolution | Speed |
|---|---|---|---|---|
| **Nano Banana** | `gemini-2.0-flash-exp-image-generation` | High-volume, low-latency | Up to 1K (1024px) | Fast |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | Pro asset production, complex prompts, text in images | Up to 4K | Slower (uses Thinking) |

**Blinkify will use `gemini-2.0-flash-exp-image-generation`** for standard generations (fast, cheap) and optionally `gemini-3-pro-image-preview` for premium/high-fidelity output.

All generated images include a **SynthID watermark**.

> **Note:** `gemini-2.5-flash-image` and `gemini-3-flash-preview` also appeared in the models list but `gemini-2.0-flash-exp-image-generation` was the one confirmed working for image generation as of Feb 2026. Re-test with newer model IDs as they GA.

---

## 2. SDK & Auth

### SDK

```bash
npm install @google/genai
```

Package: `@google/genai` (Google GenAI SDK for JS/TS, GA since May 2025).  
Import: `import { GoogleGenAI } from "@google/genai";`

### Authentication

Set env var `GEMINI_API_KEY`. The SDK auto-picks it up:

```ts
const ai = new GoogleGenAI({});
// or explicit:
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

**Security:** API key must be server-side only. Never expose in client code.

### Env var for Blinkify API

```env
# apps/api/.env
GEMINI_API_KEY=your-api-key-here
```

---

## 3. Image Generation (text → image)

### Basic Example (Node.js)

```ts
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({});

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash-exp-image-generation",
  contents: "A product photo of white sneakers on a marble surface, studio lighting",
});

for (const part of response.candidates[0].content.parts) {
  if (part.text) {
    console.log(part.text);
  } else if (part.inlineData) {
    const buffer = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync("output.png", buffer);
  }
}
```

### Response Shape

The response uses the standard `generateContent` shape. Image data is returned as **base64-encoded PNG** in `part.inlineData`:

```ts
// part.inlineData.mimeType → "image/png"
// part.inlineData.data     → base64 string
```

A response may contain **both text and image parts** (interleaved).

---

## 4. Image Editing (text + image → image)

Pass an existing image alongside a text prompt:

```ts
const base64Image = fs.readFileSync("input.png").toString("base64");

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash-exp-image-generation",
  contents: [
    { text: "Remove the background and place the product on a gradient blue backdrop" },
    { inlineData: { mimeType: "image/png", data: base64Image } },
  ],
});
```

Supports up to **3 input images** for `gemini-2.0-flash-exp-image-generation`, up to **14** for `gemini-3-pro-image-preview`.

---

## 5. Configuration Options

### Aspect Ratio & Resolution

Set via `generationConfig.imageConfig`:

```ts
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash-exp-image-generation",
  contents: prompt,
  config: {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: {
      aspectRatio: "1:1",    // see table below
      // imageSize: "2K",    // only for gemini-3-pro-image-preview
    },
  },
});
```

#### Supported Aspect Ratios

| Ratio | Use case |
|---|---|
| `1:1` | Instagram feed, default |
| `4:5` | Instagram feed (portrait) |
| `9:16` | Stories, Reels, TikTok, Shorts |
| `16:9` | YouTube thumbnails, landscape ads |
| `3:2` | Landscape photography |
| `2:3` | Portrait photography |
| `3:4` | Portrait |
| `4:3` | Fullscreen |
| `5:4` | Landscape |
| `21:9` | Ultra-wide / banner |

#### Resolution (Nano Banana Pro only)

| Size | Max resolution |
|---|---|
| `1K` | ~1024px (default) |
| `2K` | ~2048px |
| `4K` | ~4096px |

`gemini-2.0-flash-exp-image-generation` outputs 1024px max (no size param needed).

### Response Modalities

To get **image only** (no text):
```ts
config: { responseModalities: ["IMAGE"] }
```

Default is `["TEXT", "IMAGE"]` (both).

---

## 6. Multi-turn / Chat Editing

Use the SDK's chat feature for iterative edits:

```ts
const chat = ai.chats.create({
  model: "gemini-2.0-flash-exp-image-generation",
  config: { responseModalities: ["TEXT", "IMAGE"] },
});

const r1 = await chat.sendMessage({ message: "Create a logo for a sneaker brand called 'Stride'" });
// ... save image from r1 ...

const r2 = await chat.sendMessage({ message: "Make the text larger and change color to gold" });
// ... save updated image from r2 ...
```

---

## 7. Pricing (Paid Tier)

| Model | Input | Output (per image) |
|---|---|---|
| **gemini-2.0-flash-exp-image-generation** | $0.30 / 1M tokens | **$0.039 per image** (1290 tokens @ $30/1M) |
| **gemini-3-pro-image-preview** | $2.00 / 1M tokens | **$0.134 per 1K/2K image**, $0.24 per 4K image |

**Free tier:** Not available for image generation models (paid only).

### Blinkify Credit Mapping

| Blinkify credits | Cost estimate (Flash Image) |
|---|---|
| 1 credit = 1 image | ~$0.039 |
| 30 credits (trial) | ~$1.17 |
| 75 credits (pro) | ~$2.93 |

---

## 8. Rate Limits

Rate limits vary by tier and model. Check current limits at:  
https://aistudio.google.com → API Keys → View rate limits

Key dimensions: **RPM** (requests/min), **TPM** (tokens/min), **RPD** (requests/day).

Tier upgrades: Free → Tier 1 (billing enabled) → Tier 2 ($250+ spend) → Tier 3 ($1000+ spend).

---

## 9. Supported Input Formats

| Format | MIME type |
|---|---|
| PNG | `image/png` |
| JPEG | `image/jpeg` |
| WebP | `image/webp` |
| HEIC | `image/heic` |
| HEIF | `image/heif` |

For files > 20MB total request, use the **Files API** (`ai.files.upload()`).

---

## 10. Error Handling & Safety

- Images may be blocked by safety filters. Check `response.candidates[0].finishReason`.
- `SAFETY` finish reason = content was blocked.
- `RECITATION` = potential copyright concern.
- Always check `response.candidates` exists and has content before accessing parts.

---

## 11. Implementation Plan for Blinkify

### API Route: `POST /workspaces/:workspaceId/projects/:projectId/generate`

**Flow:**
1. Validate user is workspace member
2. Check workspace has credits > 0
3. Create `generations` row (status: `pending`)
4. Call Gemini API (`generateContent`)
5. On success: upload result to Supabase Storage, update generation row (status: `completed`, `result_url`)
6. Deduct 1 credit from workspace, log `credit_transactions`
7. Return generation result to client

**Request body:**
```json
{
  "prompt": "A product photo of...",
  "aspectRatio": "1:1",
  "inputImageUrl": null
}
```

**Optional (later):**
- `model`: choose between flash-image and pro-image
- `imageSize`: "1K" | "2K" | "4K" (pro only)

### Module Structure

```
apps/api/src/
  lib/
    gemini.ts          ← GoogleGenAI client singleton
  routes/
    generations.ts     ← POST generate, GET generations
```

### Key env vars

```env
GEMINI_API_KEY=...
```

---

## 12. Interactions API (Alternative)

The newer **Interactions API** (Beta) can also generate images:

```ts
const interaction = await ai.interactions.create({
  model: "gemini-3-pro-image-preview",
  input: "Generate an image of a futuristic city.",
  response_modalities: ["IMAGE"],
});
```

Supports `image_config` for aspect ratio and resolution. Supports stateful multi-turn via `previous_interaction_id`. Currently Beta — use `generateContent` for production stability.

---

## 13. Key Links

- Image generation docs: https://ai.google.dev/gemini-api/docs/image-generation
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
- Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- SDK (JS): https://github.com/googleapis/js-genai
- API keys: https://ai.google.dev/gemini-api/docs/api-key
- Safety settings: https://ai.google.dev/gemini-api/docs/safety-settings

---

*Update this document as the API or implementation evolves.*

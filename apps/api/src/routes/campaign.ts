/**
 * Full Campaign orchestration endpoint.
 * POST /:workspaceId/projects/:projectId/campaign/generate
 *
 * Pipeline:
 *   Claude Call 1 (image prompts) + Claude Call 2 (email+social) in parallel
 *   → Call 1 done → fire image Tasks A–E + video Task F
 *   → Call 2 done + email images done → assemble email HTML via string replacement
 *   → SSE stream status to frontend
 */

import crypto from "node:crypto";
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";
import {
  fetchExternalBrandLogoBuffer,
  inferLogoMimeType,
  isExternalBrandLogoRef,
  urlFromExternalBrandLogoRef,
} from "../lib/brand-logo-ref.js";
import { GenerateVideosOperation } from "@google/genai";
import {
  gemini,
  IMAGE_MODEL,
  IMAGE_MODEL_FALLBACK,
  isVertexImageEnabled,
  generateProImage,
  VERTEX_IMAGE_MODEL,
  SYSTEM_INSTRUCTION,
  buildProjectInstructions,
  TEMPERATURE_DEFAULT,
  GENERATION_TIMEOUT_MS,
  type AspectRatio,
  type ImageSize,
} from "../lib/gemini.js";
import { VIDEO_MODELS, VIDEO_MODEL_FALLBACK, VIDEO_INITIAL_SECONDS } from "../lib/veo.js";
import { isUuid } from "../lib/validation.js";
import { SIGNED_URL_EXPIRY_SECONDS, EMAIL_ASSETS_BUCKET } from "../lib/storage-constants.js";
import { getPlanConfig, getFullCampaignPricing } from "../lib/plan-config.js";
import {
  generateCampaignImagePrompts,
  generateCampaignContent,
  type CampaignClaudeImageOutput,
  type CampaignClaudeContentOutput,
  type CampaignEmail,
  type CampaignParams,
} from "../lib/claude.js";

const router = Router();
const IMAGE_BUCKET = "generated-images";
const VIDEO_BUCKET = "generated-videos";
const PROJECT_ASSETS_BUCKET = "project-assets";

/* ─── SSE helper ─────────────────────────────────────────────────────────────── */

function sendSSE(res: Response, data: Record<string, unknown>) {
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client disconnected
  }
}

/** Detect image MIME from base64 magic bytes so Claude/Veo get the correct type (avoids client mismatch). */
function detectImageMimeFromBase64(base64: string): "image/jpeg" | "image/png" | "image/webp" | null {
  try {
    const buf = Buffer.from(base64, "base64");
    if (buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x42 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
    return null;
  } catch {
    return null;
  }
}

/* ─── Image generation (simplified from generations.ts) ──────────────────────── */

async function generateCampaignImage(
  prompt: string,
  aspectRatio: AspectRatio,
  systemInstruction: string,
  imageSize: ImageSize = "1K",
  productImageBase64?: string,
  productImageMimeType?: string,
  logoBase64?: string,
  logoMimeType?: string
): Promise<Buffer> {
  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  if (logoBase64 && logoMimeType) {
    contents.push({ inlineData: { mimeType: logoMimeType, data: logoBase64 } });
  }
  if (productImageBase64 && productImageMimeType) {
    contents.push({ inlineData: { mimeType: productImageMimeType, data: productImageBase64 } });
  }
  const seed = Math.floor(Math.random() * 2 ** 31);

  let imageBuffer: Buffer | null = null;

  if (isVertexImageEnabled()) {
    for (const [model, priority] of [
      [VERTEX_IMAGE_MODEL, false],
      [IMAGE_MODEL, false],
      [VERTEX_IMAGE_MODEL, true],
    ] as const) {
      try {
        const r = await generateProImage({
          contents, systemInstruction, seed, aspectRatio, imageSize,
          temperature: TEMPERATURE_DEFAULT, vertexModel: model, usePriorityPayGo: priority,
        });
        if (!r.safetyBlocked && r.imageBuffer.length > 0) {
          imageBuffer = r.imageBuffer;
          break;
        }
      } catch { /* try next */ }
    }
  } else {
    const tryApiModel = async (model: string) => {
      const result = await gemini.models.generateContent({
        model, contents,
        config: {
          systemInstruction,
          responseModalities: ["TEXT", "IMAGE"],
          temperature: TEMPERATURE_DEFAULT,
          seed,
          imageConfig: { aspectRatio, imageSize },
          httpOptions: { timeout: GENERATION_TIMEOUT_MS },
        },
      });
      const parts = result.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          imageBuffer = Buffer.from(part.inlineData.data, "base64");
          break;
        }
      }
      if (result.candidates?.[0]?.finishReason === "SAFETY") {
        throw new Error("Content blocked by safety filters");
      }
    };

    try {
      await tryApiModel(IMAGE_MODEL);
    } catch {
      await tryApiModel(IMAGE_MODEL_FALLBACK);
    }
  }

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("No image returned from model");
  }
  return imageBuffer;
}

/** Generate image using only the fallback model (after primary + retry failed). */
async function generateCampaignImageFallbackOnly(
  prompt: string,
  aspectRatio: AspectRatio,
  systemInstruction: string,
  imageSize: ImageSize = "1K",
  productImageBase64?: string,
  productImageMimeType?: string,
  logoBase64?: string,
  logoMimeType?: string
): Promise<Buffer> {
  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  if (logoBase64 && logoMimeType) {
    contents.push({ inlineData: { mimeType: logoMimeType, data: logoBase64 } });
  }
  if (productImageBase64 && productImageMimeType) {
    contents.push({ inlineData: { mimeType: productImageMimeType, data: productImageBase64 } });
  }
  const seed = Math.floor(Math.random() * 2 ** 31);
  let imageBuffer: Buffer | null = null;

  if (isVertexImageEnabled()) {
    try {
      const r = await generateProImage({
        contents,
        systemInstruction,
        seed,
        aspectRatio,
        imageSize,
        temperature: TEMPERATURE_DEFAULT,
        vertexModel: VERTEX_IMAGE_MODEL,
        usePriorityPayGo: true,
      });
      if (!r.safetyBlocked && r.imageBuffer.length > 0) imageBuffer = r.imageBuffer;
    } catch {
      // ignore
    }
  } else {
    try {
      const result = await gemini.models.generateContent({
        model: IMAGE_MODEL_FALLBACK,
        contents,
        config: {
          systemInstruction,
          responseModalities: ["TEXT", "IMAGE"],
          temperature: TEMPERATURE_DEFAULT,
          seed,
          imageConfig: { aspectRatio, imageSize },
          httpOptions: { timeout: GENERATION_TIMEOUT_MS },
        },
      });
      const parts = result.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          imageBuffer = Buffer.from(part.inlineData.data, "base64");
          break;
        }
      }
      if (result.candidates?.[0]?.finishReason === "SAFETY") throw new Error("Content blocked by safety filters");
    } catch {
      // ignore
    }
  }

  if (!imageBuffer || imageBuffer.length === 0) throw new Error("No image returned from model");
  return imageBuffer;
}

/* ─── Upload image to storage ────────────────────────────────────────────────── */

async function uploadImageToStorage(
  imageBuffer: Buffer,
  workspaceId: string,
  projectId: string,
  genId: string,
  bucket: string
): Promise<string> {
  const storagePath = `${workspaceId}/${projectId}/${genId}.png`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, imageBuffer, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return storagePath;
}

/** Fetch image from URL and return base64 + mime for Veo lastFrame. */
async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "image/*" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const mimeType = ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : "image/jpeg";
    return { data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

/* ─── Get signed/public URL ──────────────────────────────────────────────────── */

async function getImageUrl(storagePath: string, bucket: string): Promise<string> {
  if (bucket === EMAIL_ASSETS_BUCKET) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  }
  const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);
  return data?.signedUrl ?? "";
}

/* ─── Credit deduction ───────────────────────────────────────────────────────── */

async function deductCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  description: string
): Promise<number> {
  const { data: ws } = await supabase.from("workspaces").select("credits").eq("id", workspaceId).single();
  const newBalance = Math.max(0, (ws?.credits ?? 0) - amount);
  await supabase.from("workspaces").update({ credits: newBalance }).eq("id", workspaceId);
  await supabase.from("credit_transactions").insert({
    workspace_id: workspaceId,
    user_id: userId,
    type: "generation",
    amount: -amount,
    balance_after: newBalance,
    description,
  });
  return newBalance;
}

/* ─── Parse brand tone / industry from brand_guidelines ────────────────────────── */

function extractBrandTone(guidelines: string | null): string {
  if (!guidelines) return "professional and warm";
  for (const line of guidelines.split("\n")) {
    const t = line.trim();
    if (t.startsWith("BRAND_TONE:")) return t.slice("BRAND_TONE:".length).trim();
  }
  return "professional and warm";
}

function extractBrandIndustry(guidelines: string | null): string | undefined {
  if (!guidelines) return undefined;
  for (const line of guidelines.split("\n")) {
    const t = line.trim();
    if (t.startsWith("BRAND_INDUSTRY:")) return t.slice("BRAND_INDUSTRY:".length).trim() || undefined;
  }
  return undefined;
}

/** Return the rest of brand_guidelines after stripping BRAND_TONE, BRAND_INDUSTRY, and GRADIENT lines. Capped at 800 chars. */
function extractBrandGuidelinesRest(guidelines: string | null): string | undefined {
  if (!guidelines || !guidelines.trim()) return undefined;
  const lines = guidelines.split("\n");
  const rest: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("BRAND_TONE:") || t.startsWith("BRAND_INDUSTRY:") || /^GRADIENT:/i.test(t)) continue;
    rest.push(line);
  }
  const trimmed = rest.join("\n").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 800);
}

/** Download project brand logo from storage to base64 + mime. Returns null if no logo or download fails. */
async function fetchBrandLogoAsBase64(storagePath: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const { data: blob, error } = await supabase.storage.from(PROJECT_ASSETS_BUCKET).download(storagePath);
    if (error || !blob) return null;
    const buf = Buffer.from(await blob.arrayBuffer());
    const data = buf.toString("base64");
    const ext = storagePath.split(".").pop()?.toLowerCase() ?? "png";
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
    };
    const mimeType = mimeMap[ext] ?? "image/png";
    return { data, mimeType };
  } catch {
    return null;
  }
}

/* ─── Video poll helper ──────────────────────────────────────────────────────── */

async function pollVideoUntilDone(
  operationName: string,
  generationId: string,
  workspaceId: string,
  projectId: string,
  timeoutMs = 10 * 60 * 1000
): Promise<{ videoUrl: string | null; error?: string }> {
  const deadline = Date.now() + timeoutMs;
  let pollInterval = 5000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollInterval));
    pollInterval = Math.min(pollInterval * 1.3, 15000);

    const operationForPoll = Object.assign(new GenerateVideosOperation(), { name: operationName });
    let op: Awaited<ReturnType<typeof gemini.operations.getVideosOperation>>;
    try {
      op = await gemini.operations.getVideosOperation({ operation: operationForPoll });
    } catch {
      continue;
    }

    if (op.done !== true) continue;

    if (op.error) {
      const errMsg = typeof op.error === "object" && op.error !== null && "message" in op.error
        ? String((op.error as { message?: unknown }).message)
        : "Video generation failed";
      await supabase.from("video_generations")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", generationId);
      return { videoUrl: null, error: errMsg };
    }

    const video = op.response?.generatedVideos?.[0]?.video;
    if (!video) {
      await supabase.from("video_generations")
        .update({ status: "failed", error_message: "No video in response" })
        .eq("id", generationId);
      return { videoUrl: null, error: "No video returned" };
    }

    let videoBuffer: Buffer | null = null;
    if (video.videoBytes) {
      videoBuffer = Buffer.from(video.videoBytes, "base64");
    } else if (video.uri) {
      try {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error("GEMINI_API_KEY not set");
        let fetchUrl = video.uri;
        if (video.uri.includes("generativelanguage.googleapis.com") && video.uri.includes("/files/")) {
          if (!video.uri.includes(":download")) {
            const base = video.uri.replace(/\?.*$/, "");
            fetchUrl = `${base}:download?alt=media`;
          }
          if (!fetchUrl.includes("key=")) {
            fetchUrl += `${fetchUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(geminiKey)}`;
          }
        }
        const resp = await fetch(fetchUrl, { headers: { "x-goog-api-key": geminiKey } });
        if (resp.ok) {
          const ct = resp.headers.get("content-type") ?? "";
          const buf = Buffer.from(await resp.arrayBuffer());
          if (!ct.includes("application/json") && buf.length > 0 && buf[0] !== 0x7b) {
            videoBuffer = buf;
          }
        }
      } catch (e) {
        console.error("Failed to fetch video from URI:", e);
      }
    }

    if (!videoBuffer || videoBuffer.length === 0) {
      await supabase.from("video_generations")
        .update({ status: "failed", error_message: "Could not retrieve video data" })
        .eq("id", generationId);
      return { videoUrl: null, error: "Could not retrieve video data" };
    }

    const storagePath = `${workspaceId}/${projectId}/${generationId}.mp4`;
    const { error: uploadErr } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });
    if (uploadErr) {
      await supabase.from("video_generations")
        .update({ status: "failed", error_message: "Storage upload failed" })
        .eq("id", generationId);
      return { videoUrl: null, error: "Video storage upload failed" };
    }

    await supabase.from("video_generations")
      .update({ status: "completed", storage_path: storagePath })
      .eq("id", generationId);

    const { data: signed } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    return { videoUrl: signed?.signedUrl ?? null };
  }

  await supabase.from("video_generations")
    .update({ status: "failed", error_message: "Timed out after 10 minutes" })
    .eq("id", generationId);
  return { videoUrl: null, error: "Video generation timed out" };
}

/* ─── Email HTML assembly (replaces Gemini call) ─────────────────────────────── */

function assembleEmailHtml(
  htmlTemplate: string,
  imageUrls: string[],
  brandWebsite: string,
  socialLinks?: CampaignParams["socialLinks"]
): { html: string; valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const unsubBase = (brandWebsite || "#").replace(/\/$/, "");
  const unsubscribeUrl =
    !brandWebsite || brandWebsite === "#" ? "#" : `${unsubBase}/unsubscribe`;

  let html = htmlTemplate
    .replace(/\{\{EMAIL_IMAGE_1\}\}/g, imageUrls[0] || "")
    .replace(/\{\{EMAIL_IMAGE_2\}\}/g, imageUrls[1] || "")
    .replace(/\{\{EMAIL_IMAGE_3\}\}/g, imageUrls[2] || "")
    .replace(/\{\{CTA_URL\}\}/g, brandWebsite || "#")
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);

  // Reliability fallback: if user configured social links but model omitted them, inject a compact social+contact block.
  const socialEntries = Object.entries(socialLinks ?? {}).filter(
    ([k, v]) =>
      typeof v === "string" &&
      v.trim().length > 0 &&
      !["contact_email", "address"].includes(k)
  ) as Array<[string, string]>;
  const hasAnyConfiguredSocial = socialEntries.length > 0;
  const hasAnyConfiguredUrlInHtml =
    hasAnyConfiguredSocial &&
    socialEntries.some(([, v]) => html.toLowerCase().includes(v.trim().toLowerCase()));

  if (hasAnyConfiguredSocial && !hasAnyConfiguredUrlInHtml) {
    const safe = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const linkRow = socialEntries
      .map(([k, v]) => {
        const label = k === "x" ? "X" : k.charAt(0).toUpperCase() + k.slice(1);
        return `<a href="${safe(v.trim())}" style="display:inline-block;margin:0 8px;color:#666666;text-decoration:underline;font-size:12px;">${safe(label)}</a>`;
      })
      .join("");
    const contactEmail = typeof socialLinks?.contact_email === "string" ? socialLinks.contact_email.trim() : "";
    const address = typeof socialLinks?.address === "string" ? socialLinks.address.trim() : "";
    const contactLine = contactEmail
      ? `<p style="margin:8px 0 0;font-size:12px;color:#888888;"><a href="mailto:${safe(contactEmail)}" style="color:#888888;text-decoration:underline;">${safe(contactEmail)}</a></p>`
      : "";
    const addressLine = address
      ? `<p style="margin:6px 0 0;font-size:11px;color:#999999;font-style:italic;">${safe(address)}</p>`
      : "";
    const injected = `<div style="padding:20px 24px;text-align:center;background:#ffffff;"><p style="margin:0 0 10px;font-size:12px;color:#999999;text-transform:uppercase;letter-spacing:1px;">Stay Connected</p><div>${linkRow}</div>${contactLine}${addressLine}</div>`;
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${injected}</body>`);
    else html += injected;
    errors.push("Model omitted configured social links; injected fallback social block.");
  }

  const remainingPlaceholders = html.match(/\{\{[A-Z_]+\}\}/g);
  if (remainingPlaceholders) {
    errors.push(`Unreplaced placeholders: ${remainingPlaceholders.join(", ")}`);
  }

  const startsOk = /^\s*<!DOCTYPE\s+html/i.test(html) || /^\s*<html/i.test(html);
  if (!startsOk) errors.push("HTML does not start with <!DOCTYPE html> or <html>");

  const endsOk = /<\/html>\s*$/i.test(html);
  if (!endsOk) errors.push("HTML does not end with </html>");

  const hasRealImage = /<img[^>]+src=["']https?:\/\//i.test(html);
  if (!hasRealImage && imageUrls.some(Boolean)) {
    errors.push("No <img> tag with a real URL found");
  }

  return { html, valid: errors.length === 0, errors };
}

/* ─── GET campaign session (fresh signed URLs for rehydration) ────────────────── */

router.get(
  "/:workspaceId/projects/:projectId/campaign/sessions/:sessionId",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    const { workspaceId, projectId, sessionId } = req.params;
    if (!isUuid(workspaceId) || !isUuid(projectId) || !isUuid(sessionId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const user = req.user!;
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const { data: session, error } = await supabase
      .from("campaign_sessions")
      .select("id, campaign_goal, platforms_selected, claude_output, asset_urls, credits_used, status, created_at")
      .eq("id", sessionId)
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .single();
    if (error || !session) {
      res.status(404).json({ error: "Campaign session not found" });
      return;
    }
    const assetUrls = (session.asset_urls ?? {}) as Record<string, unknown>;
    const metaPaths = assetUrls.meta_image_paths as string[] | undefined;
    const storyPaths = assetUrls.story_image_paths as string[] | undefined;
    const video16Path = assetUrls.video_16x9_path as string | undefined;
    const video9Path = assetUrls.video_9x16_path as string | undefined;
    const metaImageUrls: string[] = [];
    const storyImageUrls: string[] = [];
    if (Array.isArray(metaPaths)) {
      let firstMetaUrl: string | null = null;
      for (const p of metaPaths) {
        if (typeof p === "string") {
          const u = await getImageUrl(p, IMAGE_BUCKET);
          firstMetaUrl ??= u;
          metaImageUrls.push(u);
        } else {
          metaImageUrls.push(firstMetaUrl ?? "");
        }
      }
    }
    if (Array.isArray(storyPaths)) {
      let firstStoryUrl: string | null = null;
      for (const p of storyPaths) {
        if (typeof p === "string") {
          const u = await getImageUrl(p, IMAGE_BUCKET);
          firstStoryUrl ??= u;
          storyImageUrls.push(u);
        } else {
          storyImageUrls.push(firstStoryUrl ?? "");
        }
      }
    }
    const video16Url = typeof video16Path === "string" ? (await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(video16Path, SIGNED_URL_EXPIRY_SECONDS)).data?.signedUrl ?? null : null;
    const video9Url = typeof video9Path === "string" ? (await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(video9Path, SIGNED_URL_EXPIRY_SECONDS)).data?.signedUrl ?? null : null;
    const claudeOutput = (session.claude_output ?? {}) as Record<string, unknown>;

    /* Reassemble email HTML with fresh signed URLs (same fix as posts tab — stored HTML had expired URLs) */
    let emailHtml: string | null = (assetUrls.email_html as string | null) ?? null;
    let emailHtmls: string[] = Array.isArray(assetUrls.email_htmls) ? [...assetUrls.email_htmls] : emailHtml ? [emailHtml, emailHtml] : [];
    const email1 = claudeOutput.email_1 as Record<string, string> | undefined;
    const email2 = claudeOutput.email_2 as Record<string, string> | undefined;
    const templates = [email1?.html_template, email2?.html_template].filter((t): t is string => typeof t === "string" && t.length > 0);
    if (templates.length >= 1 && metaImageUrls.length > 0 && storyImageUrls.length > 0) {
      const { data: project } = await supabase.from("projects").select("website_url, social_links").eq("id", projectId).single();
      const brandWebsite = (project?.website_url as string | null)?.trim() || "#";
      const socialLinks = (project?.social_links as CampaignParams["socialLinks"] | null) ?? undefined;
      const successFeed = metaImageUrls.filter(Boolean);
      const successStory = storyImageUrls.filter(Boolean);
      const emailImageCombos: [string, string, string][] = [
        [successFeed[0] ?? "", successStory[0] ?? "", successFeed[1] ?? successFeed[0] ?? ""],
        [successFeed[1] ?? successFeed[0] ?? "", successStory[1] ?? successStory[0] ?? "", successFeed[2] ?? successFeed[0] ?? ""],
      ];
      const reassembled: string[] = [];
      for (let i = 0; i < templates.length; i++) {
        const combo = emailImageCombos[Math.min(i, emailImageCombos.length - 1)]!;
        const { html } = assembleEmailHtml(templates[i]!, combo, brandWebsite, socialLinks);
        reassembled.push(html);
      }
      if (reassembled.length > 0) {
        emailHtml = reassembled[0]!;
        emailHtmls = reassembled.length >= 2 ? reassembled : [reassembled[0]!, reassembled[0]!];
      }
    }

    const storedEmailCopies = assetUrls.email_copies as Array<Record<string, string>> | undefined;
    const emailCopiesFromClaude = [claudeOutput.email_1, claudeOutput.email_2]
      .filter((e): e is Record<string, string> => e != null && typeof e === "object")
      .map((e) => ({
        subject_line: e.subject_line,
        preview_text: e.preview_text,
        headline: e.headline,
        subheadline: e.subheadline,
        cta_primary: e.cta_primary,
        footer_tagline: e.footer_tagline,
      }));
    const emailCopies = Array.isArray(storedEmailCopies) && storedEmailCopies.length >= 2
      ? storedEmailCopies
      : emailCopiesFromClaude.length >= 2
        ? emailCopiesFromClaude
        : [];
    const emailBlock = claudeOutput.email as Record<string, string> | undefined;
    const emailCopy = emailBlock
      ? {
          subject_line: emailBlock.subject_line,
          preview_text: emailBlock.preview_text,
          headline: emailBlock.headline,
          subheadline: emailBlock.subheadline,
          cta_primary: emailBlock.cta_primary,
          footer_tagline: emailBlock.footer_tagline,
        }
      : (emailCopies[0] ?? undefined);

    res.json({
      id: session.id,
      campaign_goal: session.campaign_goal,
      platforms_selected: session.platforms_selected,
      claude_output: session.claude_output,
      credits_used: session.credits_used,
      status: session.status,
      created_at: session.created_at,
      asset_urls: {
        meta_image_urls: metaImageUrls.length ? metaImageUrls : (assetUrls.meta_image_urls ?? []),
        story_image_urls: storyImageUrls.length ? storyImageUrls : (assetUrls.story_image_urls ?? []),
        video_16x9: video16Url ?? assetUrls.video_16x9 ?? null,
        video_9x16: video9Url ?? assetUrls.video_9x16 ?? null,
        email_html: emailHtml ?? assetUrls.email_html ?? null,
        email_htmls: emailHtmls.length ? emailHtmls : (assetUrls.email_htmls ?? (assetUrls.email_html ? [assetUrls.email_html, assetUrls.email_html] : [])),
      },
      email_copy: emailCopy,
      email_copies: emailCopies,
    });
  }
);

/* ─── Main route ─────────────────────────────────────────────────────────────── */

router.post(
  "/:workspaceId/projects/:projectId/campaign/generate",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    const { workspaceId, projectId } = req.params;
    if (!isUuid(workspaceId) || !isUuid(projectId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const user = req.user!;

    /* ── Auth + membership ─────────────────────────────────────────────── */

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      res.status(403).json({ error: "Not a workspace member" });
      return;
    }

    /* ── Project + brand data ──────────────────────────────────────────── */

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .single();

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const brandName = project.name;
    if (!brandName) {
      res.status(400).json({
        error: "Your brand profile is incomplete. Add your brand name to continue.",
      });
      return;
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("credits, plan")
      .eq("id", workspaceId)
      .single();

    if (!workspace) {
      res.status(402).json({
        error: "Workspace not found.",
        code: "WORKSPACE_NOT_FOUND",
      });
      return;
    }

    const planConfig = getPlanConfig(workspace.plan ?? "free");

    if (!planConfig.fullCampaignEnabled) {
      res.status(403).json({
        error:
          "Full Campaign is not available on " +
          "your current plan. Upgrade to " +
          "Professional or Agency to unlock it.",
        code: "PLAN_UPGRADE_REQUIRED",
        feature: "full_campaign",
        requiredPlan: "pro",
      });
      return;
    }

    if (!planConfig.videoEnabled) {
      res.status(403).json({
        error:
          "Video generation is not available " +
          "on your current plan. Upgrade to " +
          "Professional or Agency.",
        code: "PLAN_UPGRADE_REQUIRED",
        feature: "video",
        requiredPlan: "pro",
      });
      return;
    }

    const cqRaw = req.body?.campaignQuality;
    const campaignQuality: "1K" | "4K" =
      cqRaw === "4K" || cqRaw === "4k" ? "4K" : "1K";
    const fc = getFullCampaignPricing(campaignQuality);

    if ((workspace.credits ?? 0) < fc.total) {
      res.status(402).json({
        error:
          `Insufficient credits. Full Campaign (${campaignQuality}) requires ${fc.total} credits. You have ${workspace.credits ?? 0}.`,
        code: "INSUFFICIENT_CREDITS",
        creditsRequired: fc.total,
        creditsAvailable: workspace.credits ?? 0,
        campaignQuality,
      });
      return;
    }

    /* ── Parse request body ────────────────────────────────────────────── */

    const productDescription = typeof req.body?.productDescription === "string" ? req.body.productDescription.trim() : undefined;
    const campaignGoal = typeof req.body?.campaignGoal === "string" ? req.body.campaignGoal.trim() : "";
    const platforms: string[] = Array.isArray(req.body?.platforms) ? req.body.platforms : [];

    if (!campaignGoal) {
      res.status(400).json({ error: "Campaign goal is required" });
      return;
    }
    if (platforms.length === 0) {
      res.status(400).json({ error: "At least one platform is required" });
      return;
    }

    let productImageBase64: string | undefined;
    let productImageMimeType: string | undefined;
    if (req.body?.productImage && typeof req.body.productImage === "string") {
      let imgData: string = req.body.productImage;
      let declaredMime = req.body.productImageMimeType || "image/jpeg";
      if (declaredMime === "image/webp") declaredMime = "image/jpeg";

      const sizeBytes = Math.ceil(imgData.length * 0.75);
      if (sizeBytes > 1_500_000) {
        imgData = imgData.slice(0, Math.floor(1_000_000 / 0.75));
      }

      productImageBase64 = imgData;
      productImageMimeType = detectImageMimeFromBase64(imgData) ?? declaredMime;
      if (productImageMimeType === "image/webp") productImageMimeType = "image/jpeg";
    }

    /* ── Brand params ──────────────────────────────────────────────────── */

    const brandColors = (project.brand_colors as string[] | null) ?? [];
    const primaryColorHex = brandColors[0] || "#000000";
    const secondaryColorHex = brandColors[1] || "#000000";
    const brandTone = extractBrandTone(project.brand_guidelines as string | null);
    const brandWebsite = (project.website_url as string | null)?.trim() || "#";
    const preferredStyle = typeof req.body?.preferredStyle === "string" ? req.body.preferredStyle.trim() || undefined : undefined;
    const additionalContext = typeof req.body?.additionalContext === "string" ? req.body.additionalContext.trim().slice(0, 1000) || undefined : undefined;

    let brandLogoUrl: string | undefined;
    if (project.brand_logo && typeof project.brand_logo === "string") {
      if (isExternalBrandLogoRef(project.brand_logo)) {
        brandLogoUrl = urlFromExternalBrandLogoRef(project.brand_logo) ?? undefined;
      } else {
        const { data: logoSigned } = await supabase.storage
          .from(PROJECT_ASSETS_BUCKET)
          .createSignedUrl(project.brand_logo, 604800);
        brandLogoUrl = logoSigned?.signedUrl ?? undefined;
      }
    }

    const rawSocial = project.social_links as Record<string, unknown> | null;
    let socialLinks: CampaignParams["socialLinks"];
    if (rawSocial && typeof rawSocial === "object" && !Array.isArray(rawSocial)) {
      const o: NonNullable<CampaignParams["socialLinks"]> = {};
      const set = (k: keyof NonNullable<CampaignParams["socialLinks"]>, v: unknown) => {
        if (typeof v === "string" && v.trim()) (o as Record<string, string>)[k] = v.trim().slice(0, 2048);
      };
      set("instagram", rawSocial.instagram);
      set("tiktok", rawSocial.tiktok);
      set("facebook", rawSocial.facebook);
      set("x", rawSocial.x);
      set("linkedin", rawSocial.linkedin);
      set("pinterest", rawSocial.pinterest);
      set("youtube", rawSocial.youtube);
      set("contact_email", rawSocial.contact_email);
      set("address", rawSocial.address);
      socialLinks = Object.keys(o).length ? o : undefined;
    } else {
      socialLinks = undefined;
    }

    const campaignParams: CampaignParams = {
      brandName,
      primaryColorHex,
      secondaryColorHex,
      brandTone,
      brandWebsite,
      brandLogoUrl,
      productDescription,
      hasProductImage: !!productImageBase64,
      campaignGoal,
      platforms,
      targetAudience: (project.target_audience as string | null) ?? undefined,
      brandDescription: (project.description as string | null) ?? undefined,
      brandIndustry: extractBrandIndustry(project.brand_guidelines as string | null),
      brandGuidelines: extractBrandGuidelinesRest(project.brand_guidelines as string | null),
      additionalContext,
      preferredStyle,
      socialLinks,
    };

    let logoBase64: string | undefined;
    let logoMimeType: string | undefined;
    if (project.brand_logo && typeof project.brand_logo === "string") {
      const logo = await fetchBrandLogoAsBase64(project.brand_logo);
      if (logo) {
        logoBase64 = logo.data;
        logoMimeType = logo.mimeType;
      }
    }

    /* ── Start SSE stream ──────────────────────────────────────────────── */

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const campaignId = crypto.randomUUID();
    let totalCreditsUsed = 0;
    let clientDisconnected = false;
    req.on("close", () => { clientDisconnected = true; });

    sendSSE(res, {
      task: "campaign_started",
      campaign_id: campaignId,
      campaign_quality: campaignQuality,
      credits_budget: fc.total,
    });

    /* ── Step 1: Two parallel Claude calls ─────────────────────────────── */

    sendSSE(res, { task: "claude_json", status: "in_progress" });
    console.log("[Campaign] Step 1: Firing two parallel Claude calls...");

    const claudeStart = Date.now();

    let imageOutput: CampaignClaudeImageOutput;
    let contentOutput: CampaignClaudeContentOutput;

    try {
      const [imgResult, contentResult] = await Promise.all([
        generateCampaignImagePrompts(campaignParams, productImageBase64, productImageMimeType),
        generateCampaignContent(campaignParams, productImageBase64, productImageMimeType),
      ]);
      imageOutput = imgResult;
      contentOutput = contentResult;
      console.log("[Campaign] Claude Call 1 (image prompts) done in", ((Date.now() - claudeStart) / 1000).toFixed(1), "s");
      console.log("[Campaign] Claude Call 2 (email + social) done in", ((Date.now() - claudeStart) / 1000).toFixed(1), "s");
    } catch (err) {
      const gu = err && typeof err === "object" && "code" in err && (err as { code: string }).code === "GENERATION_UNAVAILABLE";
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : err instanceof Error ? err.message : String(err);
      console.error("[Campaign] Claude failed:", msg);
      sendSSE(res, {
        task: "claude_json",
        status: "failed",
        error: msg,
        ...(gu ? { retryable: true, code: "generation_unavailable" as const } : {}),
      });
      sendSSE(res, {
        task: "campaign_complete",
        status: "partial_failure",
        campaign_id: campaignId,
        total_credits_used: totalCreditsUsed,
        ...(gu ? { retryable: true } : {}),
      });
      res.end();
      return;
    }

    const claudeTime = (Date.now() - claudeStart) / 1000;
    const imageStyleChosen = imageOutput?.image_feed_1?.style_chosen ?? imageOutput?.image_story_1?.style_chosen ?? null;
    sendSSE(res, {
      task: "claude_json", status: "complete",
      credits_used: 0,
      time_taken: claudeTime,
      ...(imageStyleChosen && { image_style_chosen: imageStyleChosen }),
    });
    console.log("[Campaign] Both Claude calls complete in", claudeTime, "s");

    if (clientDisconnected) { res.end(); return; }

    /* ── Build system instruction for images ───────────────────────────── */

    const projectInstructions = buildProjectInstructions(project);
    const imgSystemInstruction = SYSTEM_INSTRUCTION + (projectInstructions
      ? `\n\n--- PROJECT INSTRUCTIONS ---\n${projectInstructions}`
      : "");

    /* ── Step 2: 3× feed + 3× story images (retry + fallback per image) ─────── */

    console.log("[Campaign] Step 2: Firing 3 feed + 3 story image tasks (Ad creatives — Feed 4:5 × 3, Vertical 9:16 × 3)...");

    type TaskResult = { task: string; url?: string; error?: string; generationId?: string; videoGenerationId?: string; storagePath?: string; videoStoragePath?: string };

    const buildImagePromptWithOverlay = (
      genPrompt: string,
      headline: string,
      cta: string,
      subtext: string
    ) => `${genPrompt}\n\nInclude this text overlay in the image:\nHeadline: ${headline}\nCTA button: ${cta}\nSupporting text: ${subtext}`;

    const NEGATIVE_PROMPT_AD_CREATIVE = "\n\nDo NOT include: people, faces, hands, fingers, text that is not specified in the overlay instructions, watermarks, blurry areas, multiple products, duplicate items, distorted product labels.";
    const NEGATIVE_PROMPT_EMAIL = "\n\nDo NOT include: people, faces, hands, text overlays, watermarks, blurry areas, overly dramatic lighting. Keep it clean and email-appropriate.";

    const feed1Meta = imageOutput!.image_feed_1;
    const feed2Meta = imageOutput!.image_feed_2;
    const feed3Meta = imageOutput!.image_feed_3;
    const story1Meta = imageOutput!.image_story_1;
    const story2Meta = imageOutput!.image_story_2;
    const story3Meta = imageOutput!.image_story_3;

    const feed1Prompt = buildImagePromptWithOverlay(feed1Meta.generation_prompt, feed1Meta.overlay_headline, feed1Meta.overlay_cta, feed1Meta.overlay_subtext) + NEGATIVE_PROMPT_AD_CREATIVE;
    const feed2Prompt = buildImagePromptWithOverlay(feed2Meta.generation_prompt, feed2Meta.overlay_headline, feed2Meta.overlay_cta, feed2Meta.overlay_subtext) + NEGATIVE_PROMPT_AD_CREATIVE;
    const feed3Prompt = buildImagePromptWithOverlay(feed3Meta.generation_prompt, feed3Meta.overlay_headline, feed3Meta.overlay_cta, feed3Meta.overlay_subtext) + NEGATIVE_PROMPT_AD_CREATIVE;
    const story1Prompt = buildImagePromptWithOverlay(story1Meta.generation_prompt, story1Meta.overlay_headline, story1Meta.overlay_cta, story1Meta.overlay_subtext) + NEGATIVE_PROMPT_AD_CREATIVE;
    const story2Prompt = buildImagePromptWithOverlay(story2Meta.generation_prompt, story2Meta.overlay_headline, story2Meta.overlay_cta, story2Meta.overlay_subtext) + NEGATIVE_PROMPT_AD_CREATIVE;
    const story3Prompt = buildImagePromptWithOverlay(story3Meta.generation_prompt, story3Meta.overlay_headline, story3Meta.overlay_cta, story3Meta.overlay_subtext) + NEGATIVE_PROMPT_AD_CREATIVE;

    const MAX_IMAGE_ATTEMPTS = 4;
    async function runOneImageTask(
      taskId: string,
      prompt: string,
      aspectRatio: AspectRatio,
      creditAmount: number,
      imageSize: ImageSize,
      includeLogo: boolean
    ): Promise<TaskResult> {
      sendSSE(res, { task: taskId, status: "in_progress" });
      const start = Date.now();
      const passLogo = includeLogo ? logoBase64 : undefined;
      const passLogoMime = includeLogo ? logoMimeType : undefined;
      let buf: Buffer | null = null;
      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt++) {
        try {
          buf = attempt <= 3
            ? await generateCampaignImage(prompt, aspectRatio, imgSystemInstruction, imageSize, productImageBase64, productImageMimeType, passLogo, passLogoMime)
            : await generateCampaignImageFallbackOnly(prompt, aspectRatio, imgSystemInstruction, imageSize, productImageBase64, productImageMimeType, passLogo, passLogoMime);
          if (buf && buf.length > 0) break;
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error(String(err));
          if (attempt === MAX_IMAGE_ATTEMPTS) {
            console.error("[Campaign]", taskId, "failed after", MAX_IMAGE_ATTEMPTS, "attempts:", lastErr.message);
            sendSSE(res, { task: taskId, status: "failed", error: lastErr.message });
            return { task: taskId, error: lastErr.message };
          }
        }
      }
      if (!buf || buf.length === 0) {
        const msg = lastErr?.message ?? "No image returned from model";
        console.error("[Campaign]", taskId, "failed after", MAX_IMAGE_ATTEMPTS, "attempts:", msg);
        sendSSE(res, { task: taskId, status: "failed", error: msg });
        return { task: taskId, error: msg };
      }
      const genId = crypto.randomUUID();
      await supabase.from("generations").insert({
        id: genId,
        workspace_id: workspaceId,
        project_id: projectId,
        user_id: user.id,
        prompt: prompt.slice(0, 4500),
        aspect_ratio: aspectRatio,
        model: IMAGE_MODEL,
        credits_used: creditAmount,
        status: "completed",
      });
      const storagePath = await uploadImageToStorage(buf, workspaceId, projectId, genId, IMAGE_BUCKET);
      await supabase.from("generations").update({ result_url: storagePath }).eq("id", genId);
      const url = await getImageUrl(storagePath, IMAGE_BUCKET);
      totalCreditsUsed += creditAmount;
      await deductCredits(workspaceId, user.id, creditAmount, `Full Campaign: ${taskId}`);
      const elapsed = (Date.now() - start) / 1000;
      console.log("[Campaign]", taskId, "complete in", elapsed, "s");
      sendSSE(res, { task: taskId, status: "complete", result_url: url, credits_used: creditAmount, time_taken: elapsed, generation_id: genId });
      return { task: taskId, url, generationId: genId, storagePath };
    }

    /** Single attempt for a failed image (used after 1-min wait). */
    async function runOneImageTaskSingleAttempt(
      taskId: string,
      prompt: string,
      aspectRatio: AspectRatio,
      creditAmount: number,
      imageSize: ImageSize,
      includeLogo: boolean
    ): Promise<TaskResult> {
      const passLogo = includeLogo ? logoBase64 : undefined;
      const passLogoMime = includeLogo ? logoMimeType : undefined;
      try {
        let buf: Buffer | null = await generateCampaignImage(prompt, aspectRatio, imgSystemInstruction, imageSize, productImageBase64, productImageMimeType, passLogo, passLogoMime);
        if (!buf || buf.length === 0) buf = await generateCampaignImageFallbackOnly(prompt, aspectRatio, imgSystemInstruction, imageSize, productImageBase64, productImageMimeType, passLogo, passLogoMime);
        if (!buf || buf.length === 0) return { task: taskId, error: "No image returned from model" };
        const genId = crypto.randomUUID();
        await supabase.from("generations").insert({
          id: genId,
          workspace_id: workspaceId,
          project_id: projectId,
          user_id: user.id,
          prompt: prompt.slice(0, 4500),
          aspect_ratio: aspectRatio,
          model: IMAGE_MODEL,
          credits_used: creditAmount,
          status: "completed",
        });
        const storagePath = await uploadImageToStorage(buf, workspaceId, projectId, genId, IMAGE_BUCKET);
        await supabase.from("generations").update({ result_url: storagePath }).eq("id", genId);
        const url = await getImageUrl(storagePath, IMAGE_BUCKET);
        totalCreditsUsed += creditAmount;
        await deductCredits(workspaceId, user.id, creditAmount, `Full Campaign: ${taskId} (retry)`);
        sendSSE(res, { task: taskId, status: "complete", result_url: url, credits_used: creditAmount, time_taken: 0, generation_id: genId });
        return { task: taskId, url, generationId: genId, storagePath };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { task: taskId, error: msg };
      }
    }

    const imgCr = fc.perImage;
    const imgSz = fc.imageSize;
    const feed1 = runOneImageTask("meta_feed_image_1", feed1Prompt, "4:5", imgCr, imgSz, true);
    const feed2 = runOneImageTask("meta_feed_image_2", feed2Prompt, "4:5", imgCr, imgSz, true);
    const feed3 = runOneImageTask("meta_feed_image_3", feed3Prompt, "4:5", imgCr, imgSz, true);
    const story1 = runOneImageTask("story_image_1", story1Prompt, "9:16", imgCr, imgSz, true);
    const story2 = runOneImageTask("story_image_2", story2Prompt, "9:16", imgCr, imgSz, true);
    const story3 = runOneImageTask("story_image_3", story3Prompt, "9:16", imgCr, imgSz, true);

    const videoVeo = imageOutput!.video_veo;
    const negativePrompt = typeof videoVeo.negative_prompt === "string" && videoVeo.negative_prompt.trim() ? videoVeo.negative_prompt.trim() : undefined;

    const MAX_VIDEO_ATTEMPTS = 2;
    const videoModelKeys = { "video_16x9": "standard" as const, "video_9x16": "fast" as const };
    async function runCampaignVideoTask(
      taskId: "video_16x9" | "video_9x16",
      referenceImageUrl: string | undefined,
      prompt: string,
      modelId: string,
      aspectRatio: "16:9" | "9:16",
      resolution: "1080p" | "720p" | "4k",
      creditAmount: number
    ): Promise<TaskResult> {
      sendSSE(res, { task: taskId, status: "in_progress" });
      const start = Date.now();
      let imageForVeo: { imageBytes: string; mimeType: string } | undefined;
      let withoutReferenceImage = false;
      if (referenceImageUrl) {
        const fetched = await fetchImageAsBase64(referenceImageUrl);
        if (fetched) {
          imageForVeo = { imageBytes: fetched.data, mimeType: fetched.mimeType === "image/webp" ? "image/jpeg" : fetched.mimeType };
        } else {
          withoutReferenceImage = true;
        }
      } else {
        withoutReferenceImage = true;
      }
      if (withoutReferenceImage) {
        sendSSE(res, { task: taskId, note: "Generated without reference image" });
      }

      const { data: videoRow, error: insertErr } = await supabase
        .from("video_generations")
        .insert({
          workspace_id: workspaceId,
          project_id: projectId,
          user_id: user.id,
          prompt,
          model: modelId,
          status: "processing",
          credits_used: creditAmount,
          duration_seconds: VIDEO_INITIAL_SECONDS,
          aspect_ratio: aspectRatio,
          resolution,
        })
        .select("id")
        .single();
      if (insertErr || !videoRow) {
        const msg = "Failed to create video generation row";
        sendSSE(res, { task: taskId, status: "failed", error: msg });
        return { task: taskId, error: msg };
      }
      const generationId = videoRow.id;
      console.log("[Campaign]", taskId, "started, id:", generationId);

      const is503 = (e: Error | null) => e && (/503|service unavailable/i.test(e.message) || (e as { status?: number }).status === 503);
      const modelKey = videoModelKeys[taskId];
      let lastVideoErr: Error | null = null;
      for (let attempt = 1; attempt <= MAX_VIDEO_ATTEMPTS; attempt++) {
        const useModelId = attempt === 1 ? modelId : VIDEO_MODELS[VIDEO_MODEL_FALLBACK[modelKey]];
        if (attempt === 2) console.log("[Campaign]", taskId, "retry with fallback model:", useModelId);
        try {
          const operation = await gemini.models.generateVideos({
            model: useModelId,
            prompt,
            ...(imageForVeo && { image: imageForVeo }),
            config: {
              aspectRatio,
              resolution,
              durationSeconds: VIDEO_INITIAL_SECONDS,
              ...(negativePrompt && { negativePrompt }),
            },
          });
          const operationName = operation?.name;
          if (!operationName) {
            await supabase.from("video_generations").update({ status: "failed", error_message: "No operation returned" }).eq("id", generationId);
            throw new Error("No operation returned from Veo");
          }
          await supabase.from("video_generations").update({ operation_name: operationName }).eq("id", generationId);
          const result = await pollVideoUntilDone(operationName, generationId, workspaceId, projectId);
          if (result.error || !result.videoUrl) throw new Error(result.error || "Video generation failed");
          totalCreditsUsed += creditAmount;
          await deductCredits(workspaceId, user.id, creditAmount, `Full Campaign: ${taskId} (${modelId})`);
          await supabase.from("audit_events").insert({
            workspace_id: workspaceId,
            user_id: user.id,
            action: "video_generation.completed",
            resource_type: "video_generation",
            resource_id: generationId,
            metadata: { prompt: prompt.slice(0, 200), model: modelId, campaign: true },
          });
          const elapsed = (Date.now() - start) / 1000;
          console.log("[Campaign]", taskId, "complete in", elapsed, "s");
          const videoStoragePath = `${workspaceId}/${projectId}/${videoRow.id}.mp4`;
          sendSSE(res, { task: taskId, status: "complete", result_url: result.videoUrl, credits_used: creditAmount, time_taken: elapsed, video_generation_id: videoRow.id, ...(withoutReferenceImage && { note: "Generated without reference image" }) });
          return { task: taskId, url: result.videoUrl, videoGenerationId: videoRow.id, videoStoragePath };
        } catch (err) {
          lastVideoErr = err instanceof Error ? err : new Error(String(err));
          const retryOnce = attempt < MAX_VIDEO_ATTEMPTS && is503(lastVideoErr);
          if (retryOnce) {
            await supabase.from("video_generations").update({ status: "processing", error_message: null, operation_name: null }).eq("id", generationId);
          } else {
            await supabase.from("video_generations").update({ status: "failed", error_message: lastVideoErr.message }).eq("id", generationId);
            console.error("[Campaign]", taskId, "failed after", MAX_VIDEO_ATTEMPTS, "attempts:", lastVideoErr.message);
            sendSSE(res, { task: taskId, status: "failed", error: lastVideoErr.message });
            return { task: taskId, error: lastVideoErr.message };
          }
        }
      }
      const msg = lastVideoErr?.message ?? "Video generation failed";
      sendSSE(res, { task: taskId, status: "failed", error: msg });
      return { task: taskId, error: msg };
    }

    const never = new Promise<TaskResult>(() => {});
    const firstFeedPromise = Promise.race([
      feed1.then((r) => (r?.url ? r : never)),
      feed2.then((r) => (r?.url ? r : never)),
      feed3.then((r) => (r?.url ? r : never)),
      Promise.allSettled([feed1, feed2, feed3]).then((results) => {
        const v = results.find((r): r is PromiseFulfilledResult<TaskResult> => r.status === "fulfilled" && !!(r as PromiseFulfilledResult<TaskResult>).value?.url);
        return (v && (v as PromiseFulfilledResult<TaskResult>).value) ?? null;
      }),
    ]).then((r) => (r ?? null));
    const firstStoryPromise = Promise.race([
      story1.then((r) => (r?.url ? r : never)),
      story2.then((r) => (r?.url ? r : never)),
      story3.then((r) => (r?.url ? r : never)),
      Promise.allSettled([story1, story2, story3]).then((results) => {
        const v = results.find((r): r is PromiseFulfilledResult<TaskResult> => r.status === "fulfilled" && !!(r as PromiseFulfilledResult<TaskResult>).value?.url);
        return (v && (v as PromiseFulfilledResult<TaskResult>).value) ?? null;
      }),
    ]).then((r) => (r ?? null));
    const vCr = fc.perVideo;
    const video16x9Promise = firstFeedPromise.then((r) =>
      runCampaignVideoTask(
        "video_16x9",
        r?.url,
        videoVeo.prompt_16x9,
        VIDEO_MODELS.standard,
        "16:9",
        fc.videoRes169,
        vCr
      )
    );
    const video9x16Promise = firstStoryPromise.then((r) =>
      runCampaignVideoTask(
        "video_9x16",
        r?.url,
        videoVeo.prompt_9x16,
        VIDEO_MODELS.fast,
        "9:16",
        fc.videoRes916,
        vCr
      )
    );

    const imageResults = await Promise.allSettled([feed1, feed2, feed3, story1, story2, story3]);
    let imageSettled = imageResults.map((r) => (r.status === "fulfilled" ? r.value : { task: "unknown", error: String((r as PromiseRejectedResult).reason) }));

    const imageTaskParams: Record<string, { prompt: string; aspectRatio: AspectRatio; includeLogo: boolean }> = {
      meta_feed_image_1: { prompt: feed1Prompt, aspectRatio: "4:5", includeLogo: true },
      meta_feed_image_2: { prompt: feed2Prompt, aspectRatio: "4:5", includeLogo: true },
      meta_feed_image_3: { prompt: feed3Prompt, aspectRatio: "4:5", includeLogo: true },
      story_image_1: { prompt: story1Prompt, aspectRatio: "9:16", includeLogo: true },
      story_image_2: { prompt: story2Prompt, aspectRatio: "9:16", includeLogo: true },
      story_image_3: { prompt: story3Prompt, aspectRatio: "9:16", includeLogo: true },
    };
    const failedImageTasks = imageSettled.filter((r) => r.error && imageTaskParams[r.task]);
    if (failedImageTasks.length > 0) {
      console.log("[Campaign] Waiting 60s before retrying", failedImageTasks.length, "failed image(s)");
      sendSSE(res, { task: "image_retry", status: "in_progress", note: `Retrying ${failedImageTasks.length} failed image(s) in 1 minute` });
      await new Promise((r) => setTimeout(r, 60_000));
      const retryResults = await Promise.all(
        failedImageTasks.map((f) => {
          const p = imageTaskParams[f.task]!;
          return runOneImageTaskSingleAttempt(f.task, p.prompt, p.aspectRatio, imgCr, imgSz, p.includeLogo);
        })
      );
      for (const ret of retryResults) {
        if (!ret.error) {
          imageSettled = imageSettled.map((r) => (r.task === ret.task ? ret : r));
        }
      }
    }

    const feedResults = ["meta_feed_image_1", "meta_feed_image_2", "meta_feed_image_3"].map((t) => imageSettled.find((r) => r.task === t));
    const storyResults = ["story_image_1", "story_image_2", "story_image_3"].map((t) => imageSettled.find((r) => r.task === t));
    const firstFeedUrl = feedResults.map((r) => r?.url).find((u): u is string => !!u);
    const firstStoryUrl = storyResults.map((r) => r?.url).find((u): u is string => !!u);
    const firstFeedPath = feedResults.map((r) => r?.storagePath).find((p): p is string => !!p);
    const firstStoryPath = storyResults.map((r) => r?.storagePath).find((p): p is string => !!p);
    const feedUrls = feedResults.map((r) => r?.url ?? firstFeedUrl ?? null);
    const storyUrls = storyResults.map((r) => r?.url ?? firstStoryUrl ?? null);
    const feedPaths = feedResults.map((r) => r?.storagePath ?? firstFeedPath ?? null);
    const storyPaths = storyResults.map((r) => r?.storagePath ?? firstStoryPath ?? null);

    /* ── Step 3: Two email HTML variants (runs as soon as images are ready, in parallel with videos) ─── */
    const MAX_EMAIL_ATTEMPTS = 4;
    const emailResultPromise = (async (): Promise<{ emailHtml: string; emailHtmls: string[]; emailCopies: Record<string, string>[] }> => {
      const successFeed = feedUrls.filter((u): u is string => !!u);
      const successStory = storyUrls.filter((u): u is string => !!u);
      const emailImageCombos: [string, string, string][] = [
        [successFeed[0] ?? "", successStory[0] ?? "", successFeed[1] ?? successFeed[0] ?? ""],
        [successFeed[1] ?? successFeed[0] ?? "", successStory[1] ?? successStory[0] ?? "", successFeed[2] ?? successFeed[0] ?? ""],
      ];
      const comboIndices = [0, 1];
      for (let i = comboIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [comboIndices[i], comboIndices[j]] = [comboIndices[j]!, comboIndices[i]!];
      }
      const emailVariants = [contentOutput.email_1, contentOutput.email_2];
      const defaultResult = {
        emailHtml: "",
        emailHtmls: [] as string[],
        emailCopies: [] as Record<string, string>[],
      };
      for (let attempt = 1; attempt <= MAX_EMAIL_ATTEMPTS; attempt++) {
        sendSSE(res, { task: "email_html", status: "in_progress" });
        const emailHtmls: string[] = [];
        const emailCopies: Record<string, string>[] = [];
        try {
          for (let i = 0; i < 2; i++) {
            const variant = emailVariants[i]!;
            const htmlTemplate = variant.html_template;
            if (!htmlTemplate) throw new Error(`Claude did not return html_template for email_${i + 1}`);
            const combo = emailImageCombos[comboIndices[i]!]!;
            const { html, valid, errors } = assembleEmailHtml(htmlTemplate, combo, brandWebsite, socialLinks);
            emailHtmls.push(html);
            emailCopies.push({
              subject_line: variant.subject_line,
              preview_text: variant.preview_text,
              headline: variant.headline,
              subheadline: variant.subheadline,
              cta_primary: variant.cta_primary,
              footer_tagline: variant.footer_tagline,
            });
            if (!valid && i === 0) console.warn("[Campaign] Email HTML validation warnings:", errors);
          }
          const emailHtml = emailHtmls[0] ?? "";
          console.log("[Campaign] 2 email HTML variants assembled");
          totalCreditsUsed += fc.emailBundle;
          await deductCredits(
            workspaceId,
            user.id,
            fc.emailBundle,
            `Full Campaign: 2 marketing emails (${campaignQuality})`
          );
          sendSSE(res, {
            task: "email_html", status: "complete",
            credits_used: fc.emailBundle,
            time_taken: 0,
            email_html: emailHtml,
            email_htmls: emailHtmls,
            email_copy: emailCopies[0],
            email_copies: emailCopies,
          });
          return { emailHtml, emailHtmls, emailCopies };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (attempt === MAX_EMAIL_ATTEMPTS) {
            console.error("[Campaign] Email HTML assembly failed after", MAX_EMAIL_ATTEMPTS, "attempts:", msg);
            const fallback = contentOutput.email_1 ?? (contentOutput as { email?: CampaignEmail }).email;
            sendSSE(res, {
              task: "email_html", status: "failed", error: msg,
              email_copy: fallback ? { subject_line: fallback.subject_line, preview_text: fallback.preview_text, headline: fallback.headline, subheadline: fallback.subheadline, cta_primary: fallback.cta_primary, footer_tagline: fallback.footer_tagline } : undefined,
            });
            return defaultResult;
          }
        }
      }
      return defaultResult;
    })();

    const [video16x9Result, video9x16Result, emailResult] = await Promise.all([video16x9Promise, video9x16Promise, emailResultPromise]);
    const { emailHtml, emailHtmls, emailCopies } = emailResult;
    const settled = [...imageSettled, video16x9Result, video9x16Result];

    /* ── Merge Claude outputs for storage ──────────────────────────────── */

    const mergedClaudeOutput = {
      ...imageOutput,
      ...contentOutput,
    };

    /* ── Save campaign session ─────────────────────────────────────────── */

    try {
      await supabase.from("campaign_sessions").insert({
        id: campaignId,
        workspace_id: workspaceId,
        project_id: projectId,
        user_id: user.id,
        campaign_goal: campaignGoal,
        platforms_selected: platforms,
        claude_output: mergedClaudeOutput,
        asset_urls: {
          meta_image_urls: feedUrls,
          story_image_urls: storyUrls,
          video_16x9: video16x9Result.error ? null : video16x9Result.url ?? null,
          video_9x16: video9x16Result.error ? null : video9x16Result.url ?? null,
          email_html: emailHtml || null,
          email_htmls: emailHtmls.length >= 2 ? emailHtmls : [emailHtml || "", emailHtml || ""],
          email_copies: emailCopies.length >= 2 ? emailCopies : [emailCopies[0] ?? {}, emailCopies[0] ?? {}],
          meta_image_paths: feedPaths,
          story_image_paths: storyPaths,
          video_16x9_path: video16x9Result.error ? null : video16x9Result.videoStoragePath ?? null,
          video_9x16_path: video9x16Result.error ? null : video9x16Result.videoStoragePath ?? null,
        },
        credits_used: totalCreditsUsed,
        status: settled.some((r) => r.error) ? "partial" : "complete",
      });
      console.log("[Campaign] Session saved:", campaignId);
    } catch (err) {
      console.error("[Campaign] Failed to save campaign session:", err);
    }

    /* ── Audit event ───────────────────────────────────────────────────── */

    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: "campaign.completed",
      resource_type: "campaign_session",
      resource_id: campaignId,
      metadata: {
        campaign_goal: campaignGoal,
        platforms,
        credits_used: totalCreditsUsed,
        tasks_completed: settled.filter((r) => !r.error).length,
        tasks_failed: settled.filter((r) => r.error).length,
      },
    });

    /* ── Auto-save successful assets to workspace asset collection ─────── */

    const imageGenIds = imageSettled.filter((r): r is TaskResult & { generationId: string } => !r.error && !!r.generationId).map((r) => r.generationId);
    const video16x9GenId = video16x9Result.error ? undefined : video16x9Result.videoGenerationId;
    const video9x16GenId = video9x16Result.error ? undefined : video9x16Result.videoGenerationId;
    for (const genId of imageGenIds) {
      const { error: insertErr } = await supabase.from("workspace_asset_collection").insert({
        workspace_id: workspaceId,
        generation_id: genId,
      });
      if (insertErr && insertErr.code !== "23505") console.error("[Campaign] Asset collection insert image:", insertErr);
    }
    for (const videoGenId of [video16x9GenId, video9x16GenId].filter(Boolean)) {
      if (!videoGenId) continue;
      const { error: insertErr } = await supabase.from("workspace_asset_collection").insert({
        workspace_id: workspaceId,
        video_generation_id: videoGenId,
      });
      if (insertErr && insertErr.code !== "23505") console.error("[Campaign] Asset collection insert video:", insertErr);
    }

    /* ── Final SSE event ───────────────────────────────────────────────── */

    sendSSE(res, {
      task: "campaign_complete",
      status: settled.some((r) => r.error) ? "partial" : "complete",
      campaign_id: campaignId,
      total_credits_used: totalCreditsUsed,
    });

    console.log("[Campaign] Complete. Total credits used:", totalCreditsUsed);
    res.end();
  }
);

export default router;

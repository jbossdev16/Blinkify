import crypto from "node:crypto";
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";
import {
  gemini,
  extractGeminiErrorMessage,
  IMAGE_MODEL,
  IMAGE_MODEL_FALLBACK,
  isVertexImageEnabled,
  generateProImage,
  VERTEX_IMAGE_MODEL,
  ASPECT_RATIOS,
  IMAGE_SIZES,
  SYSTEM_INSTRUCTION,
  creditCost,
  emailCreditCost,
  buildProjectInstructions,
  getCarouselSystemBlock,
  CAROUSEL_SLIDE_PROMPT_MAX_LENGTH,
  TEMPERATURE_MIN,
  TEMPERATURE_MAX,
  TEMPERATURE_DEFAULT,
  GENERATION_TIMEOUT_MS,
  enhancePromptForAdCreative,
  generateEmailCopy,
  type AspectRatio,
  type ImageSize,
} from "../lib/gemini.js";
import { isUuid } from "../lib/validation.js";
import {
  SIGNED_URL_EXPIRY_SECONDS,
  EMAIL_ASSETS_BUCKET,
  resolveGenerationImageUrl,
} from "../lib/storage-constants.js";
import { getEmailTemplate, buildTemplateImagePromptSuffix, loadTemplateImage, buildTemplateReplacePrompt } from "../lib/email-templates.js";
import {
  fetchExternalBrandLogoBuffer,
  inferLogoMimeType,
  isExternalBrandLogoRef,
  urlFromExternalBrandLogoRef,
} from "../lib/brand-logo-ref.js";

const router = Router();
const BUCKET = "generated-images";
const PROJECT_ASSETS_BUCKET = "project-assets";

/** Storage path or `external:https://...` from Apply Brand when SVG / upload fallback. */
async function loadProjectBrandLogoForInputs(
  brandLogo: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    if (isExternalBrandLogoRef(brandLogo)) {
      const u = urlFromExternalBrandLogoRef(brandLogo);
      if (!u) return null;
      const got = await fetchExternalBrandLogoBuffer(u);
      if (!got) return null;
      return {
        data: got.buf.toString("base64"),
        mimeType: inferLogoMimeType(got.contentType, u),
      };
    }
    const { data: blob, error: downloadErr } = await supabase.storage
      .from(PROJECT_ASSETS_BUCKET)
      .download(brandLogo);
    if (downloadErr || !blob) return null;
    const buf = Buffer.from(await blob.arrayBuffer());
    const ext = brandLogo.split(".").pop()?.toLowerCase() ?? "png";
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
    };
    return { data: buf.toString("base64"), mimeType: mimeMap[ext] ?? "image/png" };
  } catch {
    return null;
  }
}
const MAX_INPUT_IMAGES = 10;
const MIN_NUMBER_OF_IMAGES = 1;
const MAX_NUMBER_OF_IMAGES = 4;

/* ─── Validation helpers ──────────────────────────────────────────────── */

function isAspectRatio(v: unknown): v is AspectRatio {
  return typeof v === "string" && (ASPECT_RATIOS as readonly string[]).includes(v);
}

function isImageSize(v: unknown): v is ImageSize {
  return typeof v === "string" && (IMAGE_SIZES as readonly string[]).includes(v);
}

function parseNumberOfImages(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < MIN_NUMBER_OF_IMAGES || v > MAX_NUMBER_OF_IMAGES) {
    return 1;
  }
  return v;
}

/** True when we should retry with fallback model (503, 429, timeout, 5xx). Not for 422/401/403. */
function isRetryableImageError(err: unknown, message: string): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 422 || status === 401 || status === 403) return false;
  if (status === 429 || status === 503 || status === 502 || (status != null && status >= 500)) return true;
  if ((err instanceof Error && err.name === "AbortError") || /aborted|AbortError/i.test(message)) return true;
  if (/resource exhausted|high demand|try again later|unavailable|503|429/i.test(message)) return true;
  return false;
}

/* ─── POST /:workspaceId/projects/:projectId/enhance-prompt ──────────────
   Blinkify AI Prompt Generator — free, no credits. Uses Gemini 2.5 Flash.  */

router.post(
  "/:workspaceId/projects/:projectId/enhance-prompt",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      const rawPrompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (!rawPrompt) {
        res.status(400).json({ error: "Prompt is required" });
        return;
      }
      if (rawPrompt.length > 4500) {
        res.status(400).json({ error: "Prompt must be 4500 characters or fewer" });
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
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      const { data: project } = await supabase
        .from("projects")
        .select("name, description, target_audience, brand_colors, brand_fonts, brand_guidelines, font_styles")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();

      const enhancedPrompt = await enhancePromptForAdCreative(rawPrompt, project ?? undefined);
      res.json({ enhancedPrompt });
    } catch (err: unknown) {
      console.error("POST enhance-prompt error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

/* ─── POST /:workspaceId/projects/:projectId/generate ─────────────────── */

router.post(
  "/:workspaceId/projects/:projectId/generate",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      // --- Validate body ---
      const carousel = req.body?.carousel === true;
      const prompt =
        typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";

      const numberOfImages = parseNumberOfImages(req.body?.numberOfImages);

      let slidePrompts: string[] | null = null;
      if (carousel) {
        if (!Array.isArray(req.body?.slidePrompts) || req.body.slidePrompts.length !== numberOfImages) {
          res.status(400).json({
            error: `When carousel is true, slidePrompts must be an array of length ${numberOfImages}.`,
          });
          return;
        }
        const prompts = req.body.slidePrompts
          .filter((p: unknown) => typeof p === "string")
          .map((p: string) => p.trim())
          .filter(Boolean);
        if (prompts.length !== numberOfImages) {
          res.status(400).json({
            error: `Each of the ${numberOfImages} slide descriptions must be a non-empty string.`,
          });
          return;
        }
        for (let idx = 0; idx < prompts.length; idx++) {
          if (prompts[idx].length > CAROUSEL_SLIDE_PROMPT_MAX_LENGTH) {
            res.status(400).json({
              error: `Slide ${idx + 1} description must be ${CAROUSEL_SLIDE_PROMPT_MAX_LENGTH} characters or fewer.`,
            });
            return;
          }
        }
        slidePrompts = prompts;
      } else {
        if (!prompt) {
          res.status(400).json({ error: "Prompt is required" });
          return;
        }
        if (prompt.length > 4500) {
          res.status(400).json({ error: "Prompt must be 4500 characters or fewer" });
          return;
        }
      }

      const aspectRatio: AspectRatio = isAspectRatio(req.body?.aspectRatio)
        ? req.body.aspectRatio
        : "1:1";

      const imageSize: ImageSize = isImageSize(req.body?.imageSize)
        ? req.body.imageSize
        : "1K";

      const rawTemp = req.body?.temperature;
      const temperature =
        typeof rawTemp === "number" && Number.isFinite(rawTemp)
          ? Math.max(TEMPERATURE_MIN, Math.min(TEMPERATURE_MAX, rawTemp))
          : TEMPERATURE_DEFAULT;

      const rawSeed = req.body?.seed;
      const seedFromRequest =
        typeof rawSeed === "number" && Number.isInteger(rawSeed) && rawSeed >= 0
          ? rawSeed
          : undefined;

      // Input images (base64 strings with mimeType)
      let userImages: { data: string; mimeType: string }[] = [];
      if (Array.isArray(req.body?.inputImages)) {
        for (const img of req.body.inputImages.slice(0, MAX_INPUT_IMAGES)) {
          if (
            typeof img?.data === "string" &&
            typeof img?.mimeType === "string" &&
            img.data.length > 0
          ) {
            userImages.push({ data: img.data, mimeType: img.mimeType });
          }
        }
      }

      // --- Auth: check workspace membership ---
      const user = req.user!;

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

      // --- Fetch project (with brand fields and font_styles for project-level instructions) ---
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

      // Optional: edit from a previous generation (reply-to-image)
      const editFromGenerationId =
        typeof req.body?.editFromGenerationId === "string" && isUuid(req.body.editFromGenerationId)
          ? req.body.editFromGenerationId
          : undefined;
      if (editFromGenerationId) {
        const { data: editGen } = await supabase
          .from("generations")
          .select("result_url")
          .eq("id", editFromGenerationId)
          .eq("workspace_id", workspaceId)
          .eq("project_id", projectId)
          .eq("status", "completed")
          .single();
        if (editGen?.result_url) {
          try {
            const { data: blob } = await supabase.storage.from(BUCKET).download(editGen.result_url);
            if (blob) {
              const buf = Buffer.from(await blob.arrayBuffer());
              const base64 = buf.toString("base64");
              userImages = [{ data: base64, mimeType: "image/png" }, ...userImages.slice(0, MAX_INPUT_IMAGES - 1)];
            }
          } catch {
            // ignore
          }
        }
      }

      // --- Check credits ---
      const costPerImage = creditCost(imageSize);
      const totalCost = costPerImage * numberOfImages;

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("credits")
        .eq("id", workspaceId)
        .single();

      if (!workspace || (workspace.credits ?? 0) < totalCost) {
        res.status(402).json({
          error: `Insufficient credits. This generation requires ${totalCost} credit${totalCost > 1 ? "s" : ""} (${numberOfImages} image${numberOfImages > 1 ? "s" : ""}).`,
        });
        return;
      }

      // ─── Prepend project brand logo as first reference image ───────────
      let inputImages = userImages;
      if (project.brand_logo && typeof project.brand_logo === "string") {
        try {
          const logoImage = await loadProjectBrandLogoForInputs(project.brand_logo);
          if (logoImage) {
            inputImages = [logoImage, ...userImages.slice(0, MAX_INPUT_IMAGES - 1)];
          }
        } catch {
          // Logo fetch failed; continue without it
        }
      }

      // ─── Build 3-tier prompt (and per-slide when carousel) ────────────
      const projectInstructions = buildProjectInstructions(project);
      const baseSystemInstruction = SYSTEM_INSTRUCTION + (projectInstructions
        ? `\n\n--- PROJECT INSTRUCTIONS ---\n${projectInstructions}`
        : "");

      const defaultContents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt },
      ];
      for (const img of inputImages) {
        defaultContents.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }

      const batchId = crypto.randomUUID();

      // --- Create N pending generation rows (one per image) ---
      const primaryModel = isVertexImageEnabled() ? VERTEX_IMAGE_MODEL : IMAGE_MODEL;
      const generationRows: { id: string }[] = [];
      for (let i = 0; i < numberOfImages; i++) {
        const rowPrompt = carousel && slidePrompts ? slidePrompts[i]! : prompt;
        const { data: row, error: insertErr } = await supabase
          .from("generations")
          .insert({
            workspace_id: workspaceId,
            project_id: projectId,
            user_id: user.id,
            prompt: rowPrompt,
            aspect_ratio: aspectRatio,
            model: primaryModel,
            credits_used: costPerImage,
            status: "pending",
            batch_id: batchId,
          })
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        generationRows.push(row!);
      }

      // --- Detect client disconnect (cancel) so we don't charge for unfinished batches ---
      let clientCancelled = false;
      const onClientGone = () => {
        clientCancelled = true;
      };
      req.on("close", onClientGone);
      req.on("aborted", onClientGone);

      const imageUrls: string[] = [];
      const seeds = Array.from(
        { length: numberOfImages },
        (_, i) => (i === 0 && seedFromRequest != null ? seedFromRequest : Math.floor(Math.random() * 2 ** 31))
      );
      const firstSeedUsed = seeds[0];

      /** Run one image generation: Vertex 2.5 Flash (default, no priority) → Vertex 3 Pro Image (fallback) → Vertex 2.5 Flash (Priority PayGo). If Vertex disabled: API Nano Banana → API Flash. */
      async function runOneImageGeneration(
        contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
        systemInstruction: string,
        seedUsed: number
      ): Promise<{ imageBuffer: Buffer; partText: string | null; safetyBlocked: boolean }> {
        let imageBuffer: Buffer | null = null;
        let partText: string | null = null;
        let safetyBlocked = false;

        const tryVertex = async (
          vertexModel: string,
          usePriorityPayGo: boolean
        ): Promise<boolean> => {
          try {
            const vertexResult = await generateProImage({
              contents,
              systemInstruction,
              seed: seedUsed,
              aspectRatio,
              imageSize,
              temperature,
              vertexModel,
              usePriorityPayGo,
            });
            if (vertexResult.safetyBlocked) safetyBlocked = true;
            else {
              imageBuffer = vertexResult.imageBuffer;
              partText = vertexResult.partText;
            }
            return true;
          } catch {
            return false;
          }
        };

        const tryApiModel = async (model: string) => {
          const result = await gemini.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              responseModalities: ["TEXT", "IMAGE"],
              temperature,
              seed: seedUsed,
              imageConfig: { aspectRatio, imageSize },
              httpOptions: { timeout: GENERATION_TIMEOUT_MS },
            },
          });
          const parts = result.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            if (part.text) partText = part.text;
            else if (part.inlineData?.data) imageBuffer = Buffer.from(part.inlineData.data, "base64");
          }
          if (result.candidates?.[0]?.finishReason === "SAFETY") safetyBlocked = true;
        };

        try {
          if (isVertexImageEnabled()) {
            const ok =
              (await tryVertex(VERTEX_IMAGE_MODEL, false)) ||
              (await tryVertex(IMAGE_MODEL, false)) ||
              (await tryVertex(VERTEX_IMAGE_MODEL, true));
            if (!ok && imageBuffer === null) {
              throw new Error("All Vertex image attempts failed.");
            }
          } else {
            try {
              await tryApiModel(IMAGE_MODEL);
            } catch (apiErr: unknown) {
              const message = extractGeminiErrorMessage(apiErr, "Gemini API error");
              if (!isRetryableImageError(apiErr, message)) {
                const status = (apiErr as { status?: number })?.status;
                const isAborted =
                  (apiErr instanceof Error && apiErr.name === "AbortError") ||
                  /aborted|AbortError/i.test(message);
                const isOverloaded =
                  status === 503 ||
                  status === 429 ||
                  /high demand|try again later|unavailable|503|429|resource exhausted/i.test(message);
                if (isAborted) throw { status: 499, message: "Request was cancelled or timed out. Please try again." };
                if (isOverloaded) throw { status: 503, message: "AI is at capacity. Please try again in a few minutes." };
                const hint = /api key|quota|permission|unauthorized|403|401/i.test(message)
                  ? " Check GEMINI_API_KEY and Google AI project settings."
                  : "";
                throw { status: 502, message: (message || "Image generation failed") + hint };
              }
              await tryApiModel(IMAGE_MODEL_FALLBACK);
            }
          }
        } catch (err: unknown) {
          const message = extractGeminiErrorMessage(err, "Gemini API error");
          const status = (err as { status?: number })?.status;
          const isAborted =
            (err instanceof Error && err.name === "AbortError") ||
            /aborted|AbortError/i.test(message);
          const isOverloaded =
            status === 503 ||
            status === 429 ||
            /high demand|try again later|unavailable|503|429|resource exhausted/i.test(message);
          if (isAborted) throw { status: 499, message: "Request was cancelled or timed out. Please try again." };
          if (isOverloaded) throw { status: 503, message: "AI is at capacity. Please try again in a few minutes." };
          const hint = /api key|quota|permission|unauthorized|403|401/i.test(message)
            ? " Check GEMINI_API_KEY and Google AI project settings."
            : "";
          throw { status: 502, message: (message || "Image generation failed") + hint };
        }
        if (safetyBlocked) {
          return { imageBuffer: Buffer.alloc(0), partText, safetyBlocked: true };
        }
        if (!imageBuffer) {
          throw {
            status: 502,
            message: "No image returned from model. Try again or a different prompt.",
          };
        }
        return { imageBuffer, partText, safetyBlocked: false };
      }

      const tasks = generationRows.map((generation, i) => {
        const contents =
          carousel && slidePrompts
            ? (() => {
                const slideText = `Slide ${i + 1} of ${numberOfImages}. Content for this slide: ${slidePrompts![i]!}`;
                const out: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: slideText }];
                for (const img of inputImages) {
                  out.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
                }
                return out;
              })()
            : defaultContents;
        const systemInstruction =
          carousel ? baseSystemInstruction + getCarouselSystemBlock(i + 1, numberOfImages) : baseSystemInstruction;
        return runOneImageGeneration(contents, systemInstruction, seeds[i]!);
      });

      let results: Awaited<ReturnType<typeof runOneImageGeneration>>[];
      try {
        results = await Promise.all(tasks);
      } catch (err: unknown) {
        const thrown = err as { status?: number; message?: string };
        await supabase
          .from("generations")
          .update({ status: "failed", error_message: thrown.message ?? "Generation failed" })
          .eq("batch_id", batchId);
        if (typeof thrown.status === "number" && typeof thrown.message === "string") {
          res.status(thrown.status).json({ error: thrown.message });
        } else {
          res.status(502).json({ error: "Image generation failed" });
        }
        return;
      }

      req.off("close", onClientGone);
      req.off("aborted", onClientGone);

      if (clientCancelled) {
        await supabase
          .from("generations")
          .update({ status: "failed", error_message: "Client cancelled" })
          .eq("batch_id", batchId);
        try {
          res.status(499).json({ error: "Request cancelled" });
        } catch {
          // Client already disconnected
        }
        return;
      }

      for (let i = 0; i < numberOfImages; i++) {
        const generation = generationRows[i]!;
        const result = results[i]!;
        if (result.safetyBlocked) {
          await supabase
            .from("generations")
            .update({ status: "failed", error_message: "Content blocked by safety filters" })
            .eq("id", generation.id);
          res.status(422).json({ error: "Content blocked by safety filters" });
          return;
        }
        const storagePath = `${workspaceId}/${projectId}/${generation.id}.png`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, result.imageBuffer, { contentType: "image/png", upsert: false });
        if (uploadErr) {
          console.error("Storage upload error:", uploadErr);
          await supabase
            .from("generations")
            .update({ status: "failed", error_message: "Storage upload failed" })
            .eq("batch_id", batchId);
          res.status(500).json({ error: "Failed to save generated image" });
          return;
        }
        const { error: updateErr } = await supabase
          .from("generations")
          .update({
            status: "completed",
            result_url: storagePath,
            text_response: null,
          })
          .eq("id", generation.id);
        if (updateErr) throw updateErr;
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);
        if (signed?.signedUrl) imageUrls.push(signed.signedUrl);
      }

      const newBalance = Math.max(0, (workspace.credits ?? 0) - totalCost);
      await supabase.from("workspaces").update({ credits: newBalance }).eq("id", workspaceId);
      await supabase.from("credit_transactions").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        type: "generation",
        amount: -totalCost,
        balance_after: newBalance,
        description: `Image generation (${imageSize}, ${numberOfImages} image${numberOfImages > 1 ? "s" : ""}): ${prompt.slice(0, 60)}`,
      });

      const firstRow = generationRows[0]!;
      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        action: "generation.completed",
        resource_type: "generation",
        resource_id: firstRow.id,
        metadata: {
          prompt: prompt.slice(0, 200),
          model: primaryModel,
          imageSize,
          aspectRatio,
          numberOfImages,
          creditCost: totalCost,
        },
      });

      const { data: updatedFirst } = await supabase
        .from("generations")
        .select()
        .eq("id", firstRow.id)
        .single();

      const generationIds = generationRows.map((r) => r.id);
      res.status(201).json({
        generation: updatedFirst ?? { id: firstRow.id },
        generationIds: generationIds.length > 1 ? generationIds : undefined,
        imageUrls,
        imageUrl: imageUrls[0] ?? null,
        creditsRemaining: newBalance,
        seedUsed: firstSeedUsed,
      });
    } catch (err: unknown) {
      console.error("POST generate error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

/* ─── POST /:workspaceId/projects/:projectId/generate-email ─────────────
   Email marketing: copy (subject, headline, intro, closing, CTA) + 1–3 images.
   Body: prompt, aspectRatio ("9:16" | "1:1"), numberOfImages (1|2|3). Charges numberOfImages * costPerImage. */

const EMAIL_ASPECT_RATIOS = ["9:16", "1:1"] as const;
function isEmailAspectRatio(v: unknown): v is "9:16" | "1:1" {
  return typeof v === "string" && EMAIL_ASPECT_RATIOS.includes(v as "9:16" | "1:1");
}

const EMAIL_NUMBER_OF_IMAGES = [1, 2, 3] as const;
function parseEmailNumberOfImages(v: unknown): 1 | 2 | 3 {
  const n = typeof v === "number" && Number.isInteger(v) ? v : parseInt(String(v), 10);
  return (EMAIL_NUMBER_OF_IMAGES as readonly number[]).includes(n) ? (n as 1 | 2 | 3) : 1;
}

/** Signed URL expiry for brand logo in email HTML (7 days). */
const EMAIL_LOGO_SIGNED_EXPIRY_SECONDS = 604800;

router.post(
  "/:workspaceId/projects/:projectId/generate-email",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (!prompt) {
        res.status(400).json({ error: "Prompt is required" });
        return;
      }
      if (prompt.length > 4500) {
        res.status(400).json({ error: "Prompt must be 4500 characters or fewer" });
        return;
      }

      // Email marketing: always 1:1 square (format option removed from UI)
      const aspectRatio: AspectRatio = "1:1";

      const templateId = typeof req.body?.templateId === "string" ? req.body.templateId.trim() || null : null;
      const emailTemplate = templateId ? getEmailTemplate(templateId) : null;

      const numberOfImages = parseEmailNumberOfImages(req.body?.numberOfImages);
      const emailImageSize: ImageSize = isImageSize(req.body?.imageSize) ? req.body.imageSize : "1K";

      const user = req.user!;
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

      const totalCost = emailCreditCost(emailImageSize, numberOfImages);
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("credits")
        .eq("id", workspaceId)
        .single();

      if (!workspace || (workspace.credits ?? 0) < totalCost) {
        res.status(402).json({
          error: `Insufficient credits. This generation requires ${totalCost} credit${totalCost > 1 ? "s" : ""} (${numberOfImages} image${numberOfImages > 1 ? "s" : ""}, ${emailImageSize}).`,
        });
        return;
      }

      // ─── Generate email copy ─────────────────────────────────────────
      let emailCopy: Awaited<ReturnType<typeof generateEmailCopy>>;
      try {
        const templateInput = emailTemplate
          ? { campaign_metadata: emailTemplate.campaign_metadata, sequence_structure: emailTemplate.sequence_structure }
          : null;
        emailCopy = await generateEmailCopy(prompt, project, templateInput);
      } catch (copyErr: unknown) {
        console.error("generateEmailCopy error:", copyErr);
        res.status(502).json({
          error: "Failed to generate email copy. Please try again.",
        });
        return;
      }

      // ─── Build N image prompts (hero + optional second/third). Email images: 1:1 only, ultra-realistic, no repetition. ─────────
      const EMAIL_REALISM_SUFFIX = " Ultra realistic, photorealistic, real-life photography, 8K quality, sharp detail. No fantasy, cartoon, or artificial look — must look like a real photograph.";
      const NO_CTA = " Do not include any buttons, CTAs, or call-to-action elements in the image; the email HTML will add those separately.";
      const templateImage = emailTemplate ? loadTemplateImage(emailTemplate) : null;
      const prompts: string[] = [];
      let heroPrompt: string;
      if (templateImage) {
        heroPrompt = buildTemplateReplacePrompt(emailCopy);
        heroPrompt += NO_CTA + EMAIL_REALISM_SUFFIX;
        if (heroPrompt.length > 4500) heroPrompt = heroPrompt.slice(0, 4500);
      } else {
        const onlyOrFirst = numberOfImages === 1
          ? "This is the only image in the email — make it the single hero that carries the whole message."
          : numberOfImages === 2
            ? "This is the first of two images. Opening/hero visual."
            : "This is the first of three images. Opening hero visual.";
        const heroPromptBase = `Email hero/banner image for this campaign. ${onlyOrFirst} Headline: "${emailCopy.headline}". Mood and message: ${emailCopy.introCopy.slice(0, 300)}. Single strong visual, on-brand, professional. Do not put long text or headlines in the image — the email copy will provide that.${NO_CTA} Conversion-focused, clean composition.${EMAIL_REALISM_SUFFIX}`;
        try {
          heroPrompt = await enhancePromptForAdCreative(heroPromptBase, project) || heroPromptBase;
        } catch {
          heroPrompt = heroPromptBase;
        }
        if (emailTemplate?.image_generation) {
          heroPrompt += buildTemplateImagePromptSuffix(emailTemplate);
        }
        if (heroPrompt.length > 4500) heroPrompt = heroPrompt.slice(0, 4500);
      }
      prompts.push(heroPrompt);
      const moodSnippet = emailCopy.introCopy.slice(0, 200);
      if (numberOfImages >= 2) {
        const secondBase = `This is the second of two images. Must be clearly different from the first — different angle, scene, or detail. Supporting/mid-email visual for the same campaign. Headline: "${emailCopy.headline}". Mood: ${moodSnippet}. No long text.${NO_CTA} Professional, on-brand. Do not repeat or duplicate the first image's composition or subject.${EMAIL_REALISM_SUFFIX}`;
        let secondPrompt: string;
        try {
          secondPrompt = await enhancePromptForAdCreative(secondBase, project) || secondBase;
        } catch {
          secondPrompt = secondBase;
        }
        prompts.push(secondPrompt.slice(0, 4500));
      }
      if (numberOfImages >= 3) {
        const thirdBase = `This is the third of three images. Closing visual — distinct from the first and second. Different angle, scene, or focus. Headline: "${emailCopy.headline}". Mood: ${moodSnippet}. No long text.${NO_CTA} Professional, on-brand. Do not repeat the previous two images.${EMAIL_REALISM_SUFFIX}`;
        let thirdPrompt: string;
        try {
          thirdPrompt = await enhancePromptForAdCreative(thirdBase, project) || thirdBase;
        } catch {
          thirdPrompt = thirdBase;
        }
        prompts.push(thirdPrompt.slice(0, 4500));
      }

      const inputImages: { data: string; mimeType: string }[] = [];
      if (project.brand_logo && typeof project.brand_logo === "string") {
        try {
          const logoImage = await loadProjectBrandLogoForInputs(project.brand_logo);
          if (logoImage) inputImages.push(logoImage);
        } catch {
          // continue without logo
        }
      }

      const projectInstructions = buildProjectInstructions(project);
      const baseSystemInstruction = SYSTEM_INSTRUCTION + (projectInstructions
        ? `\n\n--- PROJECT INSTRUCTIONS ---\n${projectInstructions}`
        : "");

      const emailPrimaryModel = isVertexImageEnabled() ? VERTEX_IMAGE_MODEL : IMAGE_MODEL;
      const emailBaseCredits = Math.floor(totalCost / numberOfImages);
      const emailRemainder = totalCost - emailBaseCredits * numberOfImages;
      const { data: genRows, error: insertErr } = await supabase
        .from("generations")
        .insert(
          Array.from({ length: numberOfImages }, (_, i) => ({
            workspace_id: workspaceId,
            project_id: projectId,
            user_id: user.id,
            prompt,
            aspect_ratio: aspectRatio,
            model: emailPrimaryModel,
            credits_used: emailBaseCredits + (i === 0 ? emailRemainder : 0),
            status: "pending",
          }))
        )
        .select("id");

      if (insertErr) throw insertErr;
      const generationIds = (genRows ?? []).map((r: { id: string }) => r.id);
      if (generationIds.length !== numberOfImages) throw new Error("Failed to create generation rows");

      let clientCancelled = false;
      req.on("close", () => { clientCancelled = true; });
      req.on("aborted", () => { clientCancelled = true; });

      const imageUrls: string[] = [];
      const emailCopyJson = JSON.stringify(emailCopy);

      for (let i = 0; i < numberOfImages; i++) {
        const genId = generationIds[i];
        const textPrompt = prompts[i];
        const defaultContents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
        if (templateImage && i === 0) {
          defaultContents.push({ inlineData: { mimeType: templateImage.mimeType, data: templateImage.data } });
        }
        defaultContents.push({ text: textPrompt });
        for (const img of inputImages) {
          defaultContents.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }

        const seedUsed = Math.floor(Math.random() * 2 ** 31);
        let imageBuffer: Buffer | null = null;
        let safetyBlocked = false;

        const tryVertexEmail = async (
          vertexModel: string,
          usePriorityPayGo: boolean
        ): Promise<boolean> => {
          try {
            const vertexResult = await generateProImage({
              contents: defaultContents,
              systemInstruction: baseSystemInstruction,
              seed: seedUsed,
              aspectRatio,
              imageSize: emailImageSize,
              temperature: TEMPERATURE_DEFAULT,
              vertexModel,
              usePriorityPayGo,
            });
            if (vertexResult.safetyBlocked) safetyBlocked = true;
            else imageBuffer = vertexResult.imageBuffer;
            return true;
          } catch {
            return false;
          }
        };

        const tryApiEmail = async (model: string) => {
          const result = await gemini.models.generateContent({
            model,
            contents: defaultContents,
            config: {
              systemInstruction: baseSystemInstruction,
              responseModalities: ["TEXT", "IMAGE"],
              temperature: TEMPERATURE_DEFAULT,
              seed: seedUsed,
              imageConfig: { aspectRatio, imageSize: emailImageSize },
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
          if (result.candidates?.[0]?.finishReason === "SAFETY") safetyBlocked = true;
        };

        try {
          if (isVertexImageEnabled()) {
            const ok =
              (await tryVertexEmail(VERTEX_IMAGE_MODEL, false)) ||
              (await tryVertexEmail(IMAGE_MODEL, false)) ||
              (await tryVertexEmail(VERTEX_IMAGE_MODEL, true));
            if (!ok && imageBuffer === null) throw new Error("All Vertex image attempts failed.");
          } else {
            try {
              await tryApiEmail(IMAGE_MODEL);
            } catch (apiErr: unknown) {
              const message = extractGeminiErrorMessage(apiErr, "Gemini API error");
              if (!isRetryableImageError(apiErr, message)) {
                await supabase
                  .from("generations")
                  .update({ status: "failed", error_message: message })
                  .eq("id", genId);
                console.error("Gemini generateContent (email) error:", message, apiErr);
                const status = (apiErr as { status?: number })?.status;
                const isAborted =
                  (apiErr instanceof Error && apiErr.name === "AbortError") ||
                  /aborted|AbortError/i.test(message);
                const isOverloaded =
                  status === 503 ||
                  status === 429 ||
                  /high demand|try again later|unavailable|503|429|resource exhausted/i.test(message);
                if (isAborted) {
                  res.status(499).json({ error: "Request was cancelled or timed out. Please try again." });
                  return;
                }
                if (isOverloaded) {
                  res.status(503).json({ error: "AI is at capacity. Please try again in a few minutes." });
                  return;
                }
                res.status(502).json({
                  error: (message || "Image generation failed") + (/api key|quota|403|401/i.test(message) ? " Check GEMINI_API_KEY." : ""),
                });
                return;
              }
              await tryApiEmail(IMAGE_MODEL_FALLBACK);
            }
          }
        } catch (err: unknown) {
          const message = extractGeminiErrorMessage(err, "Gemini API error");
          await supabase
            .from("generations")
            .update({ status: "failed", error_message: message })
            .eq("id", genId);
          console.error("Gemini image generation (email) error:", message, err);
          const status = (err as { status?: number })?.status;
          const isOverloaded =
            status === 503 ||
            status === 429 ||
            /resource exhausted|high demand|try again later|unavailable|503|429/i.test(message);
          if (isOverloaded) {
            res.status(503).json({ error: "AI is at capacity. Please try again in a few minutes." });
          } else {
            res.status(502).json({
              error: (message || "Image generation failed") + (/api key|quota|403|401/i.test(message) ? " Check GEMINI_API_KEY." : ""),
            });
          }
          return;
        }

        if (clientCancelled) {
          await supabase
            .from("generations")
            .update({ status: "failed", error_message: "Client cancelled" })
            .in("id", generationIds);
          try {
            res.status(499).json({ error: "Request cancelled" });
          } catch {
            // client gone
          }
          return;
        }

        if (safetyBlocked) {
          await supabase
            .from("generations")
            .update({ status: "failed", error_message: "Content blocked by safety filters" })
            .eq("id", genId);
          res.status(422).json({ error: "Content blocked by safety filters" });
          return;
        }

        if (!imageBuffer) {
          await supabase
            .from("generations")
            .update({ status: "failed", error_message: "No image in response" })
            .eq("id", genId);
          res.status(502).json({ error: "No image returned. Try again or a different prompt." });
          return;
        }

        const storagePath = `${workspaceId}/${projectId}/${genId}.png`;
        const { error: uploadErr } = await supabase.storage
          .from(EMAIL_ASSETS_BUCKET)
          .upload(storagePath, imageBuffer, { contentType: "image/png", upsert: false });

        if (uploadErr) {
          console.error("Storage upload error:", uploadErr);
          await supabase
            .from("generations")
            .update({ status: "failed", error_message: "Storage upload failed" })
            .eq("id", genId);
          res.status(500).json({ error: "Failed to save generated image" });
          return;
        }

        const resultUrl = `email-assets/${storagePath}`;
        const updatePayload: { status: string; result_url: string; text_response?: string } = {
          status: "completed",
          result_url: resultUrl,
        };
        if (i === 0) updatePayload.text_response = emailCopyJson;
        const { error: updateErr } = await supabase
          .from("generations")
          .update(updatePayload)
          .eq("id", genId);

        if (updateErr) throw updateErr;

        const { data: urlData } = supabase.storage.from(EMAIL_ASSETS_BUCKET).getPublicUrl(storagePath);
        imageUrls.push(urlData.publicUrl);
      }

      const firstId = generationIds[0];
      const newBalance = Math.max(0, (workspace.credits ?? 0) - totalCost);
      await supabase.from("workspaces").update({ credits: newBalance }).eq("id", workspaceId);
      await supabase.from("credit_transactions").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        type: "generation",
        amount: -totalCost,
        balance_after: newBalance,
        description: `Email marketing creative: ${prompt.slice(0, 60)}`,
      });
      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        action: "generation.completed",
        resource_type: "generation",
        resource_id: firstId,
        metadata: { prompt: prompt.slice(0, 200), model: emailPrimaryModel, aspectRatio, creditCost: totalCost, email: true, numberOfImages },
      });

      let brand_logo_url: string | null = null;
      if (project.brand_logo && typeof project.brand_logo === "string") {
        if (isExternalBrandLogoRef(project.brand_logo)) {
          brand_logo_url = urlFromExternalBrandLogoRef(project.brand_logo);
        } else {
          const { data: signed } = await supabase.storage
            .from(PROJECT_ASSETS_BUCKET)
            .createSignedUrl(project.brand_logo, EMAIL_LOGO_SIGNED_EXPIRY_SECONDS);
          brand_logo_url = signed?.signedUrl ?? null;
        }
      }
      const websiteUrl =
        typeof project.website_url === "string" && project.website_url.trim()
          ? project.website_url.trim().slice(0, 2048)
          : null;

      const rawSl = project.social_links as Record<string, unknown> | null;
      const social_links: Record<string, string> = {};
      if (rawSl && typeof rawSl === "object" && !Array.isArray(rawSl)) {
        for (const k of [
          "instagram",
          "tiktok",
          "facebook",
          "x",
          "linkedin",
          "pinterest",
          "youtube",
          "contact_email",
          "address",
        ] as const) {
          const v = rawSl[k];
          if (typeof v === "string" && v.trim()) social_links[k] = v.trim().slice(0, 2048);
        }
      }

      const brandSnapshot = {
        brand_name: typeof project.name === "string" ? project.name : "",
        brand_colors: (project.brand_colors as string[] | null) ?? [],
        font_styles: project.font_styles ?? null,
        brand_logo_url,
        website_url: websiteUrl,
        social_links: Object.keys(social_links).length ? social_links : null,
      };

      const ctaUrl =
        emailCopy.ctaUrl && emailCopy.ctaUrl.trim() && emailCopy.ctaUrl !== "#"
          ? emailCopy.ctaUrl.trim()
          : websiteUrl;

      res.status(201).json({
        generation: { id: firstId },
        generationIds,
        imageUrls,
        numberOfImages,
        subjectLine: emailCopy.subjectLine,
        headline: emailCopy.headline,
        introCopy: emailCopy.introCopy,
        closingCopy: emailCopy.closingCopy,
        ctaText: emailCopy.ctaText,
        ctaUrl,
        brandSnapshot,
      });
    } catch (err: unknown) {
      console.error("POST generate-email error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

/* ─── GET /:workspaceId/projects/:projectId/generations ─────────────── */

router.get(
  "/:workspaceId/projects/:projectId/generations",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
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
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      const { data: rows, error } = await supabase
        .from("generations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Attach URLs: public for email-assets, signed for generated-images
      const withUrls = await Promise.all(
        (rows ?? []).map(async (row) => {
          if (row.status !== "completed" || !row.result_url) {
            return { ...row, imageUrl: null };
          }
          const imageUrl = await resolveGenerationImageUrl(supabase.storage, row.result_url, BUCKET);
          return { ...row, imageUrl };
        })
      );

      res.json({ generations: withUrls });
    } catch (err: unknown) {
      console.error("GET generations error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

export default router;

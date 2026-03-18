import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";
import { GenerateVideosOperation } from "@google/genai";
import { gemini, extractGeminiErrorMessage, enhancePromptForVideo } from "../lib/gemini.js";
import {
  VIDEO_MODELS,
  VIDEO_ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
  VIDEO_INITIAL_SECONDS,
  videoCreditCost,
  extendsNeeded,
  type VideoModelKey,
  type VideoAspectRatio,
  type VideoResolution,
} from "../lib/veo.js";
import { isUuid } from "../lib/validation.js";
import { SIGNED_URL_EXPIRY_SECONDS } from "../lib/storage-constants.js";
import { getPlanConfig } from "../lib/plan-config.js";

const router = Router();
const BUCKET = "generated-videos";

function isVideoModelKey(v: unknown): v is VideoModelKey {
  return v === "standard" || v === "fast";
}

function isVideoAspectRatio(v: unknown): v is VideoAspectRatio {
  return typeof v === "string" && (VIDEO_ASPECT_RATIOS as readonly string[]).includes(v);
}

function isVideoResolution(v: unknown): v is VideoResolution {
  return typeof v === "string" && (VIDEO_RESOLUTIONS as readonly string[]).includes(v);
}

/* ─── POST /:workspaceId/projects/:projectId/enhance-prompt-video ─────────────
   Video prompt enhancer — free, no credits. */

router.post(
  "/:workspaceId/projects/:projectId/enhance-prompt-video",
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

      const { data: wsForPlan } = await supabase
        .from("workspaces")
        .select("plan")
        .eq("id", workspaceId)
        .single();

      if (!getPlanConfig(wsForPlan?.plan ?? "free").videoEnabled) {
        res.status(403).json({ error: "Video generation is not available on your current plan. Upgrade to use this feature." });
        return;
      }

      const { data: project } = await supabase
        .from("projects")
        .select("name, description, target_audience, brand_guidelines")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();

      const enhancedPrompt = await enhancePromptForVideo(rawPrompt, project ?? undefined);
      res.json({ enhancedPrompt });
    } catch (err: unknown) {
      console.error("POST enhance-prompt-video error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

/** Max reference images (Veo 3.1) */
const MAX_REFERENCE_IMAGES = 3;

/* ─── POST /:workspaceId/projects/:projectId/generate-video ───────────────────
   Start a video generation. Returns generationId for polling.
   Body: prompt, model?, aspectRatio?, resolution?, durationSeconds?, generateAudio?,
   negativePrompt?, inputImage? (first frame), inputLastFrame? (last frame),
   referenceImages? (up to 3: [{ data, mimeType }] for style/content). */

router.post(
  "/:workspaceId/projects/:projectId/generate-video",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
        console.warn("POST generate-video 400: Invalid id", { workspaceId, projectId });
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (!prompt) {
        const reason = !req.body ? "no body" : typeof req.body.prompt !== "string" ? "prompt not a string" : "empty prompt";
        console.warn("POST generate-video 400:", reason, "body keys:", req.body ? Object.keys(req.body) : []);
        res.status(400).json({ error: "Prompt is required" });
        return;
      }
      if (prompt.length > 4500) {
        res.status(400).json({ error: "Prompt must be 4500 characters or fewer" });
        return;
      }

      const modelKey: VideoModelKey = isVideoModelKey(req.body?.model) ? req.body.model : "standard";
      const modelId = VIDEO_MODELS[modelKey];
      const aspectRatio: VideoAspectRatio = isVideoAspectRatio(req.body?.aspectRatio)
        ? req.body.aspectRatio
        : "16:9";
      const resolution: VideoResolution = isVideoResolution(req.body?.resolution)
        ? req.body.resolution
        : "1080p";
      const targetDurationSeconds = VIDEO_INITIAL_SECONDS;

      // Optional: image-to-video (first frame)
      let inputImage: { data: string; mimeType: string } | undefined;
      if (req.body?.inputImage && typeof req.body.inputImage?.data === "string" && req.body.inputImage?.mimeType) {
        inputImage = { data: req.body.inputImage.data, mimeType: req.body.inputImage.mimeType };
      }
      // Optional: last frame (only used with first frame for interpolation)
      let inputLastFrame: { data: string; mimeType: string } | undefined;
      if (req.body?.inputLastFrame && typeof req.body.inputLastFrame?.data === "string" && req.body.inputLastFrame?.mimeType) {
        inputLastFrame = { data: req.body.inputLastFrame.data, mimeType: req.body.inputLastFrame.mimeType };
      }

      // Optional: reference images (up to 3, Veo 3.1 only — mutually exclusive with image/lastFrame)
      const referenceImagesRaw = Array.isArray(req.body?.referenceImages) ? req.body.referenceImages : [];
      const referenceImages: { data: string; mimeType: string }[] = referenceImagesRaw
        .slice(0, MAX_REFERENCE_IMAGES)
        .filter((r: unknown) => r && typeof r === "object" && typeof (r as { data?: unknown }).data === "string" && (r as { mimeType?: unknown }).mimeType)
        .map((r: { data: string; mimeType: string }) => ({ data: r.data, mimeType: r.mimeType }));

      // Optional: negative prompt
      const negativePrompt = typeof req.body?.negativePrompt === "string" ? req.body.negativePrompt.trim() : undefined;

      // Optional: prompts for extended segments (when duration > 8s). One per segment 2, 3, 4, ...
      const continuationPromptRaw = typeof req.body?.continuationPrompt === "string" ? req.body.continuationPrompt.trim() : undefined;
      const continuationPrompt = continuationPromptRaw && continuationPromptRaw.length > 0
        ? continuationPromptRaw.length > 2000 ? continuationPromptRaw.slice(0, 2000) : continuationPromptRaw
        : undefined;
      const continuationPromptsRaw = Array.isArray(req.body?.continuationPrompts) ? req.body.continuationPrompts : [];
      const continuationPrompts: string[] = continuationPromptsRaw
        .filter((p: unknown): p is string => typeof p === "string")
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0)
        .map((p: string) => (p.length > 2000 ? p.slice(0, 2000) : p));

      // When referenceImages provided, image/lastFrame are not allowed (API restriction)
      const useReferenceImages = referenceImages.length > 0;
      const useInterpolation = (inputImage || inputLastFrame) && !useReferenceImages;
      if (useReferenceImages) {
        inputImage = undefined;
        inputLastFrame = undefined;
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
        .select("id")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const creditsRequired = videoCreditCost(resolution);
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("credits, plan")
        .eq("id", workspaceId)
        .single();

      if (!getPlanConfig(workspace?.plan ?? "free").videoEnabled) {
        res.status(403).json({ error: "Video generation is not available on your current plan. Upgrade to use this feature." });
        return;
      }

      if (!workspace || (workspace.credits ?? 0) < creditsRequired) {
        res.status(402).json({
          error: `Insufficient credits. This generation requires ${creditsRequired} credit${creditsRequired > 1 ? "s" : ""} (8s video, ${resolution === "4k" ? "4K" : "Standard"}).`,
        });
        return;
      }

      // Input for Veo: either interpolation (image+lastFrame) or reference images
      const imageForVeo: { imageBytes: string; mimeType: string } | undefined = inputImage
        ? { imageBytes: inputImage.data, mimeType: inputImage.mimeType }
        : undefined;
      const lastFrameForVeo: { imageBytes: string; mimeType: string } | undefined = inputLastFrame
        ? { imageBytes: inputLastFrame.data, mimeType: inputLastFrame.mimeType }
        : undefined;
      const referenceImagesForVeo = useReferenceImages
        ? referenceImages.map((r) => ({
            image: { imageBytes: r.data, mimeType: r.mimeType },
            referenceType: "ASSET" as const,
          }))
        : undefined;

      // Veo API supports only 720p and 1080p; map 4k to 1080p to avoid INVALID_ARGUMENT
      const apiResolution = resolution === "4k" ? "1080p" : resolution;

      const insertPayload = {
        workspace_id: workspaceId,
        project_id: projectId,
        user_id: user.id,
        prompt,
        ...(continuationPrompt != null && { continuation_prompt: continuationPrompt }),
        ...(continuationPrompts.length > 0 && { continuation_prompts: continuationPrompts }),
        model: modelId,
        status: "processing",
        credits_used: creditsRequired,
        duration_seconds: targetDurationSeconds,
        aspect_ratio: aspectRatio,
        resolution,
      };
      const result = await supabase
        .from("video_generations")
        .insert(insertPayload)
        .select("id")
        .single();
      const insertErr = result.error;
      const row = result.data;
      if (insertErr) throw insertErr;

      const generationId = row!.id;

      let operation: Awaited<ReturnType<typeof gemini.models.generateVideos>>;
      try {
        operation = await gemini.models.generateVideos({
          model: modelId,
          prompt,
          ...(imageForVeo && { image: imageForVeo }),
          config: {
            aspectRatio,
            resolution: apiResolution,
            durationSeconds: VIDEO_INITIAL_SECONDS,
            ...(lastFrameForVeo && { lastFrame: lastFrameForVeo }),
            ...(referenceImagesForVeo && referenceImagesForVeo.length > 0 && { referenceImages: referenceImagesForVeo }),
            ...(negativePrompt && { negativePrompt }),
          },
        });
      } catch (apiErr: unknown) {
        const errMessage = extractGeminiErrorMessage(apiErr, "Video generation failed to start");
        const errDetail =
          apiErr && typeof apiErr === "object" && "status" in apiErr
            ? String((apiErr as { status?: unknown }).status)
            : undefined;
        await supabase
          .from("video_generations")
          .update({ status: "failed", error_message: errMessage })
          .eq("id", generationId);
        console.error("Veo generateVideos error:", errMessage, errDetail ?? "", apiErr);
        const clientMessage =
          errMessage || "Video generation failed to start";
        const hint =
          /video not returned|no operation|failed to start/i.test(clientMessage)
            ? " Ensure GEMINI_API_KEY is set and Veo is enabled for your Google AI project."
            : "";
        res.status(502).json({
          error: clientMessage + hint,
        });
        return;
      }

      const operationName = operation?.name ?? "";
      if (!operationName) {
        await supabase
          .from("video_generations")
          .update({ status: "failed", error_message: "No operation returned" })
          .eq("id", generationId);
        res.status(502).json({
          error: "No operation returned from Veo. Ensure GEMINI_API_KEY is set and Veo is enabled for your project.",
        });
        return;
      }

      await supabase
        .from("video_generations")
        .update({ operation_name: operationName })
        .eq("id", generationId);

      res.status(202).json({
        generationId,
        operationName,
        status: "processing",
      });
    } catch (err: unknown) {
      console.error("POST generate-video error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

/* ─── PATCH /:workspaceId/projects/:projectId/video-generations/:generationId/cancel ─
   Mark generation as cancelled so it is not charged or delivered after refresh. */

router.patch(
  "/:workspaceId/projects/:projectId/video-generations/:generationId/cancel",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId, generationId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId) || !isUuid(generationId)) {
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
      const { data: gen } = await supabase
        .from("video_generations")
        .select("id, status")
        .eq("id", generationId)
        .eq("project_id", projectId)
        .eq("workspace_id", workspaceId)
        .single();
      if (!gen) {
        res.status(404).json({ error: "Generation not found" });
        return;
      }
      if (gen.status !== "processing" && gen.status !== "pending") {
        res.json({ status: gen.status });
        return;
      }
      const { error: updateErr } = await supabase
        .from("video_generations")
        .update({ status: "cancelled" })
        .eq("id", generationId);
      if (updateErr) {
        console.error("PATCH video-generations cancel error:", updateErr);
        res.status(500).json({ error: "Failed to cancel" });
        return;
      }
      res.json({ status: "cancelled" });
    } catch (err: unknown) {
      console.error("PATCH video-generations cancel error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

/* ─── GET /:workspaceId/projects/:projectId/video-generations/:generationId/status ─
   Poll for status and progress. When done, returns videoUrl. */

router.get(
  "/:workspaceId/projects/:projectId/video-generations/:generationId/status",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId, generationId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId) || !isUuid(generationId)) {
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

      const { data: gen, error: fetchErr } = await supabase
        .from("video_generations")
        .select("*")
        .eq("id", generationId)
        .eq("project_id", projectId)
        .eq("workspace_id", workspaceId)
        .single();

      if (fetchErr || !gen) {
        res.status(404).json({ error: "Generation not found" });
        return;
      }

      if (gen.status === "completed" && gen.storage_path) {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(gen.storage_path, SIGNED_URL_EXPIRY_SECONDS);
        res.json({
          status: "completed",
          videoUrl: signed?.signedUrl ?? null,
          creditsUsed: gen.credits_used,
        });
        return;
      }

      if (gen.status === "failed") {
        res.json({
          status: "failed",
          error: gen.error_message ?? "Generation failed",
        });
        return;
      }

      if (gen.status === "cancelled") {
        res.json({ status: "cancelled" });
        return;
      }

      if (!gen.operation_name) {
        res.json({ status: "processing", progress: 0 });
        return;
      }

      // Poll Gemini operation (need operation instance with name + _fromAPIResponse)
      const operationForPoll = Object.assign(new GenerateVideosOperation(), { name: gen.operation_name });
      let op: Awaited<ReturnType<typeof gemini.operations.getVideosOperation>>;
      try {
        op = await gemini.operations.getVideosOperation({ operation: operationForPoll });
      } catch (apiErr: unknown) {
        const status = apiErr && typeof apiErr === "object" && "status" in apiErr ? (apiErr as { status?: number }).status : undefined;
        const isPermissionOrNotFound = status === 403 || status === 404;
        if (isPermissionOrNotFound) {
          const errMessage =
            "Could not access video operation (permission denied or operation no longer available). " +
            "Ensure GEMINI_API_KEY is the same key used when the generation was started.";
          await supabase
            .from("video_generations")
            .update({ status: "failed", error_message: errMessage })
            .eq("id", generationId);
          res.json({ status: "failed", error: errMessage });
          return;
        }
        console.error("getVideosOperation error:", apiErr);
        res.json({ status: "processing", progress: 50 });
        return;
      }

      const metadata = op.metadata as Record<string, unknown> | undefined;
      const progress = typeof metadata?.progress === "number" ? metadata.progress : undefined;

      if (op.done === true) {
        const { data: genRecheck } = await supabase
          .from("video_generations")
          .select("status")
          .eq("id", generationId)
          .single();
        if (genRecheck?.status === "cancelled") {
          res.json({ status: "cancelled" });
          return;
        }
        if (op.error) {
          const errMsg = typeof op.error === "object" && op.error !== null && "message" in op.error
            ? String((op.error as { message?: unknown }).message)
            : "Video generation failed";
          await supabase
            .from("video_generations")
            .update({ status: "failed", error_message: errMsg })
            .eq("id", generationId);
          res.json({ status: "failed", error: errMsg });
          return;
        }

        const videos = op.response?.generatedVideos;
        const video = videos?.[0]?.video;
        if (!video) {
          const hasResponse = op.response != null;
          const videosLength = Array.isArray(videos) ? videos.length : "not-array";
          console.error(
            "Veo operation done but no video in response:",
            { generationId, hasResponse, generatedVideosLength: videosLength, responseKeys: op.response ? Object.keys(op.response) : [] }
          );
          const errorMessage =
            "No video returned. The model may have blocked the content or failed to generate. Try a different prompt or try again.";
          await supabase
            .from("video_generations")
            .update({ status: "failed", error_message: "No video in response" })
            .eq("id", generationId);
          res.json({ status: "failed", error: errorMessage });
          return;
        }

        let videoBuffer: Buffer | null = null;
        if (video.videoBytes) {
          videoBuffer = Buffer.from(video.videoBytes, "base64");
        } else if (video.uri) {
          try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("GEMINI_API_KEY not set");
            // Files API URIs return JSON metadata; use :download?alt=media for raw bytes
            let fetchUrl = video.uri;
            if (video.uri.includes("generativelanguage.googleapis.com") && video.uri.includes("/files/")) {
              if (!video.uri.includes(":download")) {
                const base = video.uri.replace(/\?.*$/, "");
                fetchUrl = `${base}:download?alt=media`;
              }
              if (!fetchUrl.includes("key=")) {
                fetchUrl += `${fetchUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(apiKey)}`;
              }
            }
            const headers: Record<string, string> = {};
            if (apiKey) headers["x-goog-api-key"] = apiKey;
            const resp = await fetch(fetchUrl, { headers });
            if (resp.ok) {
              const ct = resp.headers.get("content-type") ?? "";
              const arrBuf = await resp.arrayBuffer();
              const buf = Buffer.from(arrBuf);
              // If we got JSON (metadata), the URI was wrong
              if (ct.includes("application/json") || (buf.length > 0 && buf[0] === 0x7b)) {
                console.error("Video URI returned JSON, not raw bytes - wrong endpoint");
              } else {
                videoBuffer = buf;
              }
            } else {
              console.error("Failed to fetch video from URI:", resp.status, resp.statusText);
            }
          } catch (e) {
            console.error("Failed to fetch video from URI:", e);
          }
        }

        if (!videoBuffer || videoBuffer.length === 0) {
          await supabase
            .from("video_generations")
            .update({ status: "failed", error_message: "Could not retrieve video data" })
            .eq("id", generationId);
          res.json({ status: "failed", error: "Could not retrieve video" });
          return;
        }

        const currentExtendIndex = gen.extend_index ?? 0;
        const targetSeconds = gen.duration_seconds ?? VIDEO_INITIAL_SECONDS;
        const needMoreExtends = extendsNeeded(targetSeconds) > currentExtendIndex;

        if (needMoreExtends) {
          // Veo extend only accepts the original Veo-generated video reference ("processed" by Veo).
          // Use the operation response URI directly; re-uploaded or inline bytes are rejected.
          const videoUri = video.uri;
          if (!videoUri) {
            await supabase
              .from("video_generations")
              .update({ status: "failed", error_message: "Extend requires video URI from Veo; only videoBytes returned" })
              .eq("id", generationId);
            res.json({ status: "failed", error: "Video extension failed: no URI in response (extend not available)" });
            return;
          }
          const segmentNumber = currentExtendIndex + 2; // 2, 3, 4, ...
          const noRepeatInstruction = `CRITICAL: Do not repeat any dialogue, lines, or visual content from previous segments. This is segment ${segmentNumber} only.`;
          const promptsArray = Array.isArray(gen.continuation_prompts) ? gen.continuation_prompts : [];
          const segmentPrompt =
            typeof promptsArray[currentExtendIndex] === "string" && promptsArray[currentExtendIndex].trim()
              ? (promptsArray[currentExtendIndex] as string).trim()
              : currentExtendIndex > 0 && typeof promptsArray[promptsArray.length - 1] === "string"
                ? (promptsArray[promptsArray.length - 1] as string).trim()
                : gen.continuation_prompt?.trim() || gen.prompt;
          const extendPrompt = `${noRepeatInstruction} Continue with: ${segmentPrompt}`;
          let extendOp: Awaited<ReturnType<typeof gemini.models.generateVideos>>;
          try {
            // Do not pass mimeType: SDK maps it to "encoding" which Veo rejects (400 INVALID_ARGUMENT).
            extendOp = await gemini.models.generateVideos({
              model: gen.model,
              prompt: extendPrompt,
              video: { uri: videoUri },
              config: {
                aspectRatio: gen.aspect_ratio ?? "16:9",
                resolution: "720p", // Extension only supports 720p per Veo API
              },
            });
          } catch (extendErr) {
            const errMessage = extendErr instanceof Error ? extendErr.message : String(extendErr);
            console.error("Veo extend error:", extendErr);
            await supabase
              .from("video_generations")
              .update({ status: "failed", error_message: errMessage })
              .eq("id", generationId);
            res.json({ status: "failed", error: `Video extension failed: ${errMessage}` });
            return;
          }
          const nextOpName = extendOp?.name ?? "";
          if (!nextOpName) {
            await supabase
              .from("video_generations")
              .update({ status: "failed", error_message: "No extension operation returned" })
              .eq("id", generationId);
            res.json({ status: "failed", error: "Extension failed to start" });
            return;
          }
          await supabase
            .from("video_generations")
            .update({
              operation_name: nextOpName,
              extend_index: currentExtendIndex + 1,
            })
            .eq("id", generationId);
          res.json({
            status: "processing",
            progress: 50,
            message: `Extending video (${VIDEO_INITIAL_SECONDS + (currentExtendIndex + 1) * 7}s)…`,
          });
          return;
        }

        const { data: genBeforeSave } = await supabase
          .from("video_generations")
          .select("status")
          .eq("id", generationId)
          .single();
        if (genBeforeSave?.status === "cancelled") {
          res.json({ status: "cancelled" });
          return;
        }

        const storagePath = `${workspaceId}/${projectId}/${generationId}.mp4`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });

        if (uploadErr) {
          console.error("Video upload error:", uploadErr);
          await supabase
            .from("video_generations")
            .update({ status: "failed", error_message: "Storage upload failed" })
            .eq("id", generationId);
          res.json({ status: "failed", error: "Failed to save video" });
          return;
        }

        const newBalance = Math.max(0, await (async () => {
          const { data: ws } = await supabase.from("workspaces").select("credits").eq("id", workspaceId).single();
          return (ws?.credits ?? 0) - gen.credits_used;
        })());

        await supabase.from("workspaces").update({ credits: newBalance }).eq("id", workspaceId);
        await supabase.from("credit_transactions").insert({
          workspace_id: workspaceId,
          user_id: user.id,
          type: "generation",
          amount: -gen.credits_used,
          balance_after: newBalance,
          description: `Video generation (${gen.model}, ${gen.duration_seconds}s): ${gen.prompt.slice(0, 60)}`,
        });

        await supabase
          .from("video_generations")
          .update({ status: "completed", storage_path: storagePath })
          .eq("id", generationId);

        await supabase.from("audit_events").insert({
          workspace_id: workspaceId,
          user_id: user.id,
          action: "video_generation.completed",
          resource_type: "video_generation",
          resource_id: generationId,
          metadata: { prompt: gen.prompt.slice(0, 200), model: gen.model },
        });

        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

        res.json({
          status: "completed",
          videoUrl: signed?.signedUrl ?? null,
          creditsUsed: gen.credits_used,
          creditsRemaining: newBalance,
        });
        return;
      }

      res.json({
        status: "processing",
        progress: progress ?? undefined,
      });
    } catch (err: unknown) {
      console.error("GET video-generation status error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

/* ─── GET /:workspaceId/projects/:projectId/video-generations ──────────────────
   List video generations for rehydration (signed URLs). */

router.get(
  "/:workspaceId/projects/:projectId/video-generations",
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
        .from("video_generations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const withUrls = await Promise.all(
        (rows ?? []).map(async (r) => {
          if (r.status !== "completed" || !r.storage_path) {
            return { ...r, videoUrl: null };
          }
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(r.storage_path, SIGNED_URL_EXPIRY_SECONDS);
          return { ...r, videoUrl: signed?.signedUrl ?? null };
        })
      );

      res.json({ videoGenerations: withUrls });
    } catch (err: unknown) {
      console.error("GET video-generations error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

export default router;

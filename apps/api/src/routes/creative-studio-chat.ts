import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";
import { chatForCreativeStudio } from "../lib/gemini.js";
import { isUuid } from "../lib/validation.js";

const router = Router();

/* ─── POST /:workspaceId/projects/:projectId/creative-studio-chat ────────
   Text chat / intent detection. Free — credits are only charged when the
   frontend calls a generation endpoint (image, video, email). */

router.post(
  "/:workspaceId/projects/:projectId/creative-studio-chat",
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
      if (prompt.length > 4000) {
        res.status(400).json({ error: "Prompt must be 4000 characters or fewer" });
        return;
      }
      const likedSnippets = Array.isArray(req.body?.likedSnippets)
        ? (req.body.likedSnippets as string[]).filter((s): s is string => typeof s === "string").slice(0, 10)
        : [];
      const dislikedSnippets = Array.isArray(req.body?.dislikedSnippets)
        ? (req.body.dislikedSnippets as string[]).filter((s): s is string => typeof s === "string").slice(0, 10)
        : [];

      const replyTo =
        req.body?.replyTo &&
        typeof req.body.replyTo === "object" &&
        typeof (req.body.replyTo as { assistantContent?: unknown }).assistantContent === "string"
          ? {
              assistantContent: (req.body.replyTo as { assistantContent: string }).assistantContent,
              hasImage: Boolean((req.body.replyTo as { hasImage?: boolean }).hasImage),
              hasVideo: Boolean((req.body.replyTo as { hasVideo?: boolean }).hasVideo),
              originalPrompt:
                typeof (req.body.replyTo as { originalPrompt?: unknown }).originalPrompt === "string"
                  ? (req.body.replyTo as { originalPrompt: string }).originalPrompt.trim().slice(0, 1000)
                  : undefined,
            }
          : undefined;

      const MAX_ATTACHED_IMAGES = 4;
      const MAX_IMAGE_BASE64_LEN = 8 * 1024 * 1024; // ~6MB decoded
      let attachedImages: { data: string; mimeType: string }[] = [];
      if (Array.isArray(req.body?.attachedImages)) {
        attachedImages = (req.body.attachedImages as { data?: unknown; mimeType?: unknown }[])
          .filter(
            (x): x is { data: string; mimeType: string } =>
              typeof x?.data === "string" &&
              typeof x?.mimeType === "string" &&
              /^image\/(jpeg|png|gif|webp)$/i.test(x.mimeType) &&
              x.data.length <= MAX_IMAGE_BASE64_LEN
          )
          .slice(0, MAX_ATTACHED_IMAGES)
          .map((x) => ({ data: x.data, mimeType: x.mimeType }));
      }

      const user = (req as Request & { user: { id: string } }).user;
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
        .select("name, description, target_audience, brand_guidelines")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();

      const { content, intent } = await chatForCreativeStudio(
        prompt,
        project ?? undefined,
        { likedSnippets, dislikedSnippets },
        replyTo,
        attachedImages.length > 0 ? attachedImages : undefined
      );

      res.json({ content, intent });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const is503 =
        message.includes("503") ||
        message.includes("UNAVAILABLE") ||
        /service is currently unavailable|temporarily unavailable/i.test(message);
      console.error("POST creative-studio-chat error:", err);
      if (is503) {
        res.status(503).json({
          error:
            "AI is temporarily unavailable. Please select Image, Video, or Email above and try again.",
        });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

export default router;

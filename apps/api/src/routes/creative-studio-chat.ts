import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";
import { chatForCreativeStudio } from "../lib/gemini.js";
import { isUuid } from "../lib/validation.js";

const router = Router();

const CHAT_CREDIT_COST = 1;

/* ─── POST /:workspaceId/projects/:projectId/creative-studio-chat ────────
   Text-only chat when no tool is selected. Costs 1 credit per message. */

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

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("credits")
        .eq("id", workspaceId)
        .single();

      if (!workspace || (workspace.credits ?? 0) < CHAT_CREDIT_COST) {
        res.status(402).json({
          error: `Insufficient credits. Chat costs ${CHAT_CREDIT_COST} credit per message.`,
        });
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
        replyTo
      );

      const newBalance = Math.max(0, (workspace.credits ?? 0) - CHAT_CREDIT_COST);
      await supabase.from("workspaces").update({ credits: newBalance }).eq("id", workspaceId);
      await supabase.from("credit_transactions").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        type: "chat",
        amount: -CHAT_CREDIT_COST,
        balance_after: newBalance,
        description: "Creative Studio chat (no tool)",
      });

      res.json({ content, intent });
    } catch (err: unknown) {
      console.error("POST creative-studio-chat error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

export default router;

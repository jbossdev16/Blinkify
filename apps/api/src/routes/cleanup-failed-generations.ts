import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";
import { isUuid } from "../lib/validation.js";
import { runCleanupFailedGenerations } from "../lib/cleanup-failed-generations.js";

const router = Router();

/**
 * POST /workspaces/:workspaceId/cleanup-failed-generations
 * Deletes all failed generations and video_generations for the workspace.
 * Requires workspace membership.
 */
router.post(
  "/:workspaceId/cleanup-failed-generations",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      if (!isUuid(workspaceId)) {
        res.status(400).json({ error: "Invalid workspace id" });
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

      const result = await runCleanupFailedGenerations(workspaceId);
      res.json(result);
    } catch (err: unknown) {
      console.error("cleanup-failed-generations error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

export default router;

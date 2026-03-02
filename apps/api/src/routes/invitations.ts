import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";
import { normalizeEmail } from "../lib/validation.js";

const router = Router();

/**
 * POST /invitations/accept
 * Body: { token: string }
 * Accepts a workspace invitation. Caller must be logged in; invitation.email
 * must match the current user's email (case-insensitive).
 */
router.post(
  "/accept",
  requireAuth,
  requireCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const token =
        typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!token) {
        res.status(400).json({ error: "Token is required" });
        return;
      }

      const user = (req as Request & { user: { id: string; email?: string | null } })
        .user;
      const userEmail = user.email ? normalizeEmail(user.email) : "";

      if (!userEmail) {
        res.status(400).json({
          error: "Your account has no email; cannot accept this invitation",
        });
        return;
      }

      const { data: invitation, error: invError } = await supabase
        .from("workspace_invitations")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .single();

      if (invError || !invitation) {
        res.status(404).json({
          error: "Invitation not found or already used",
        });
        return;
      }

      const expiresAt = new Date(invitation.expires_at);
      if (expiresAt < new Date()) {
        await supabase
          .from("workspace_invitations")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", invitation.id);
        res.status(410).json({ error: "Invitation has expired" });
        return;
      }

      const inviteEmail = normalizeEmail(invitation.email);
      if (inviteEmail !== userEmail) {
        res.status(403).json({
          error: "This invitation was sent to a different email address",
        });
        return;
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: invitation.role,
        });

      if (memberError) {
        if (memberError.code === "23505") {
          res.status(409).json({
            error: "You are already a member of this workspace",
          });
          return;
        }
        throw memberError;
      }

      // Mark invitation accepted
      await supabase
        .from("workspace_invitations")
        .update({
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      // Audit log
      await supabase.from("audit_events").insert({
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        action: "member.joined",
        resource_type: "invitation",
        resource_id: invitation.id,
        metadata: { email: invitation.email, role: invitation.role },
      });

      res.status(200).json({
        workspaceId: invitation.workspace_id,
        role: invitation.role,
      });
    } catch (err: unknown) {
      console.error("POST /invitations/accept error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

export default router;

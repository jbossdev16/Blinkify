import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { ensureWorkspace } from "../services/workspace.js";
import { supabase } from "../lib/supabase.js";
import { sendInvitationEmail } from "../services/email.js";
import {
  isUuid,
  isEmail,
  normalizeEmail,
  isInviteRole,
  INVITE_ROLES,
} from "../lib/validation.js";
import crypto from "crypto";

const router = Router();

const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const defaultOrigin = allowedOrigins[0] ?? "http://localhost:3000";

function getOriginForRequest(req: Request): string {
  const origin = req.get("Origin");
  if (origin && allowedOrigins.includes(origin)) return origin;
  return defaultOrigin;
}

// ─── POST /workspaces/init ───────────────────────────────────────────────────
// Called on first login (or every login). Ensures user + workspace exist.
// Idempotent. Does not use requireCurrentUser because user may not exist yet.

router.post("/init", requireAuth, async (req: Request, res: Response) => {
  try {
    const payload = req.auth?.payload;
    if (!payload?.sub) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const result = await ensureWorkspace({
      authProviderId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
      avatarUrl: typeof payload.picture === "string" ? payload.picture : undefined,
      workspaceName:
        typeof req.body?.workspaceName === "string"
          ? req.body.workspaceName.trim()
          : undefined,
    });

    res.status(result.created ? 201 : 200).json({
      user: result.user,
      workspace: result.workspace,
      created: result.created,
    });
  } catch (err: unknown) {
    console.error("POST /workspaces/init error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

// ─── GET /workspaces ─────────────────────────────────────────────────────────
// List all workspaces the current user is a member of.
// If the user has none, ensure one is created (idempotent).

router.get(
  "/",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const user = (req as Request & { user: { id: string; email?: string | null; name?: string | null } }).user;

      let { data: memberships, error } = await supabase
        .from("workspace_members")
        .select("role, workspaces(*)")
        .eq("user_id", user.id);

      if (error) throw error;

      type MembershipRow = { role: string; workspaces: Record<string, unknown> };
      let rows = (memberships ?? []) as unknown as MembershipRow[];
      let workspaces = rows
        .map((m) => ({ ...m.workspaces, role: m.role }))
        .filter((w) => (w as { deleted_at?: string | null }).deleted_at === null);

      // User exists but has no workspace (e.g. init failed or data gap) — ensure one
      if (workspaces.length === 0) {
        const payload = req.auth?.payload;
        await ensureWorkspace({
          authProviderId: payload?.sub ?? "",
          email: typeof payload?.email === "string" ? payload.email : user.email ?? undefined,
          name: typeof payload?.name === "string" ? payload.name : user.name ?? undefined,
          avatarUrl: typeof payload?.picture === "string" ? payload.picture : undefined,
        });
        const retry = await supabase
          .from("workspace_members")
          .select("role, workspaces(*)")
          .eq("user_id", user.id);
        if (retry.error) throw retry.error;
        rows = (retry.data ?? []) as unknown as MembershipRow[];
        workspaces = rows
          .map((m) => ({ ...m.workspaces, role: m.role }))
          .filter((w) => (w as { deleted_at?: string | null }).deleted_at === null);
      }

      res.json({ workspaces });
    } catch (err: unknown) {
      console.error("GET /workspaces error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── POST /workspaces/:id/invite ─────────────────────────────────────────────
// Invite a user to a workspace by email. Owner/admin only.

router.post(
  "/:id/invite",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.id;
      if (!isUuid(workspaceId)) {
        res.status(400).json({ error: "Invalid workspace id" });
        return;
      }

      const rawEmail =
        typeof req.body?.email === "string" ? req.body.email : "";
      const email = normalizeEmail(rawEmail);
      if (!rawEmail.trim()) {
        res.status(400).json({ error: "Email is required" });
        return;
      }
      if (!isEmail(rawEmail)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }

      const role = typeof req.body?.role === "string" ? req.body.role : "member";
      if (!isInviteRole(role)) {
        res.status(400).json({
          error: `Role must be one of: ${INVITE_ROLES.join(", ")}`,
        });
        return;
      }

      const user = (req as Request & { user: { id: string; name?: string | null; email?: string | null } })
        .user;

      const { data: membership } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        res.status(403).json({
          error: "Only owners and admins can invite members",
        });
        return;
      }

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", workspaceId)
        .single();

      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: invitation, error: inviteError } = await supabase
        .from("workspace_invitations")
        .insert({
          workspace_id: workspaceId,
          invited_by: user.id,
          email,
          role,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (inviteError) {
        if (inviteError.code === "23505") {
          res.status(409).json({
            error: "Invitation already pending for this email",
          });
          return;
        }
        throw inviteError;
      }

      const webOrigin = getOriginForRequest(req);
      const inviteUrl = `${webOrigin}/invite/${token}`;

      const emailResult = await sendInvitationEmail({
        to: email,
        workspaceName: workspace.name,
        inviterName: user.name ?? user.email ?? "A team member",
        role,
        inviteUrl,
      });

      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        action: "member.invited",
        resource_type: "invitation",
        resource_id: invitation.id,
        metadata: { email, role },
      });

      res.status(201).json({
        invitation,
        emailSent: emailResult.success,
        ...(emailResult.success ? {} : { emailError: emailResult.error }),
      });
    } catch (err: unknown) {
      console.error("POST /workspaces/:id/invite error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── GET /workspaces/:id/invitations ─────────────────────────────────────────
// List invitations for a workspace. Owner/admin only.

router.get(
  "/:id/invitations",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.id;
      if (!isUuid(workspaceId)) {
        res.status(400).json({ error: "Invalid workspace id" });
        return;
      }

      const user = (req as Request & { user: { id: string } }).user;

      const { data: membership } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        res.status(403).json({
          error: "Only owners and admins can view invitations",
        });
        return;
      }

      const { data: invitations, error } = await supabase
        .from("workspace_invitations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      res.json({ invitations });
    } catch (err: unknown) {
      console.error("GET /workspaces/:id/invitations error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

export default router;

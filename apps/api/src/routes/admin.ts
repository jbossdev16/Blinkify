import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin.js";
import { supabase } from "../lib/supabase.js";
import { PLAN_CONFIG, VALID_PLANS } from "../lib/plan-config.js";
import { isUuid } from "../lib/validation.js";

const router = Router();

const adminChain = [requireAuth, ensureCurrentUser, requireSuperAdmin];

// ─── GET /admin/workspaces ───────────────────────────────────────────────────
router.get("/workspaces", ...adminChain, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, plan, credits, max_workspaces, slug, created_at, updated_at, deleted_at, owner_id, users!workspaces_owner_id_fkey(email, name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const workspaces = (data ?? []).map((w: any) => ({
      id: w.id,
      name: w.name,
      plan: w.plan,
      credits: w.credits,
      max_workspaces: w.max_workspaces,
      slug: w.slug,
      owner_email: w.users?.email ?? null,
      owner_name: w.users?.name ?? null,
      created_at: w.created_at,
    }));

    res.json({ workspaces });
  } catch (err: unknown) {
    console.error("GET /admin/workspaces error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── PATCH /admin/workspaces/:id/plan ────────────────────────────────────────
router.patch("/workspaces/:id/plan", ...adminChain, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.id;
    if (!isUuid(workspaceId)) {
      res.status(400).json({ error: "Invalid workspace id" });
      return;
    }

    const { plan } = req.body ?? {};
    if (!plan || !VALID_PLANS.includes(plan)) {
      res.status(400).json({ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(", ")}` });
      return;
    }

    const config = PLAN_CONFIG[plan]!;

    const { data: existing, error: fetchErr } = await supabase
      .from("workspaces")
      .select("id, plan, credits")
      .eq("id", workspaceId)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const updates: Record<string, unknown> = {
      plan,
      max_workspaces: config.maxWorkspaces,
      credits: config.maxCredits,
    };

    if (plan !== "trial") {
      updates.trial_ends_at = null;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("workspaces")
      .update(updates)
      .eq("id", workspaceId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    const adminUser = (req as Request & { user: { id: string } }).user;

    // Soft-delete excess brands if the new plan has fewer brand slots.
    // Keeps the oldest N brands (by created_at) and archives the rest.
    const { data: activeProjects } = await supabase
      .from("projects")
      .select("id, created_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (activeProjects && activeProjects.length > config.maxBrands) {
      const toArchive = activeProjects.slice(config.maxBrands).map((p) => p.id);
      await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", toArchive);
    }

    await supabase.from("credit_transactions").insert({
      workspace_id: workspaceId,
      user_id: adminUser.id,
      type: "admin_plan_change",
      amount: config.maxCredits - (existing.credits ?? 0),
      balance_after: config.maxCredits,
      description: `Plan changed from ${existing.plan} to ${plan} by admin`,
    });

    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      user_id: adminUser.id,
      action: "workspace.plan_changed",
      resource_type: "workspace",
      resource_id: workspaceId,
      metadata: {
        from: existing.plan,
        to: plan,
        credits: config.maxCredits,
        brandsArchived: activeProjects && activeProjects.length > config.maxBrands
          ? activeProjects.length - config.maxBrands
          : 0,
      },
    });

    res.json({ workspace: updated });
  } catch (err: unknown) {
    console.error("PATCH /admin/workspaces/:id/plan error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── GET /admin/users ────────────────────────────────────────────────────────
router.get("/users", ...adminChain, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, name, avatar_url, is_super_admin, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ users: data ?? [] });
  } catch (err: unknown) {
    console.error("GET /admin/users error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── GET /admin/plans ────────────────────────────────────────────────────────
router.get("/plans", ...adminChain, async (_req: Request, res: Response) => {
  res.json({ plans: PLAN_CONFIG });
});

export default router;

import { supabase } from "../lib/supabase.js";
import { PLAN_CONFIG } from "../lib/plan-config.js";
import crypto from "crypto";

const FREE_CREDITS = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a URL-safe slug from a name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Extract email prefix before @ */
function emailPrefix(email: string): string {
  return email.split("@")[0] ?? "workspace";
}

// ─── Find or create user ─────────────────────────────────────────────────────

interface FindOrCreateUserParams {
  authProviderId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Find existing user by auth provider ID (Supabase Auth user.id), or create one.
 * Returns the internal user row.
 */
export async function findOrCreateUser(params: FindOrCreateUserParams) {
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("auth_provider_id", params.authProviderId)
    .single();

  if (existing) return { user: existing, created: false };

  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      auth_provider_id: params.authProviderId,
      email: params.email,
      name: params.name,
      avatar_url: params.avatarUrl,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return { user: newUser, created: true };
}

// ─── Create workspace on first login ─────────────────────────────────────────

interface EnsureWorkspaceParams {
  authProviderId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  workspaceName?: string;
}

/**
 * Ensures the user exists and has at least one workspace.
 * Called on first login (or every login — idempotent).
 */
export async function ensureWorkspace(params: EnsureWorkspaceParams) {
  const { user } = await findOrCreateUser({
    authProviderId: params.authProviderId,
    email: params.email,
    name: params.name,
    avatarUrl: params.avatarUrl,
  });

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(*)")
    .eq("user_id", user.id);

  if (memberships && memberships.length > 0) {
    return {
      user,
      workspace: (memberships[0] as { workspaces: unknown }).workspaces,
      created: false,
    };
  }

  const wsName =
    params.workspaceName?.trim() ||
    (params.email ? `${emailPrefix(params.email)}'s Workspace` : "My Workspace");

  const baseSlug = slugify(wsName);
  const slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;

  const maxWorkspaces = PLAN_CONFIG["free"]?.maxWorkspaces ?? 1;

  // Free plan workspace.
  // 100 credits, no expiry.
  // User can generate any mix of 1K images,
  // 4K images, emails, within their credits.
  // No video. No full campaign.
  // Visible locked features prompt upgrade.
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({
      name: wsName,
      owner_id: user.id,
      plan: "free",
      credits: FREE_CREDITS,
      trial_ends_at: null,
      slug,
      max_workspaces: maxWorkspaces,
    })
    .select()
    .single();

  if (wsError) throw new Error(`Failed to create workspace: ${wsError.message}`);

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError)
    throw new Error(`Failed to add workspace member: ${memberError.message}`);

  const { error: creditError } = await supabase
    .from("credit_transactions")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      type: "trial_grant",
      amount: FREE_CREDITS,
      balance_after: FREE_CREDITS,
      description: "Free plan credits",
    });

  if (creditError)
    console.error("Failed to log credit transaction:", creditError.message);

  await supabase.from("audit_events").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    action: "workspace.created",
    resource_type: "workspace",
    resource_id: workspace.id,
    metadata: { plan: "free", credits: FREE_CREDITS },
  });

  return { user, workspace, created: true };
}

// ─── Check workspace creation limit ──────────────────────────────────────────

export async function canCreateWorkspace(userId: string): Promise<boolean> {
  const { data: owned } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(max_workspaces, deleted_at)")
    .eq("user_id", userId)
    .eq("role", "owner");

  if (!owned) return true;

  type OwnedRow = {
    workspaces?: { max_workspaces?: number; deleted_at?: string | null } | null;
  };
  const activeOwned = (owned as OwnedRow[]).filter(
    (m) => m.workspaces?.deleted_at === null
  );

  const maxAllowed =
    activeOwned.length === 0
      ? 1
      : Math.max(
          ...activeOwned.map((m) => m.workspaces?.max_workspaces ?? 1)
        );

  return activeOwned.length < maxAllowed;
}

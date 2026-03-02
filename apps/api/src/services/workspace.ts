import { supabase } from "../lib/supabase.js";
import crypto from "crypto";

// ─── Plan limits ─────────────────────────────────────────────────────────────
// Defines max workspaces per plan. Update here as plans change.
// The API checks this before allowing workspace creation.

const PLAN_MAX_WORKSPACES: Record<string, number> = {
  trial: 1,
  standard: 1,
  pro: 3,
  agency: 5,
  enterprise: 10,
};

const TRIAL_DURATION_DAYS = 7;
const TRIAL_CREDITS = 150;

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
  // Try to find existing user
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("auth_provider_id", params.authProviderId)
    .single();

  if (existing) return { user: existing, created: false };

  // Create new user
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
  workspaceName?: string;  // from onboarding; fallback to email prefix
}

/**
 * Ensures the user exists and has at least one workspace.
 * Called on first login (or every login — idempotent).
 *
 * Flow:
 * 1. Find or create the user row.
 * 2. Check if user already owns a workspace → return it.
 * 3. If not, create a trial workspace + workspace_members + credit transaction.
 */
export async function ensureWorkspace(params: EnsureWorkspaceParams) {
  // 1. Find or create user
  const { user, created: userCreated } = await findOrCreateUser({
    authProviderId: params.authProviderId,
    email: params.email,
    name: params.name,
    avatarUrl: params.avatarUrl,
  });

  // 2. Check for existing workspace membership
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(*)")
    .eq("user_id", user.id);

  if (memberships && memberships.length > 0) {
    return {
      user,
      workspace: (memberships[0] as any).workspaces,
      created: false,
    };
  }

  // 3. Create trial workspace
  const wsName =
    params.workspaceName?.trim() ||
    (params.email ? `${emailPrefix(params.email)}'s Workspace` : "My Workspace");

  const baseSlug = slugify(wsName);
  const slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

  const maxWorkspaces = PLAN_MAX_WORKSPACES["trial"] ?? 1;

  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({
      name: wsName,
      owner_id: user.id,
      plan: "trial",
      credits: TRIAL_CREDITS,
      trial_ends_at: trialEndsAt.toISOString(),
      slug,
      max_workspaces: maxWorkspaces,
    })
    .select()
    .single();

  if (wsError) throw new Error(`Failed to create workspace: ${wsError.message}`);

  // 4. Add user as owner
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError)
    throw new Error(`Failed to add workspace member: ${memberError.message}`);

  // 5. Log initial credit grant
  const { error: creditError } = await supabase
    .from("credit_transactions")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      type: "trial_grant",
      amount: TRIAL_CREDITS,
      balance_after: TRIAL_CREDITS,
      description: "Trial credits granted on signup",
    });

  if (creditError)
    console.error("Failed to log credit transaction:", creditError.message);

  // 6. Audit log
  await supabase.from("audit_events").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    action: "workspace.created",
    resource_type: "workspace",
    resource_id: workspace.id,
    metadata: { plan: "trial", credits: TRIAL_CREDITS },
  });

  return { user, workspace, created: true };
}

// ─── Check workspace creation limit ──────────────────────────────────────────

/**
 * Check if a user can create another workspace based on their current plan.
 * Uses workspaces.max_workspaces from DB (set on create/plan change).
 */
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

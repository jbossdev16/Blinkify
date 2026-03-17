import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { apiFetch, getWorkspaces } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardTheme } from "@/components/dashboard/dashboard-theme";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  let user: { id: string; email?: string | null; user_metadata?: { full_name?: string | null; avatar_url?: string | null } } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    // Supabase unreachable (e.g. network timeout); treat as unauthenticated
  }
  if (!user) {
    redirect("/signin?returnTo=/dashboard");
  }

  let workspace: { plan: string; credits: number } | null = null;
  const [, workspacesResult] = await Promise.allSettled([
    apiFetch("/workspaces/init", { method: "POST" }),
    getWorkspaces(),
  ]);

  if (workspacesResult.status === "fulfilled") {
    const { workspaces } = workspacesResult.value;
    const ws = workspaces?.[0];
    if (ws) workspace = { plan: ws.plan, credits: ws.credits };
  } else {
    const err = workspacesResult.reason as Error & { status?: number };
    if (err?.status === 401 || err?.status === 403) {
      redirect("/signin?returnTo=/dashboard");
    }
  }

  const adminEmails = (process.env.BLINKIFY_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = !!(user.email && adminEmails.includes(user.email.toLowerCase()));

  return (
    <DashboardTheme>
      <DashboardShell
        user={{
          name: user.user_metadata?.full_name ?? null,
          email: user.email ?? null,
          avatar: user.user_metadata?.avatar_url ?? null,
        }}
        plan={workspace?.plan ?? null}
        credits={workspace?.credits ?? null}
        isAdmin={isAdmin}
      >
        {children}
      </DashboardShell>
    </DashboardTheme>
  );
}

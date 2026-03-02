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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?returnTo=/dashboard");
  }

  // Ensure user + workspace exist (idempotent)
  try {
    await apiFetch("/workspaces/init", { method: "POST" });
  } catch {
    // API may be unreachable; pages will handle fallback
  }

  let workspace: { plan: string; credits: number } | null = null;

  try {
    const { workspaces } = await getWorkspaces();
    const ws = workspaces?.[0];
    if (ws) {
      workspace = { plan: ws.plan, credits: ws.credits };
    }
  } catch (err: unknown) {
    const status = (err as Error & { status?: number })?.status;
    if (status === 401 || status === 403) {
      redirect("/signin?returnTo=/dashboard");
    }
    // API unreachable or other error — continue with null; pages show fallback
  }

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
      >
        {children}
      </DashboardShell>
    </DashboardTheme>
  );
}

import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { apiFetch, getWorkspaces, type Project } from "@/lib/api";
import { Layers, Sparkles, Bookmark } from "lucide-react";
import { CreditUsageChart } from "@/components/dashboard/credit-usage-chart";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { AssetCollectionView } from "@/components/dashboard/asset-collection-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { workspaces } = await getWorkspaces();
  const workspace = workspaces?.[0];

  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  let projects: Project[] = [];
  let projectsFetchError = false;
  try {
    if (workspace) {
      const res = await apiFetch<{ projects: Project[] }>(
        `/workspaces/${workspace.id}/projects`
      );
      projects = res.projects;
    }
  } catch {
    projectsFetchError = true;
  }

  const plan = workspace?.plan ?? "trial";
  const credits = workspace?.credits ?? 0;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const updatedRecently = projects.filter(
    (p) => new Date(p.updated_at) >= sevenDaysAgo
  ).length;

  return (
    <div className="p-6 lg:p-10">
      {projectsFetchError && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Unable to load workspace. Please try refreshing.
        </div>
      )}

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Hello,{" "}
          <span className="text-gradient-brand">{firstName}</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          {projects.length > 0
            ? "Here\u2019s an overview of your workspace."
            : "Set up your brand to get started."}
        </p>
      </div>

      {/* ── Top row: Credit (1 col) + Activity (1 col) + Stats stack (1 col) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Credit usage — 1 column */}
        <DashboardCard>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Credit Usage
          </p>
          <CreditUsageChart credits={credits} plan={plan} />
        </DashboardCard>

        {/* Activity — 1 column */}
        <DashboardCard>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Activity
          </p>
          <p className="text-2xl font-bold tracking-tight">{updatedRecently}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {updatedRecently === 1 ? "Brand" : "Brand"} updated in the last 7 days
          </p>
        </DashboardCard>

        {/* Right column: stat cards stacked */}
        <div className="grid grid-rows-2 gap-4">
          <DashboardCard>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4 text-right">
              Brand
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center shrink-0 w-10 h-10">
                <Layers className="size-10 icon-gradient-brand" />
              </div>
              <p className="text-2xl font-bold tracking-tight">
                {projects.length}
              </p>
            </div>
          </DashboardCard>

          <DashboardCard>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4 text-right">
              Current plan
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center shrink-0 w-10 h-10">
                <Sparkles className="size-10 icon-gradient-brand" />
              </div>
              <p className="text-2xl font-bold tracking-tight capitalize">
                {plan}
              </p>
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Asset collection — same look as asset collection page */}
      {workspace && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bookmark className="size-5 text-muted-foreground" />
            Asset collection
          </h2>
          <Suspense fallback={<div className="flex items-center justify-center min-h-[200px] text-muted-foreground">Loading…</div>}>
            <AssetCollectionView workspaceId={workspace.id} embedded />
          </Suspense>
        </section>
      )}
    </div>
  );
}

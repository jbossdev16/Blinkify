import type { Metadata } from "next";
import { Suspense } from "react";
import { apiFetch, getWorkspaces, type Project } from "@/lib/api";
import { NoProjectEmptyState } from "@/components/dashboard/no-project-empty-state";
import { CreativeStudioView } from "@/components/dashboard/creative-studio-view";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creative Studio",
};

export default async function CreativeStudioPage() {
  const { workspaces } = await getWorkspaces();
  const workspace = workspaces?.[0];

  if (!workspace) {
    return (
      <NoProjectEmptyState
        title="Creative Studio"
        description="No workspace found. Please try refreshing."
        ctaHref="/creative-studio"
        ctaLabel="Refresh"
        icon={Sparkles}
      />
    );
  }

  let projects: Project[] = [];
  try {
    const res = await apiFetch<{ projects: Project[] }>(
      `/workspaces/${workspace.id}/projects`
    );
    projects = res.projects ?? [];
  } catch {
    projects = [];
  }

  if (projects.length === 0) {
    return (
      <NoProjectEmptyState
        title="Creative Studio"
        description="Set up your brand first to use Creative Studio."
        ctaHref="/brand"
        ctaLabel="Set up brand"
        icon={Sparkles}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full min-h-screen">
      <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]">Loading…</div>}>
        <CreativeStudioView workspaceId={workspace.id} projects={projects} plan={workspace.plan} />
      </Suspense>
    </div>
  );
}

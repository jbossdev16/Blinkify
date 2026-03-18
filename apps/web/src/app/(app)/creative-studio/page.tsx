import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getWorkspaces, getWorkspaceProjects, type Project, type Workspace } from "@/lib/api";
import { NoProjectEmptyState } from "@/components/dashboard/no-project-empty-state";
import { CreativeStudioView } from "@/components/dashboard/creative-studio-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creative Studio",
};

export default async function CreativeStudioPage() {
  let workspace: Workspace | undefined;
  try {
    const { workspaces } = await getWorkspaces();
    workspace = workspaces?.[0];
  } catch (err: unknown) {
    const status = (err as Error & { status?: number })?.status;
    if (status === 401 || status === 403) {
      redirect("/signin?returnTo=/creative-studio");
    }
    workspace = undefined;
  }

  if (!workspace) {
    return (
      <NoProjectEmptyState
        title="Creative Studio"
        description="No workspace found. Please try refreshing."
        ctaHref="/creative-studio"
        ctaLabel="Refresh"
        iconName="Sparkles"
      />
    );
  }

  let projects: Project[] = [];
  try {
    const res = await getWorkspaceProjects(workspace.id);
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
        iconName="Sparkles"
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

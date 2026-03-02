import { getWorkspaces, apiFetch, getProjectLogoUrl, type Project } from "@/lib/api";
import { redirect } from "next/navigation";
import { CreateProjectFlow } from "@/components/dashboard/create-project-flow";
import { ProjectSettings } from "@/components/dashboard/project-settings";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const { workspaces } = await getWorkspaces();
  const workspace = workspaces?.[0];

  if (!workspace) {
    redirect("/dashboard");
  }

  let projects: Project[] = [];
  try {
    const res = await apiFetch<{ projects: Project[] }>(
      `/workspaces/${workspace.id}/projects`,
      { cache: "no-store" }
    );
    projects = res.projects ?? [];
  } catch {
    // Show create flow on error so user can retry
  }

  // No brand yet: show create flow (same as "New project")
  if (projects.length === 0) {
    return (
      <CreateProjectFlow
        workspaceId={workspace.id}
        redirectToAfterCreate="/dashboard/brand"
      />
    );
  }

  // One brand: show edit Brand page (use first project)
  const project = projects[0];
  const logoUrl = project.brand_logo
    ? await getProjectLogoUrl(workspace.id, project.id)
    : null;

  return (
    <ProjectSettings
      project={project}
      workspaceId={workspace.id}
      logoUrl={logoUrl}
      brandMode
    />
  );
}

import { getWorkspaces, apiFetch, getProjectLogoUrl, type Project } from "@/lib/api";
import { redirect } from "next/navigation";
import { CreateProjectFlow } from "@/components/dashboard/create-project-flow";
import { ProjectSettings } from "@/components/dashboard/project-settings";
import { getPlanFeatures } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface BrandPageProps {
  searchParams: Promise<{ project?: string; new?: string }>;
}

export default async function BrandPage(props: BrandPageProps) {
  const params = await props.searchParams;
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
    // fallback
  }

  const planFeatures = getPlanFeatures(workspace.plan);

  // First brand ever — create a blank project and show card-based brand settings
  if (projects.length === 0) {
    try {
      const { project: newProject } = await apiFetch<{ project: Project }>(
        `/workspaces/${workspace.id}/projects`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "Brand 1",
            description: "New brand",
            brand_colors: [],
            brand_fonts: [],
            brand_logo: null,
            brand_guidelines: null,
          }),
        }
      );
      redirect(`/dashboard/brand?project=${newProject.id}`);
    } catch (err: unknown) {
      if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      return (
        <CreateProjectFlow
          workspaceId={workspace.id}
          redirectToAfterCreate="/dashboard/brand"
        />
      );
    }
  }

  // New brand slot requested — auto-create a blank project and redirect to it
  if (params.new === "1" && projects.length < planFeatures.maxBrands) {
    try {
      const { project: newProject } = await apiFetch<{ project: Project }>(
        `/workspaces/${workspace.id}/projects`,
        {
          method: "POST",
          body: JSON.stringify({
            name: `Brand ${projects.length + 1}`,
            description: "New brand",
            brand_colors: [],
            brand_fonts: [],
            brand_logo: null,
            brand_guidelines: null,
          }),
        }
      );
      redirect(`/dashboard/brand?project=${newProject.id}`);
    } catch (err: unknown) {
      if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      // fall through to show first project
    }
  }

  const selectedProject = params.project
    ? projects.find((p) => p.id === params.project) ?? projects[0]
    : projects[0];

  const logoUrl = selectedProject.brand_logo
    ? await getProjectLogoUrl(workspace.id, selectedProject.id)
    : null;

  return (
    <ProjectSettings
      project={selectedProject}
      workspaceId={workspace.id}
      logoUrl={logoUrl}
      brandMode
    />
  );
}

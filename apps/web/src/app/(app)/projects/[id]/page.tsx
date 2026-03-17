import { apiFetch, getWorkspaces, type Workspace } from "@/lib/api";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProjectPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let workspace: Workspace | undefined;
  try {
    const { workspaces } = await getWorkspaces();
    workspace = workspaces?.[0];
  } catch {
    return notFound();
  }
  if (!workspace) return notFound();

  try {
    await apiFetch<{ project: unknown }>(
      `/workspaces/${workspace.id}/projects/${id}`
    );
  } catch {
    return notFound();
  }

  redirect(`/creative-studio?project=${id}`);
}

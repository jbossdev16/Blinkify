import { apiFetch, getWorkspaces } from "@/lib/api";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProjectPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const { workspaces } = await getWorkspaces();
  const workspace = workspaces?.[0];
  if (!workspace) return notFound();

  try {
    await apiFetch<{ project: unknown }>(
      `/workspaces/${workspace.id}/projects/${id}`
    );
  } catch {
    return notFound();
  }

  redirect(`/dashboard/creative-studio?project=${id}`);
}

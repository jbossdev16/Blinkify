import { Suspense } from "react";
import { getWorkspaces } from "@/lib/api";
import { NoProjectEmptyState } from "@/components/dashboard/no-project-empty-state";
import { AssetCollectionView } from "@/components/dashboard/asset-collection-view";
import { Bookmark } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AssetCollectionPage() {
  let workspace: { id: string } | null = null;
  try {
    const { workspaces } = await getWorkspaces();
    workspace = workspaces?.[0] ?? null;
  } catch {
    // API unreachable or auth issue — show empty state with retry hint
  }

  if (!workspace) {
    return (
      <NoProjectEmptyState
        title="Asset Collection"
        description="No workspace found. Try refreshing the page or go to the dashboard."
        ctaHref="/creative-studio"
        ctaLabel="Go to Dashboard"
        icon={Bookmark}
      />
    );
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]">Loading…</div>}>
      <AssetCollectionView workspaceId={workspace.id} />
    </Suspense>
  );
}

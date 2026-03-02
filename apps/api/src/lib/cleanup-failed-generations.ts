import { supabase } from "./supabase.js";

const IMAGES_BUCKET = "generated-images";
const VIDEOS_BUCKET = "generated-videos";

export interface CleanupResult {
  deletedGenerations: number;
  deletedVideoGenerations: number;
  storageFilesRemoved: number;
}

/**
 * Deletes failed generations and video_generations (and any Storage files).
 * When workspaceId is set, only that workspace; otherwise whole DB.
 */
export async function runCleanupFailedGenerations(
  workspaceId?: string
): Promise<CleanupResult> {
  let storageRemoved = 0;

  // Failed image generations
  let genQuery = supabase
    .from("generations")
    .select("id, result_url")
    .eq("status", "failed");
  if (workspaceId) genQuery = genQuery.eq("workspace_id", workspaceId);

  const { data: failedGens, error: genErr } = await genQuery;
  if (genErr) throw genErr;

  const imagePaths = (failedGens ?? []).map((r) => r.result_url).filter((p): p is string => !!p);
  if (imagePaths.length > 0) {
    const { error: removeErr } = await supabase.storage.from(IMAGES_BUCKET).remove(imagePaths);
    if (!removeErr) storageRemoved += imagePaths.length;
  }

  let deleteGenQuery = supabase.from("generations").delete().eq("status", "failed");
  if (workspaceId) deleteGenQuery = deleteGenQuery.eq("workspace_id", workspaceId);
  const { error: deleteGenErr } = await deleteGenQuery;
  if (deleteGenErr) throw deleteGenErr;
  const deletedGenerations = (failedGens ?? []).length;

  // Failed video generations
  let vidQuery = supabase
    .from("video_generations")
    .select("id, storage_path")
    .eq("status", "failed");
  if (workspaceId) vidQuery = vidQuery.eq("workspace_id", workspaceId);

  const { data: failedVids, error: vidErr } = await vidQuery;
  if (vidErr) throw vidErr;

  const videoPaths = (failedVids ?? []).map((r) => r.storage_path).filter((p): p is string => !!p);
  if (videoPaths.length > 0) {
    const { error: removeErr } = await supabase.storage.from(VIDEOS_BUCKET).remove(videoPaths);
    if (!removeErr) storageRemoved += videoPaths.length;
  }

  let deleteVidQuery = supabase.from("video_generations").delete().eq("status", "failed");
  if (workspaceId) deleteVidQuery = deleteVidQuery.eq("workspace_id", workspaceId);
  const { error: deleteVidErr } = await deleteVidQuery;
  if (deleteVidErr) throw deleteVidErr;
  const deletedVideoGenerations = (failedVids ?? []).length;

  return {
    deletedGenerations,
    deletedVideoGenerations,
    storageFilesRemoved: storageRemoved,
  };
}

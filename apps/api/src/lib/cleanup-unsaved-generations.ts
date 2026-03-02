import { supabase } from "./supabase.js";

const IMAGES_BUCKET = "generated-images";
const VIDEOS_BUCKET = "generated-videos";

/** Remove storage for completed generations older than this (days) if not saved to Asset Collection. */
const RETENTION_DAYS = 7;

export interface CleanupUnsavedResult {
  imageGenerationsCleaned: number;
  videoGenerationsCleaned: number;
  storageFilesRemoved: number;
}

/**
 * Removes storage files for completed image/video generations older than RETENTION_DAYS
 * that are not in workspace_asset_collection. Row is kept with result_url/storage_path set to null.
 * Run periodically (e.g. daily) to reduce Supabase storage usage.
 */
export async function runCleanupUnsavedGenerations(): Promise<CleanupUnsavedResult> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let storageRemoved = 0;

  // ─── Saved IDs (never delete these) ─────────────────────────────────────────
  const { data: savedImageRows, error: savedImageErr } = await supabase
    .from("workspace_asset_collection")
    .select("generation_id")
    .not("generation_id", "is", null);
  if (savedImageErr) throw savedImageErr;
  const savedImageIds = new Set(
    (savedImageRows ?? []).map((r) => r.generation_id).filter((id): id is string => !!id)
  );

  const { data: savedVideoRows, error: savedVideoErr } = await supabase
    .from("workspace_asset_collection")
    .select("video_generation_id")
    .not("video_generation_id", "is", null);
  if (savedVideoErr) throw savedVideoErr;
  const savedVideoIds = new Set(
    (savedVideoRows ?? []).map((r) => r.video_generation_id).filter((id): id is string => !!id)
  );

  // ─── Old completed image generations with result_url ────────────────────────
  const { data: oldGens, error: genErr } = await supabase
    .from("generations")
    .select("id, result_url")
    .eq("status", "completed")
    .not("result_url", "is", null)
    .lt("created_at", cutoff);
  if (genErr) throw genErr;

  const toCleanImages = (oldGens ?? []).filter((g) => !savedImageIds.has(g.id));
  const imagePaths = toCleanImages.map((r) => r.result_url!).filter(Boolean);
  if (imagePaths.length > 0) {
    const { error: removeErr } = await supabase.storage.from(IMAGES_BUCKET).remove(imagePaths);
    if (!removeErr) storageRemoved += imagePaths.length;
    const ids = toCleanImages.map((g) => g.id);
    await supabase.from("generations").update({ result_url: null }).in("id", ids);
  }

  // ─── Old completed video generations with storage_path ──────────────────────
  const { data: oldVids, error: vidErr } = await supabase
    .from("video_generations")
    .select("id, storage_path")
    .eq("status", "completed")
    .not("storage_path", "is", null)
    .lt("created_at", cutoff);
  if (vidErr) throw vidErr;

  const toCleanVideos = (oldVids ?? []).filter((v) => !savedVideoIds.has(v.id));
  const videoPaths = toCleanVideos.map((r) => r.storage_path!).filter(Boolean);
  if (videoPaths.length > 0) {
    const { error: removeErr } = await supabase.storage.from(VIDEOS_BUCKET).remove(videoPaths);
    if (!removeErr) storageRemoved += videoPaths.length;
    const ids = toCleanVideos.map((v) => v.id);
    await supabase.from("video_generations").update({ storage_path: null }).in("id", ids);
  }

  return {
    imageGenerationsCleaned: toCleanImages.length,
    videoGenerationsCleaned: toCleanVideos.length,
    storageFilesRemoved: storageRemoved,
  };
}

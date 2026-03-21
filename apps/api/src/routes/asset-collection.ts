import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";
import { isUuid } from "../lib/validation.js";
import { SIGNED_URL_EXPIRY_SECONDS, resolveGenerationImageUrl } from "../lib/storage-constants.js";

const router = Router();
const IMAGES_BUCKET = "generated-images";
const VIDEOS_BUCKET = "generated-videos";

/** Limits concurrent Storage signed-URL calls to reduce disk / API spikes (Supabase I/O budget). */
const STORAGE_SIGN_CONCURRENCY = 8;

async function mapInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

/* ─── POST /:workspaceId/asset-collection ───────────────────────────────
   Bookmark an image or video to the workspace asset collection. */

router.post(
  "/:workspaceId/asset-collection",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      if (!isUuid(workspaceId)) {
        res.status(400).json({ error: "Invalid workspace id" });
        return;
      }

      const { generationId, videoGenerationId } = req.body as {
        generationId?: string;
        videoGenerationId?: string;
      };
      const hasImage = generationId && isUuid(generationId);
      const hasVideo = videoGenerationId && isUuid(videoGenerationId);

      if (!hasImage && !hasVideo) {
        res.status(400).json({ error: "Provide generationId or videoGenerationId" });
        return;
      }
      if (hasImage && hasVideo) {
        res.status(400).json({ error: "Provide only one of generationId or videoGenerationId" });
        return;
      }

      const user = req.user!;
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      if (hasImage) {
        const { data: gen } = await supabase
          .from("generations")
          .select("id, workspace_id")
          .eq("id", generationId)
          .is("deleted_at", null)
          .single();
        if (!gen || gen.workspace_id !== workspaceId) {
          res.status(404).json({ error: "Generation not found or not in workspace" });
          return;
        }
        const { data: existing } = await supabase
          .from("workspace_asset_collection")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("generation_id", generationId)
          .maybeSingle();
        if (existing) {
          res.status(409).json({ error: "Already in collection", id: existing.id });
          return;
        }
      } else {
        const { data: vid } = await supabase
          .from("video_generations")
          .select("id, workspace_id")
          .eq("id", videoGenerationId)
          .single();
        if (!vid || vid.workspace_id !== workspaceId) {
          res.status(404).json({ error: "Video generation not found or not in workspace" });
          return;
        }
        const { data: existing } = await supabase
          .from("workspace_asset_collection")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("video_generation_id", videoGenerationId)
          .maybeSingle();
        if (existing) {
          res.status(409).json({ error: "Already in collection", id: existing.id });
          return;
        }
      }

      const { data: row, error } = await supabase
        .from("workspace_asset_collection")
        .insert({
          workspace_id: workspaceId,
          ...(hasImage ? { generation_id: generationId } : {}),
          ...(hasVideo ? { video_generation_id: videoGenerationId } : {}),
        })
        .select("id")
        .single();

      if (error) throw error;
      res.status(201).json({ id: row!.id });
    } catch (err: unknown) {
      console.error("POST asset-collection error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

/* ─── GET /:workspaceId/asset-collection ────────────────────────────────
   List bookmarked images and videos with signed URLs. */

router.get(
  "/:workspaceId/asset-collection",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      if (!isUuid(workspaceId)) {
        res.status(400).json({ error: "Invalid workspace id" });
        return;
      }

      const user = req.user!;
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      /** Bookmark IDs only — no joins, no Storage; use for Creative Studio bookmark state. */
      if (String(req.query.mode) === "ids") {
        const { data: idRows, error: idErr } = await supabase
          .from("workspace_asset_collection")
          .select("generation_id, video_generation_id")
          .eq("workspace_id", workspaceId);
        if (idErr) throw idErr;
        const generationIds = (idRows ?? [])
          .map((r) => r.generation_id)
          .filter((id): id is string => id != null);
        const videoGenerationIds = (idRows ?? [])
          .map((r) => r.video_generation_id)
          .filter((id): id is string => id != null);
        res.json({ generationIds, videoGenerationIds });
        return;
      }

      const rawLimit = parseInt(String(req.query.limit ?? "120"), 10);
      const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 120, 1), 250);
      const rawOffset = parseInt(String(req.query.offset ?? "0"), 10);
      const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
      const fetchCount = limit + 1;

      const { data: rows, error } = await supabase
        .from("workspace_asset_collection")
        .select("id, generation_id, video_generation_id, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .range(offset, offset + fetchCount - 1);

      if (error) throw error;

      const hasMore = (rows?.length ?? 0) > limit;
      const itemRows = (rows ?? []).slice(0, limit);
      const genIds = itemRows.map((r) => r.generation_id).filter(Boolean) as string[];
      const vidIds = itemRows.map((r) => r.video_generation_id).filter(Boolean) as string[];

      const [gensRes, vidsRes] = await Promise.all([
        genIds.length > 0
          ? supabase
              .from("generations")
              .select("id, result_url, prompt, project_id, aspect_ratio")
              .in("id", genIds)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] as { id: string; result_url: string | null; prompt: string | null; project_id: string; aspect_ratio: string | null }[], error: null }),
        vidIds.length > 0
          ? supabase
              .from("video_generations")
              .select("id, storage_path, prompt, project_id, aspect_ratio, resolution, duration_seconds, model")
              .in("id", vidIds)
          : Promise.resolve({ data: [] as { id: string; storage_path: string | null; prompt: string | null; project_id: string; aspect_ratio: string | null; resolution: string | null; duration_seconds: number | null; model: string | null }[], error: null }),
      ]);

      if (gensRes.error) throw gensRes.error;
      if (vidsRes.error) throw vidsRes.error;

      const gensMap = new Map(
        (gensRes.data ?? []).map((g) => [g.id, g])
      );
      const vidsMap = new Map(
        (vidsRes.data ?? []).map((v) => [v.id, v])
      );
      const projectIds = [
        ...new Set([
          ...(gensRes.data ?? []).map((g) => g.project_id),
          ...(vidsRes.data ?? []).map((v) => v.project_id),
        ]),
      ];
      const { data: projects } =
        projectIds.length > 0
          ? await supabase.from("projects").select("id, name").in("id", projectIds)
          : { data: [] as { id: string; name: string }[] };
      const projectNames = new Map((projects ?? []).map((p) => [p.id, p.name]));

      const gensWithUrls = (gensRes.data ?? []).filter((g) => g.result_url);
      const imagePairs = await mapInChunks(gensWithUrls, STORAGE_SIGN_CONCURRENCY, async (g) => {
        const url = await resolveGenerationImageUrl(supabase.storage, g.result_url!, IMAGES_BUCKET);
        return [g.id, url] as const;
      });
      const imageUrlMap = new Map(imagePairs);

      const vidsWithPath = (vidsRes.data ?? []).filter((v) => v.storage_path);
      const videoPairs = await mapInChunks(vidsWithPath, STORAGE_SIGN_CONCURRENCY, async (v) => {
        const { data } = await supabase.storage
          .from(VIDEOS_BUCKET)
          .createSignedUrl(v.storage_path!, SIGNED_URL_EXPIRY_SECONDS);
        return [v.id, data?.signedUrl ?? null] as const;
      });
      const videoUrlMap = new Map(videoPairs);

      const items: Array<{
        id: string;
        generationId?: string;
        videoGenerationId?: string;
        type: "image" | "video";
        url: string | null;
        projectId: string;
        projectName: string;
        prompt: string | null;
        createdAt: string;
        metadata?: Record<string, unknown>;
      }> = [];

      for (const row of itemRows) {
        if (row.generation_id) {
          const gen = gensMap.get(row.generation_id);
          const projectName = gen ? (projectNames.get(gen.project_id) ?? "Unknown") : "Unknown";
          const url = imageUrlMap.get(row.generation_id) ?? null;
          const metadata: Record<string, unknown> = {};
          if (gen?.aspect_ratio) metadata.aspectRatio = gen.aspect_ratio;
          items.push({
            id: row.id,
            generationId: row.generation_id,
            type: "image",
            url,
            projectId: gen?.project_id ?? "",
            projectName,
            prompt: gen?.prompt ?? null,
            createdAt: row.created_at,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
        } else if (row.video_generation_id) {
          const vid = vidsMap.get(row.video_generation_id);
          const projectName = vid ? (projectNames.get(vid.project_id) ?? "Unknown") : "Unknown";
          const url = videoUrlMap.get(row.video_generation_id) ?? null;
          const metadata: Record<string, unknown> = {};
          if (vid?.aspect_ratio) metadata.aspectRatio = vid.aspect_ratio;
          if (vid?.resolution) metadata.resolution = vid.resolution;
          if (vid?.duration_seconds != null) metadata.durationSeconds = vid.duration_seconds;
          if (vid?.model) metadata.model = vid.model;
          items.push({
            id: row.id,
            videoGenerationId: row.video_generation_id,
            type: "video",
            url,
            projectId: vid?.project_id ?? "",
            projectName,
            prompt: vid?.prompt ?? null,
            createdAt: row.created_at,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
        }
      }

      res.json({ items, hasMore, limit, offset });
    } catch (err: unknown) {
      console.error("GET asset-collection error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

/* ─── DELETE /:workspaceId/asset-collection/:id ──────────────────────────
   Remove a bookmark. */

router.delete(
  "/:workspaceId/asset-collection/:id",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, id } = req.params;
      if (!isUuid(workspaceId) || !isUuid(id)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      const user = req.user!;
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        res.status(403).json({ error: "Not a workspace member" });
        return;
      }

      const { error } = await supabase
        .from("workspace_asset_collection")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId);

      if (error) throw error;
      res.status(204).send();
    } catch (err: unknown) {
      console.error("DELETE asset-collection error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

export default router;

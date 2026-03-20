import crypto from "node:crypto";
import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";
import { isUuid, isAllowedWebsiteUrl } from "../lib/validation.js";
import { SIGNED_URL_EXPIRY_SECONDS } from "../lib/storage-constants.js";
import { getPlanConfig } from "../lib/plan-config.js";
import { fetchAndParseWebsite, buildCssColors } from "../lib/fetch-website.js";
import { analyzeBrandFromWebsite, BrandAnalysisResult } from "../lib/claude.js";
import type { WebsiteExtract } from "../lib/fetch-website.js";
import { extractGeminiErrorMessage } from "../lib/gemini.js";
import {
  externalBrandLogoRefFromUrl,
  isExternalBrandLogoRef,
  urlFromExternalBrandLogoRef,
} from "../lib/brand-logo-ref.js";

const router = Router();

const BUCKET = "project-assets";
const ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

/** Claude vision rejects or errors on huge payloads; stay under typical limits. */
const LOGO_MAX_BYTES_FOR_CLAUDE = 1_800_000;

const CLAUDE_VISION_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Detect raster format from magic bytes (Content-Type is often wrong for CDNs / favicons). */
function sniffClaudeVisionMime(buf: ArrayBuffer): string | null {
  const u = new Uint8Array(buf.byteLength > 64 ? buf.slice(0, 64) : buf);
  if (u.length < 12) return null;
  if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return "image/png";
  if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "image/jpeg";
  if (u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x38) return "image/gif";
  if (
    u[0] === 0x52 &&
    u[1] === 0x49 &&
    u[2] === 0x46 &&
    u[3] === 0x46 &&
    u[8] === 0x57 &&
    u[9] === 0x45 &&
    u[10] === 0x42 &&
    u[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

const FONT_WEIGHTS = ["light", "normal", "medium", "semibold", "bold"] as const;
const FONT_SIZES = ["small", "medium", "large"] as const;

function validateFontStyles(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  const obj = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ["headline", "cta", "description"]) {
    const el = obj[key];
    if (!el || typeof el !== "object") continue;
    const e = el as Record<string, unknown>;
    const style: Record<string, unknown> = {};
    if (typeof e.weight === "string" && FONT_WEIGHTS.includes(e.weight as (typeof FONT_WEIGHTS)[number])) {
      style.weight = e.weight;
    }
    if (typeof e.color === "string" && /^#[0-9a-fA-F]{6}$/.test(e.color)) {
      style.color = e.color;
    }
    if (typeof e.size === "string" && FONT_SIZES.includes(e.size as (typeof FONT_SIZES)[number])) {
      style.size = e.size;
    }
    if (Object.keys(style).length > 0) out[key] = style;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ─── GET /workspaces/:workspaceId/projects ───────────────────────────────────
// List all active projects for a workspace.

router.get(
  "/:workspaceId/projects",
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

      const { data: projects, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      res.json({ projects: projects ?? [] });
    } catch (err: unknown) {
      console.error("GET /workspaces/:id/projects error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── POST /workspaces/:workspaceId/projects ──────────────────────────────────
// Create a new project in a workspace. Any member can create.

router.post(
  "/:workspaceId/projects",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      if (!isUuid(workspaceId)) {
        res.status(400).json({ error: "Invalid workspace id" });
        return;
      }

      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      if (!name) {
        res.status(400).json({ error: "Project name is required" });
        return;
      }
      if (name.length > 100) {
        res
          .status(400)
          .json({ error: "Project name must be 100 characters or fewer" });
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

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("plan")
        .eq("id", workspaceId)
        .single();

      const planConfig = getPlanConfig(workspace?.plan ?? "free");

      const { count: existingProjects } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null);

      if ((existingProjects ?? 0) >= planConfig.maxBrands) {
        res.status(403).json({
          error: `Brand limit reached. Your ${workspace?.plan ?? "free"} plan allows up to ${planConfig.maxBrands} brand${planConfig.maxBrands > 1 ? "s" : ""}. Upgrade to add more.`,
        });
        return;
      }

      const description =
        typeof req.body?.description === "string"
          ? req.body.description.trim() || null
          : null;

      if (!description) {
        res.status(400).json({ error: "Project description is required" });
        return;
      }

      // Brand fields — only included if migration has been applied
      const brandFields: Record<string, unknown> = {};

      if (Array.isArray(req.body?.brand_colors) && req.body.brand_colors.length > 0) {
        brandFields.brand_colors = req.body.brand_colors.filter(
          (c: unknown) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)
        );
      }

      if (Array.isArray(req.body?.brand_fonts) && req.body.brand_fonts.length > 0) {
        brandFields.brand_fonts = req.body.brand_fonts.filter(
          (f: { name?: string; type?: string }) =>
            typeof f?.name === "string" &&
            (f.type === "preset" || f.type === "custom")
        );
      }

      if (typeof req.body?.brand_logo === "string" && req.body.brand_logo.trim()) {
        brandFields.brand_logo = req.body.brand_logo.trim();
      }

      if (typeof req.body?.brand_guidelines === "string" && req.body.brand_guidelines.trim()) {
        brandFields.brand_guidelines = req.body.brand_guidelines.trim();
      }

      if (req.body?.font_styles !== undefined) {
        const validated = validateFontStyles(req.body.font_styles);
        if (validated) brandFields.font_styles = validated;
      }

      if (req.body?.social_links !== undefined) {
        const sl = req.body.social_links;
        const allowed = [
          "instagram",
          "tiktok",
          "facebook",
          "x",
          "linkedin",
          "pinterest",
          "youtube",
          "contact_email",
          "address",
        ] as const;
        if (sl === null || typeof sl !== "object" || Array.isArray(sl)) {
          brandFields.social_links = {};
        } else {
          const out: Record<string, string> = {};
          for (const k of allowed) {
            const v = (sl as Record<string, unknown>)[k];
            if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 2048);
          }
          brandFields.social_links = out;
        }
      }

      // Try with brand fields first; fall back to base-only if columns don't exist yet
      let project;
      let error;

      if (Object.keys(brandFields).length > 0) {
        const result = await supabase
          .from("projects")
          .insert({ workspace_id: workspaceId, name, description, ...brandFields })
          .select()
          .single();

        if (result.error?.message?.includes("column")) {
          // Brand columns not yet migrated — retry without them
          const fallback = await supabase
            .from("projects")
            .insert({ workspace_id: workspaceId, name, description })
            .select()
            .single();
          project = fallback.data;
          error = fallback.error;
        } else {
          project = result.data;
          error = result.error;
        }
      } else {
        const result = await supabase
          .from("projects")
          .insert({ workspace_id: workspaceId, name, description })
          .select()
          .single();
        project = result.data;
        error = result.error;
      }

      if (error) throw error;

      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        action: "project.created",
        resource_type: "project",
        resource_id: project.id,
        metadata: { name },
      });

      res.status(201).json({ project });
    } catch (err: unknown) {
      console.error("POST /workspaces/:id/projects error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── GET /workspaces/:workspaceId/projects/:projectId ────────────────────────
// Get a single project by ID.

router.get(
  "/:workspaceId/projects/:projectId",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
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

      const { data: project, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();

      if (error || !project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      res.json({ project });
    } catch (err: unknown) {
      console.error("GET /workspaces/:id/projects/:id error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── PUT /workspaces/:workspaceId/projects/:projectId ─────────────────────────
// Update a project (name, description, brand identity).

router.put(
  "/:workspaceId/projects/:projectId",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
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

      // Build update payload — only include provided fields
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (typeof req.body?.name === "string") {
        const name = req.body.name.trim();
        if (!name) {
          res.status(400).json({ error: "Project name cannot be empty" });
          return;
        }
        if (name.length > 100) {
          res.status(400).json({ error: "Project name must be 100 characters or fewer" });
          return;
        }
        updates.name = name;
      }

      if (typeof req.body?.description === "string") {
        updates.description = req.body.description.trim() || null;
      }

      // Brand fields — separated so we can fall back if columns don't exist
      const brandUpdates: Record<string, unknown> = {};

      if (Array.isArray(req.body?.brand_colors)) {
        brandUpdates.brand_colors = req.body.brand_colors.filter(
          (c: unknown) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)
        );
      }

      if (Array.isArray(req.body?.brand_fonts)) {
        brandUpdates.brand_fonts = req.body.brand_fonts.filter(
          (f: { name?: string; type?: string }) =>
            typeof f?.name === "string" &&
            (f.type === "preset" || f.type === "custom")
        );
      }

      if (req.body?.brand_logo !== undefined) {
        brandUpdates.brand_logo =
          typeof req.body.brand_logo === "string"
            ? req.body.brand_logo.trim() || null
            : null;
      }

      if (req.body?.brand_guidelines !== undefined) {
        brandUpdates.brand_guidelines =
          typeof req.body.brand_guidelines === "string"
            ? req.body.brand_guidelines.trim() || null
            : null;
      }

      if (req.body?.font_styles !== undefined) {
        const validated = validateFontStyles(req.body.font_styles);
        brandUpdates.font_styles = validated ?? {};
      }

      if (req.body?.website_url !== undefined) {
        const raw = typeof req.body.website_url === "string" ? req.body.website_url.trim() : "";
        brandUpdates.website_url = raw.length > 0 ? raw.slice(0, 2048) : null;
      }

      if (req.body?.target_audience !== undefined) {
        updates.target_audience =
          typeof req.body.target_audience === "string"
            ? req.body.target_audience.trim().slice(0, 500) || null
            : null;
      }

      if (req.body?.social_links !== undefined) {
        const sl = req.body.social_links;
        const allowed = [
          "instagram",
          "tiktok",
          "facebook",
          "x",
          "linkedin",
          "pinterest",
          "youtube",
          "contact_email",
          "address",
        ] as const;
        if (sl === null || typeof sl !== "object" || Array.isArray(sl)) {
          brandUpdates.social_links = {};
        } else {
          const out: Record<string, string> = {};
          for (const k of allowed) {
            const v = (sl as Record<string, unknown>)[k];
            if (typeof v === "string" && v.trim()) {
              out[k] = v.trim().slice(0, 2048);
            }
          }
          brandUpdates.social_links = out;
        }
      }

      // Try with brand fields; fall back to base-only if columns don't exist yet
      let project;
      let error;

      const fullUpdates = { ...updates, ...brandUpdates };
      const result = await supabase
        .from("projects")
        .update(Object.keys(brandUpdates).length > 0 ? fullUpdates : updates)
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .select()
        .single();

      if (result.error?.message?.includes("column") && Object.keys(brandUpdates).length > 0) {
        // Some brand columns may not exist yet — retry without optional ones
        const { font_styles: _fs, website_url: _wu, social_links: _sl, ...brandWithoutOptional } =
          brandUpdates;
        const fallbackUpdates =
          Object.keys(brandWithoutOptional).length > 0
            ? { ...updates, ...brandWithoutOptional }
            : updates;
        const fallback = await supabase
          .from("projects")
          .update(fallbackUpdates)
          .eq("id", projectId)
          .eq("workspace_id", workspaceId)
          .is("deleted_at", null)
          .select()
          .single();
        project = fallback.data;
        error = fallback.error;
      } else {
        project = result.data;
        error = result.error;
      }

      if (error || !project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        action: "project.updated",
        resource_type: "project",
        resource_id: project.id,
        metadata: { fields: Object.keys(updates).filter((k) => k !== "updated_at") },
      });

      res.json({ project });
    } catch (err: unknown) {
      console.error("PUT /workspaces/:id/projects/:id error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── POST /workspaces/:workspaceId/projects/:projectId/upload-logo ─────────────
// Upload brand logo; updates project.brand_logo with storage path.

router.post(
  "/:workspaceId/projects/:projectId/upload-logo",
  requireAuth,
  ensureCurrentUser,
  upload.single("logo"),
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file?.buffer) {
        res.status(400).json({ error: "No logo file provided" });
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

      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const ext = file.mimetype.split("/")[1] ?? "png";
      const path = `${workspaceId}/${projectId}/logo_${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

      if (uploadErr) {
        console.error("Upload logo error:", uploadErr);
        res.status(500).json({ error: "Failed to upload logo" });
        return;
      }

      const { data: updated, error: updateErr } = await supabase
        .from("projects")
        .update({ brand_logo: path, updated_at: new Date().toISOString() })
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .select()
        .single();

      if (updateErr?.message?.includes("column")) {
        res.json({ brand_logo: path });
        return;
      }
      if (updateErr) throw updateErr;
      res.json({ project: updated, brand_logo: path });
    } catch (err: unknown) {
      console.error("POST upload-logo error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── POST /workspaces/:workspaceId/projects/:projectId/set-logo-from-url ─────
// Download image from URL and set as project brand logo.

const LOGO_FETCH_TIMEOUT_MS = 15_000;
const LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5MB

router.post(
  "/:workspaceId/projects/:projectId/set-logo-from-url",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }
      const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
      if (!url) {
        res.status(400).json({ error: "URL is required" });
        return;
      }
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        res.status(400).json({ error: "URL must be http or https" });
        return;
      }
      if (url.length > 2048) {
        res.status(400).json({ error: "URL too long" });
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

      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LOGO_FETCH_TIMEOUT_MS);
      let fetchRes: globalThis.Response;
      try {
        fetchRes = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; BlinkifyBrandBot/1.0)",
          },
          redirect: "follow",
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!fetchRes.ok) {
        res.status(400).json({ error: "Could not download image from URL" });
        return;
      }
      const buf = Buffer.from(await fetchRes.arrayBuffer());
      if (buf.length > LOGO_MAX_BYTES) {
        res.status(400).json({ error: "Image too large (max 5MB)" });
        return;
      }
      if (buf.length === 0) {
        res.status(400).json({ error: "Empty image" });
        return;
      }

      const headerCt = (fetchRes.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      const headUtf8 = buf.subarray(0, Math.min(512, buf.length)).toString("utf8").trimStart();
      const looksLikeSvg =
        headUtf8.startsWith("<svg") ||
        (headUtf8.startsWith("<?xml") && /<svg[\s>]/i.test(headUtf8)) ||
        /^<!DOCTYPE\s+svg/i.test(headUtf8);
      const urlLooksSvg = /\.svg(\?|$)/i.test(url.split("?")[0] ?? "");
      const isSvg = headerCt.includes("svg") || urlLooksSvg || looksLikeSvg;

      if (!headerCt.startsWith("image/") && !isSvg) {
        res.status(400).json({ error: "URL did not return an image" });
        return;
      }

      let nextBrandLogo: string;
      if (isSvg) {
        // Supabase Storage often disallows image/svg+xml — store canonical URL instead.
        nextBrandLogo = externalBrandLogoRefFromUrl(url);
      } else {
        const storageMime = headerCt || "image/png";
        const ext = headerCt.split("/")[1]?.replace(/[^a-z0-9]/i, "") || "png";
        const path = `${workspaceId}/${projectId}/logo_${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, buf, { contentType: storageMime, upsert: true });
        if (uploadErr) {
          console.warn(
            "[set-logo-from-url] Storage upload failed; saving external logo URL reference instead:",
            uploadErr
          );
          nextBrandLogo = externalBrandLogoRefFromUrl(url);
        } else {
          nextBrandLogo = path;
        }
      }

      const { error: updateErr } = await supabase
        .from("projects")
        .update({ brand_logo: nextBrandLogo, updated_at: new Date().toISOString() })
        .eq("id", projectId)
        .eq("workspace_id", workspaceId);

      if (updateErr) throw updateErr;
      res.json({ brand_logo: nextBrandLogo });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        res.status(408).json({ error: "Request timed out" });
        return;
      }
      console.error("POST set-logo-from-url error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── POST /workspaces/:workspaceId/projects/:projectId/analyze-website ────────
// Fetch URL, parse HTML for meta/body snippet; used for brand import.
const analyzeWebsiteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many requests. Try again in a minute." });
  },
});

router.post(
  "/:workspaceId/projects/:projectId/analyze-website",
  analyzeWebsiteLimiter,
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }
      const url =
        typeof req.body?.url === "string" ? req.body.url.trim() : "";
      if (!url) {
        res.status(400).json({ error: "URL is required" });
        return;
      }
      if (!isAllowedWebsiteUrl(url)) {
        res.status(400).json({
          error: "Invalid URL. Use http or https and a public website.",
        });
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

      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const extract = await fetchAndParseWebsite(url);

      // Brand analysis uses Claude (our best model for brand/website understanding)
      let logoBase64: string | undefined;
      let logoMimeType: string | undefined;
      const primaryVisionUrl =
        (extract.suggestedRasterLogoUrl || "").trim() || extract.suggestedLogoUrl;
      const visionCandidates = [
        ...new Set(
          [primaryVisionUrl, extract.ogImage].filter(
            (u): u is string => typeof u === "string" && u.startsWith("http")
          )
        ),
      ];
      for (const tryUrl of visionCandidates) {
        if (logoBase64) break;
        try {
          const logoRes = await fetch(tryUrl, {
            signal: AbortSignal.timeout(5000),
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; BlinkifyBrandBot/1.0)",
            },
          });
          if (!logoRes.ok) continue;
          const buffer = await logoRes.arrayBuffer();
          if (buffer.byteLength > LOGO_MAX_BYTES_FOR_CLAUDE) {
            console.warn(
              `[ApplyBrand] Logo too large for Claude vision (${buffer.byteLength} bytes); trying next candidate`
            );
            continue;
          }
          const sniffed = sniffClaudeVisionMime(buffer);
          const ct = logoRes.headers.get("content-type") ?? "";
          const headerMime = ct.startsWith("image/") ? ct.split(";")[0]!.trim() : "";
          const mime =
            sniffed ?? (CLAUDE_VISION_MIMES.has(headerMime) ? headerMime : null);
          if (mime && CLAUDE_VISION_MIMES.has(mime)) {
            logoBase64 = Buffer.from(buffer).toString("base64");
            logoMimeType = mime;
            if (sniffed && headerMime && sniffed !== headerMime) {
              console.warn(
                `[ApplyBrand] Logo Content-Type (${headerMime}) did not match bytes (${sniffed}); using sniffed mime for Claude`
              );
            }
            break;
          }
        } catch {
          // try next URL
        }
      }
      if (!logoBase64 && visionCandidates.length > 0) {
        console.warn(
          "[ApplyBrand] No raster image for AI vision (e.g. SVG-only logos). Analysis uses page text/meta; SVG can still be stored when you save."
        );
      }

      const claudeResult = await analyzeBrandFromWebsite(extract, logoBase64, logoMimeType);

      function buildSuggestedColors(extract: WebsiteExtract, claude: BrandAnalysisResult): string[] {
        const colors: string[] = [];
        if (
          claude.suggested_primary_color &&
          /^#[0-9A-Fa-f]{6}$/.test(claude.suggested_primary_color)
        ) {
          colors.push(claude.suggested_primary_color);
        }
        if (
          claude.suggested_secondary_color &&
          /^#[0-9A-Fa-f]{6}$/.test(claude.suggested_secondary_color) &&
          claude.suggested_secondary_color !== claude.suggested_primary_color
        ) {
          colors.push(claude.suggested_secondary_color);
        }
        const cssColors = buildCssColors(extract);
        for (const c of cssColors) {
          if (!colors.includes(c)) colors.push(c);
        }
        return [...new Set(colors)].slice(0, 3);
      }

      const suggestedColors = buildSuggestedColors(extract, claudeResult);
      const defaults = ["#000000", "#666666", "#FFFFFF"];
      const colorsPadded = [...suggestedColors];
      while (colorsPadded.length < 3) colorsPadded.push(defaults[colorsPadded.length] ?? "#000000");
      const finalColors = colorsPadded.slice(0, 3);

      const extractedSiteName = (extract.siteName ?? "").trim();
      const claudeBrand = (claudeResult.brand_name ?? "").trim();
      const brandNameFromAnalysis =
        !claudeBrand
          ? extractedSiteName || "Brand"
          : /^(home|welcome|official website|untitled)$/i.test(claudeBrand) && extractedSiteName
            ? extractedSiteName
            : claudeBrand;

      const suggestions = {
        brand_name: brandNameFromAnalysis.slice(0, 100),
        description: claudeResult.brand_description,
        brand_guidelines: claudeResult.brand_guidelines,
        brand_tone: claudeResult.brand_tone,
        brand_industry: claudeResult.brand_industry,
        target_audience: (claudeResult.target_audience ?? "").slice(0, 200),
        primary_font: (claudeResult.primary_font || extract.primaryFont || "").trim(),
        suggestedColors: finalColors,
        social_links: extract.socialLinks ?? {},
      };

      res.json({ extract, suggestions });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        res.status(408).json({ error: "Request timed out" });
        return;
      }
      console.error("POST analyze-website error:", err);
      const message = extractGeminiErrorMessage(err, "Failed to fetch website");
      res.status(500).json({ error: message });
    }
  }
);

// ─── POST /workspaces/:workspaceId/projects/:projectId/upload-assets ───────────
// Upload one or more assets; inserts project_assets rows.

router.post(
  "/:workspaceId/projects/:projectId/upload-assets",
  requireAuth,
  ensureCurrentUser,
  upload.array("assets", 20),
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }
      const files = (req as Request & { files?: Express.Multer.File[] }).files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        res.status(400).json({ error: "No asset files provided" });
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

      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const inserted: { id: string; file_name: string; file_type: string; file_size: number; storage_path: string }[] = [];

      for (const file of files) {
        if (!file.buffer) continue;
        const ext = file.mimetype.split("/")[1] ?? "bin";
        const safeName = (file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
        const path = `${workspaceId}/${projectId}/${crypto.randomUUID()}_${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

        if (uploadErr) {
          console.error("Upload asset error:", uploadErr);
          continue;
        }

        const { data: row, error: insertErr } = await supabase
          .from("project_assets")
          .insert({
            project_id: projectId,
            workspace_id: workspaceId,
            file_name: file.originalname || safeName,
            file_type: file.mimetype,
            file_size: file.size,
            storage_path: path,
            uploaded_by: user.id,
          })
          .select("id, file_name, file_type, file_size, storage_path")
          .single();

        if (!insertErr && row) inserted.push(row as typeof inserted[0]);
      }

      res.status(201).json({ assets: inserted });
    } catch (err: unknown) {
      console.error("POST upload-assets error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── GET /workspaces/:workspaceId/projects/:projectId/logo-url ──────────────────
// Return a signed URL for the project brand logo (if set).

router.get(
  "/:workspaceId/projects/:projectId/logo-url",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
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

      const { data: project, error } = await supabase
        .from("projects")
        .select("brand_logo")
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .single();

      if (error || !project?.brand_logo) {
        res.json({ url: null });
        return;
      }

      if (isExternalBrandLogoRef(project.brand_logo)) {
        const external = urlFromExternalBrandLogoRef(project.brand_logo);
        res.json({ url: external });
        return;
      }

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(project.brand_logo, SIGNED_URL_EXPIRY_SECONDS);

      res.json({ url: signed?.signedUrl ?? null });
    } catch (err: unknown) {
      console.error("GET logo-url error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── GET /workspaces/:workspaceId/projects/:projectId/assets ───────────────────
// List project assets with signed URLs.

router.get(
  "/:workspaceId/projects/:projectId/assets",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
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

      const { data: rows, error } = await supabase
        .from("project_assets")
        .select("id, file_name, file_type, file_size, storage_path, created_at")
        .eq("project_id", projectId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const withUrls = await Promise.all(
        (rows ?? []).map(async (row) => {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY_SECONDS);
          return { ...row, signed_url: signed?.signedUrl ?? null };
        })
      );

      res.json({ assets: withUrls });
    } catch (err: unknown) {
      console.error("GET assets error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

// ─── DELETE /workspaces/:workspaceId/projects/:projectId ──────────────────────
// Soft-delete a project (sets deleted_at timestamp).

router.delete(
  "/:workspaceId/projects/:projectId",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, projectId } = req.params;
      if (!isUuid(workspaceId) || !isUuid(projectId)) {
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

      const { data: project, error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .select("id, name")
        .single();

      if (error || !project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        action: "project.deleted",
        resource_type: "project",
        resource_id: project.id,
        metadata: { name: project.name },
      });

      res.json({ success: true });
    } catch (err: unknown) {
      console.error("DELETE /workspaces/:id/projects/:id error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  }
);

export default router;

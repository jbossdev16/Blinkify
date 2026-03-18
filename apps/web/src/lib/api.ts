import { cache } from "react";
import { createSupabaseServerClient } from "./supabase-server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

/**
 * Server-side fetch helper for the Blinkify API.
 * Automatically attaches the Supabase session token.
 * Use only in Server Components, Server Actions, or Route Handlers.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = `${API_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token && {
          Authorization: `Bearer ${session.access_token}`,
        }),
        ...init?.headers,
      },
    });
  } catch (err: unknown) {
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string })?.error || `API error ${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  credits: number;
  slug: string | null;
  role: string;
}

export interface BrandFont {
  name: string;
  type: "preset" | "custom";
  url?: string;
}

export interface FontStyleElement {
  weight?: "light" | "normal" | "medium" | "semibold" | "bold";
  color?: string;
  size?: "small" | "medium" | "large";
}

export interface FontStyles {
  headline?: FontStyleElement;
  cta?: FontStyleElement;
  description?: FontStyleElement;
}

export interface ProjectAsset {
  id: string;
  project_id: string;
  workspace_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  signed_url?: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  target_audience: string | null;
  brand_colors: string[];
  brand_fonts: BrandFont[];
  brand_logo: string | null;
  brand_guidelines: string | null;
  font_styles?: FontStyles | null;
  /** Website URL for email marketing (CTA buttons and clickable images). */
  website_url?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Cached fetchers (deduplicated within a single server render) ─────────────

export const getWorkspaces = cache(() =>
  apiFetch<{ workspaces: Workspace[] }>("/workspaces")
);

export const getWorkspaceProjects = cache((workspaceId: string) =>
  apiFetch<{ projects: Project[] }>(`/workspaces/${workspaceId}/projects`)
);

export async function getProjectAssets(
  workspaceId: string,
  projectId: string
): Promise<ProjectAsset[]> {
  const { assets } = await apiFetch<{ assets: ProjectAsset[] }>(
    `/workspaces/${workspaceId}/projects/${projectId}/assets`
  );
  return assets ?? [];
}

export async function getProjectLogoUrl(
  workspaceId: string,
  projectId: string
): Promise<string | null> {
  const { url } = await apiFetch<{ url: string | null }>(
    `/workspaces/${workspaceId}/projects/${projectId}/logo-url`
  );
  return url ?? null;
}

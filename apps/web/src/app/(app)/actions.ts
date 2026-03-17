"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { apiFetch, type Project, type BrandFont, type FontStyles } from "@/lib/api";

export interface CreateProjectPayload {
  name: string;
  description: string;
  target_audience?: string | null;
  brand_colors: string[];
  brand_fonts: BrandFont[];
  brand_logo: string | null;
  brand_guidelines: string | null;
  font_styles?: FontStyles | null;
  website_url?: string | null;
}

export async function createProject(
  workspaceId: string,
  payload: CreateProjectPayload
): Promise<Project> {
  const { project } = await apiFetch<{ project: Project }>(
    `/workspaces/${workspaceId}/projects`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  revalidatePath("/creative-studio");
  revalidatePath("/brand");
  return project;
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  payload: Partial<CreateProjectPayload>
): Promise<Project> {
  const { project } = await apiFetch<{ project: Project }>(
    `/workspaces/${workspaceId}/projects/${projectId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );

  revalidatePath("/creative-studio");
  revalidatePath("/brand");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  return project;
}

export async function deleteProject(
  workspaceId: string,
  projectId: string
): Promise<void> {
  await apiFetch(`/workspaces/${workspaceId}/projects/${projectId}`, {
    method: "DELETE",
  });

  revalidatePath("/creative-studio");
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

export async function uploadProjectLogo(
  workspaceId: string,
  projectId: string,
  formData: FormData
): Promise<{ project?: Project; brand_logo: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(
    `${API_URL}/workspaces/${workspaceId}/projects/${projectId}/upload-logo`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Upload failed: ${res.status}`);
  revalidatePath("/creative-studio");
  revalidatePath("/brand");
  revalidatePath(`/projects/${projectId}`);
  return data;
}

export async function uploadProjectAssets(
  workspaceId: string,
  projectId: string,
  formData: FormData
): Promise<{ assets: { id: string; file_name: string; file_type: string; file_size: number; storage_path: string }[] }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(
    `${API_URL}/workspaces/${workspaceId}/projects/${projectId}/upload-assets`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Upload failed: ${res.status}`);
  revalidatePath(`/projects/${projectId}`);
  return data;
}

export interface AnalyzeWebsiteResult {
  extract: {
    title?: string;
    description?: string;
    ogImage?: string;
    suggestedLogoUrl?: string;
    themeColor?: string;
    siteName?: string;
    bodySnippet?: string;
    primaryFont?: string;
  };
  suggestions: {
    brand_name?: string;
    description: string;
    brand_guidelines: string;
    suggestedColors: string[];
    brand_tone?: string;
    brand_industry?: string;
    target_audience?: string;
    primary_font?: string;
  };
}

export async function setProjectLogoFromUrl(
  workspaceId: string,
  projectId: string,
  url: string
): Promise<{ brand_logo: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(
    `${API_URL}/workspaces/${workspaceId}/projects/${projectId}/set-logo-from-url`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url.trim() }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Failed to set logo: ${res.status}`);
  revalidatePath("/creative-studio");
  revalidatePath("/brand");
  revalidatePath(`/projects/${projectId}`);
  return data as { brand_logo: string };
}

export async function analyzeWebsite(
  workspaceId: string,
  projectId: string,
  url: string
): Promise<AnalyzeWebsiteResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(
    `${API_URL}/workspaces/${workspaceId}/projects/${projectId}/analyze-website`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url.trim() }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Analysis failed: ${res.status}`);
  return data as AnalyzeWebsiteResult;
}

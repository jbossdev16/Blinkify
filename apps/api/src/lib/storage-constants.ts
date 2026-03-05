import { supabase } from "./supabase.js";

/**
 * Signed URL expiry for Supabase Storage.
 * 1 hour keeps egress down while refetch-on-visibility and error handling
 * in the frontend keep UX smooth in production.
 */
export const SIGNED_URL_EXPIRY_SECONDS = 3600;

/** Public bucket for marketing email images. Permanent URLs for copied HTML. */
export const EMAIL_ASSETS_BUCKET = "email-assets";

const EMAIL_ASSETS_PREFIX = "email-assets/";

export function isEmailAssetsPath(resultUrl: string): boolean {
  return resultUrl.startsWith(EMAIL_ASSETS_PREFIX);
}

export function getEmailAssetsStoragePath(resultUrl: string): string {
  return resultUrl.slice(EMAIL_ASSETS_PREFIX.length);
}

/** Returns public URL for email-assets, signed URL for generated-images. */
export async function resolveGenerationImageUrl(
  storage: { from: (b: string) => { getPublicUrl: (p: string) => { data: { publicUrl: string } }; createSignedUrl: (p: string, e: number) => Promise<{ data: { signedUrl: string } | null }> } },
  resultUrl: string,
  imagesBucket: string
): Promise<string | null> {
  if (!resultUrl) return null;
  if (isEmailAssetsPath(resultUrl)) {
    const path = getEmailAssetsStoragePath(resultUrl);
    const { data } = storage.from(EMAIL_ASSETS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
  const { data } = await storage.from(imagesBucket).createSignedUrl(resultUrl, SIGNED_URL_EXPIRY_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Ensures the email-assets bucket exists and is public.
 * Call once at server startup. Safe to call multiple times.
 */
export async function ensureEmailAssetsBucket(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === EMAIL_ASSETS_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(EMAIL_ASSETS_BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
    });
    if (error) console.error(`Failed to create ${EMAIL_ASSETS_BUCKET} bucket:`, error.message);
    else console.log(`Created public bucket: ${EMAIL_ASSETS_BUCKET}`);
  } else {
    const { error } = await supabase.storage.updateBucket(EMAIL_ASSETS_BUCKET, { public: true });
    if (error) console.error(`Failed to update ${EMAIL_ASSETS_BUCKET} bucket:`, error.message);
  }
}

# Storage buckets

Blinkify uses Supabase Storage. Migrations create the private buckets. The API can create the public email bucket.

| Bucket | Public | Created by | Purpose |
| --- | --- | --- | --- |
| `project-assets` | No | `supabase/migrations/20260209230000_invitations_audit_credits_softdelete_storage.sql` | Uploads and brand files. Path convention: `{workspace_id}/{project_id}/filename`. 50 MB, images + short video. |
| `generated-images` | No | `supabase/migrations/20260211180000_generations_phase3.sql` | Ad stills. The API returns **signed URLs** (1 hour). |
| `generated-videos` | No | `supabase/migrations/20260214000000_video_generation.sql` | Video outputs. Signed / member-scoped. |
| `email-assets` | Yes | API `ensureEmailAssetsBucket()` on boot | Images that must survive in copied email HTML (permanent public URLs). |

## Why email-assets is public

Marketing email HTML is copied out of the product. Recipients’ mail clients cannot call your API for a signed URL, so those images need a stable public object URL.

## Manual create (if the API cannot)

In Supabase → Storage:

1. New bucket named `email-assets`.
2. Public: **on**.
3. Restrict writes to the service role (default if you add no user write policies).

## Image hosts in Next.js

`apps/web/next.config.ts` allows `*.supabase.co/storage/**` so any self-hosted project’s storage URLs work with `next/image`.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn("Supabase: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.");
}

/**
 * Supabase client using the service_role key.
 * Bypasses RLS — use only in the API (server-side).
 * Never expose this client or key to the frontend.
 */
export const supabase = createClient(url ?? "", serviceKey ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Auth admin helpers: look up user by email without listing all users.
 * Uses get_auth_user_by_email RPC when migration 20260225100001 is applied;
 * otherwise falls back to listUsers (slower, use for small user bases).
 */

import { supabase } from "./supabase.js";

export interface AuthUserByEmail {
  id: string;
  email_confirmed_at: string | null;
}

export async function getAuthUserByEmail(
  normalizedEmail: string
): Promise<AuthUserByEmail | null> {
  const { data, error } = await supabase.rpc("get_auth_user_by_email", {
    search_email: normalizedEmail,
  });
  if (!error && data && Array.isArray(data) && data.length > 0) {
    const row = data[0] as { id: string; email_confirmed_at: string | null };
    return { id: row.id, email_confirmed_at: row.email_confirmed_at };
  }
  // Fallback: listUsers (paginated; stop after finding or first page)
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = list?.users?.find(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );
  if (!user) return null;
  return {
    id: user.id,
    email_confirmed_at: user.email_confirmed_at ?? null,
  };
}

export async function deleteAuthUser(userId: string): Promise<void> {
  await supabase.auth.admin.deleteUser(userId);
}

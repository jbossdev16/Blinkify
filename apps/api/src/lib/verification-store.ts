/**
 * Signup verification code store: DB-first with in-memory fallback.
 * When migration 20260225100000_signup_verification_codes is applied, codes
 * are stored in public.signup_verification_codes. Otherwise uses in-memory Map.
 */

import { supabase } from "./supabase.js";

export interface PendingVerification {
  code: string;
  expiresAt: number;
  attempts: number;
  signupData: {
    email: string;
    password: string;
    fullName: string;
  };
}

const memoryStore = new Map<string, PendingVerification>();

let dbAvailable: boolean | null = null;

async function checkDb(): Promise<boolean> {
  if (dbAvailable !== null) return dbAvailable;
  try {
    const { error } = await supabase
      .from("signup_verification_codes")
      .select("email_normalized")
      .limit(1);
    dbAvailable = !error;
  } catch {
    dbAvailable = false;
  }
  return dbAvailable ?? false;
}

export async function getVerification(normalizedEmail: string): Promise<PendingVerification | null> {
  if (await checkDb()) {
    const { data, error } = await supabase
      .from("signup_verification_codes")
      .select("code, expires_at, attempts, signup_data")
      .eq("email_normalized", normalizedEmail)
      .single();
    if (!error && data) {
      return {
        code: data.code,
        expiresAt: new Date(data.expires_at).getTime(),
        attempts: data.attempts ?? 0,
        signupData: data.signup_data as PendingVerification["signupData"],
      };
    }
  }
  return memoryStore.get(normalizedEmail) ?? null;
}

export async function setVerification(
  normalizedEmail: string,
  data: PendingVerification
): Promise<void> {
  if (await checkDb()) {
    const { error } = await supabase.from("signup_verification_codes").upsert(
      {
        email_normalized: normalizedEmail,
        code: data.code,
        expires_at: new Date(data.expiresAt).toISOString(),
        attempts: data.attempts,
        signup_data: data.signupData,
      },
      { onConflict: "email_normalized" }
    );
    if (!error) return;
    if (error.code === "42P01") dbAvailable = false; // table missing
  }
  memoryStore.set(normalizedEmail, data);
}

export async function deleteVerification(normalizedEmail: string): Promise<void> {
  if (await checkDb()) {
    await supabase
      .from("signup_verification_codes")
      .delete()
      .eq("email_normalized", normalizedEmail);
  }
  memoryStore.delete(normalizedEmail);
}

export async function incrementAttempts(normalizedEmail: string): Promise<number> {
  const pending = await getVerification(normalizedEmail);
  if (!pending) return 0;
  const next = pending.attempts + 1;
  if (await checkDb()) {
    const { error } = await supabase
      .from("signup_verification_codes")
      .update({ attempts: next })
      .eq("email_normalized", normalizedEmail);
    if (!error) return next;
  }
  pending.attempts = next;
  memoryStore.set(normalizedEmail, pending);
  return next;
}

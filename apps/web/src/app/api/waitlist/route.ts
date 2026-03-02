import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import React from "react";
import { WaitlistWelcomeEmail } from "@/emails/waitlist-welcome";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai";
/** PNG is used in email; most clients (Gmail, Outlook) block SVG. PNG is generated at build time. */
const LOGO_PNG_URL = `${BASE_URL}/logo/blinkify-logo-color.png`;

let _supabase: SupabaseClient | null = null;
function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

let _resend: Resend | null | undefined;
function getResend() {
  if (_resend === undefined) {
    const apiKey = process.env.RESEND_API_KEY;
    _resend = apiKey ? new Resend(apiKey) : null;
  }
  return _resend;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawEmail = body?.email;

  if (!rawEmail || typeof rawEmail !== "string" || !EMAIL_REGEX.test(rawEmail.trim())) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const email = rawEmail.trim().toLowerCase();

  const FROM_EMAIL =
    process.env.RESEND_FROM_EMAIL ?? "Blinkify <no-reply@blinkify.ai>";
  const supabase = getSupabase();
  const resend = getResend();

  const { data, error } = await supabase
    .from("waitlist")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true })
    .select("email")
    .single();

  if (error) {
    console.error("waitlist insert error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }

  if (data && resend) {
    resend.emails
      .send({
        from: FROM_EMAIL,
        to: email,
        subject: "You're on the Blinkify waitlist!",
        react: React.createElement(WaitlistWelcomeEmail, { logoSrc: LOGO_PNG_URL }),
      })
      .catch((err) => console.error("waitlist welcome email error:", err));
  }

  return NextResponse.json({ ok: true });
}

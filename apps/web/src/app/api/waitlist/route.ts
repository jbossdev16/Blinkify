import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import React from "react";
import { WaitlistWelcomeEmail } from "@/emails/waitlist-welcome";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Blinkify <no-reply@blinkify.ai>";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawEmail = body?.email;

  if (!rawEmail || typeof rawEmail !== "string" || !EMAIL_REGEX.test(rawEmail.trim())) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const email = rawEmail.trim().toLowerCase();

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
        react: React.createElement(WaitlistWelcomeEmail),
      })
      .catch((err) => console.error("waitlist welcome email error:", err));
  }

  return NextResponse.json({ ok: true });
}

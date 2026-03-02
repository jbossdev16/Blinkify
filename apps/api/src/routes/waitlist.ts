import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import React from "react";
import { supabase } from "../lib/supabase.js";
import { resend } from "../lib/resend.js";
import { isEmail, normalizeEmail } from "../lib/validation.js";
import { WaitlistWelcomeEmail } from "../emails/waitlist-welcome.js";

const router = Router();

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Blinkify <no-reply@blinkify.ai>";

const waitlistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many requests. Try again later." });
  },
});

router.post("/", waitlistLimiter, async (req: Request, res: Response) => {
  const rawEmail = req.body?.email;
  if (!rawEmail || typeof rawEmail !== "string" || !isEmail(rawEmail)) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }

  const email = normalizeEmail(rawEmail);

  const { data, error } = await supabase
    .from("waitlist")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true })
    .select("email")
    .single();

  if (error) {
    console.error("waitlist insert error:", error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
    return;
  }

  // Only send welcome email for new signups (data returned means it was inserted)
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

  res.json({ ok: true });
});

export default router;

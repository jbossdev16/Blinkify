import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import React from "react";
import { resend } from "../lib/resend.js";
import { supabase } from "../lib/supabase.js";
import { VerificationCodeEmail } from "../emails/verification-code";
import { ResetPasswordEmail } from "../emails/reset-password";
import { isEmail, normalizeEmail } from "../lib/validation.js";
import {
  getVerification,
  setVerification,
  deleteVerification,
  incrementAttempts,
} from "../lib/verification-store.js";
import { getAuthUserByEmail, deleteAuthUser } from "../lib/auth-admin.js";

const router = Router();

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Blinkify <no-reply@blinkify.ai>";

const SEND_CODE_COOLDOWN_MS = 30 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

const authRateLimitHandler = (res: Response, message: string) => {
  res.status(429).json({ error: message });
};
const sendCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  handler: (_, res) => authRateLimitHandler(res, "Too many signup attempts. Try again in 15 minutes."),
});
const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  handler: (_, res) => authRateLimitHandler(res, "Too many verification attempts. Try again in 15 minutes."),
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  handler: (_, res) => authRateLimitHandler(res, "Too many password reset requests. Try again in 15 minutes."),
});

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// ─── POST /auth/send-code ─────────────────────────────────────────────────────

router.post("/send-code", sendCodeLimiter, async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";

    if (!email || !isEmail(email)) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    if (!firstName) {
      res.status(400).json({ error: "First name is required" });
      return;
    }

    const normalized = normalizeEmail(email);

    const existing = await getVerification(normalized);
    if (existing) {
      const sentAt = existing.expiresAt - CODE_TTL_MS;
      if (Date.now() - sentAt < SEND_CODE_COOLDOWN_MS) {
        const waitSec = Math.ceil((SEND_CODE_COOLDOWN_MS - (Date.now() - sentAt)) / 1000);
        res.status(429).json({ error: `Please wait ${waitSec}s before resending` });
        return;
      }
    }

    const existingUser = await getAuthUserByEmail(normalized);
    if (existingUser) {
      if (existingUser.email_confirmed_at) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }
      await deleteAuthUser(existingUser.id);
    }

    const code = generateCode();
    const expiresAt = Date.now() + CODE_TTL_MS;
    await setVerification(normalized, {
      code,
      expiresAt,
      attempts: 0,
      signupData: {
        email,
        password,
        fullName: `${firstName} ${lastName}`.trim(),
      },
    });

    if (!resend) {
      console.warn("Resend not configured. Code:", code);
      res.json({ sent: true });
      return;
    }

    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Blinkify verification code",
      react: React.createElement(VerificationCodeEmail, { code }),
    });

    if (emailError) {
      console.error("Failed to send verification email:", emailError);
      res.status(500).json({ error: "Failed to send verification email" });
      return;
    }

    res.json({ sent: true });
  } catch (err: unknown) {
    console.error("POST /auth/send-code error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

// ─── POST /auth/verify-code ───────────────────────────────────────────────────

router.post("/verify-code", verifyCodeLimiter, async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";

    if (!email || !code) {
      res.status(400).json({ error: "Email and code are required" });
      return;
    }

    const normalized = normalizeEmail(email);
    const pending = await getVerification(normalized);

    if (!pending) {
      res.status(400).json({ error: "No verification code found. Please request a new one." });
      return;
    }

    if (Date.now() > pending.expiresAt) {
      await deleteVerification(normalized);
      res.status(410).json({ error: "Code has expired. Please request a new code." });
      return;
    }

    const attempts = await incrementAttempts(normalized);
    if (attempts > 5) {
      await deleteVerification(normalized);
      res.status(429).json({ error: "Too many attempts. Please request a new code." });
      return;
    }

    if (pending.code !== code) {
      res.status(400).json({ error: "Incorrect code" });
      return;
    }

    const { signupData } = pending;

    let createResult = await supabase.auth.admin.createUser({
      email: signupData.email,
      password: signupData.password,
      email_confirm: true,
      user_metadata: { full_name: signupData.fullName },
    });

    if (createResult.error?.message?.toLowerCase().includes("already been registered")) {
      const ghost = await getAuthUserByEmail(normalized);
      if (ghost) {
        await deleteAuthUser(ghost.id);
      }
      createResult = await supabase.auth.admin.createUser({
        email: signupData.email,
        password: signupData.password,
        email_confirm: true,
        user_metadata: { full_name: signupData.fullName },
      });
    }

    if (createResult.error) {
      console.error("Failed to create user:", createResult.error);
      res.status(500).json({ error: createResult.error.message });
      return;
    }

    await deleteVerification(normalized);

    res.json({ success: true, userId: createResult.data.user.id });
  } catch (err: unknown) {
    console.error("POST /auth/verify-code error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

// ─── POST /auth/forgot-password ─────────────────────────────────────────────

router.post("/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const redirectTo =
      typeof req.body?.redirectTo === "string" && req.body.redirectTo
        ? req.body.redirectTo
        : null;

    if (!email || !isEmail(email)) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }

    const normalized = normalizeEmail(email);

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalized,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (error || !data?.properties?.action_link) {
      res.json({ sent: true });
      return;
    }

    let resetLink = data.properties.action_link;
    if (!resetLink.startsWith("http")) {
      const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
      resetLink = base ? `${base}/${resetLink.replace(/^\//, "")}` : resetLink;
    }

    if (!resend) {
      console.warn("Resend not configured. Reset link:", resetLink);
      res.json({ sent: true });
      return;
    }

    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your Blinkify password",
      react: React.createElement(ResetPasswordEmail, { resetLink }),
    });

    if (emailError) {
      console.error("Failed to send reset email:", emailError);
      res.status(500).json({ error: "Failed to send reset email" });
      return;
    }

    res.json({ sent: true });
  } catch (err: unknown) {
    console.error("POST /auth/forgot-password error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

export default router;

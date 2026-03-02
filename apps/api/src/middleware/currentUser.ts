import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";
import { ensureWorkspace } from "../services/workspace.js";

/**
 * Attaches the internal user row to req.user.
 * Must run after requireAuth. If no matching user in DB, sends 404.
 */
export async function requireCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sub = req.auth?.payload?.sub;
  if (!sub) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_provider_id", sub)
    .single();

  if (error || !user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  (req as Request & { user: typeof user }).user = user;
  next();
}

/**
 * Like requireCurrentUser but auto-provisions user + workspace if missing.
 * Use after requireAuth so the first dashboard load works even when init wasn't called.
 */
export async function ensureCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const payload = req.auth?.payload;
  const sub = payload?.sub;
  if (!sub) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  let { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_provider_id", sub)
    .single();

  if ((error || !user)) {
    try {
      await ensureWorkspace({
        authProviderId: sub,
        email: typeof payload?.email === "string" ? payload.email : undefined,
        name: typeof payload?.name === "string" ? payload.name : undefined,
        avatarUrl: typeof payload?.picture === "string" ? payload.picture : undefined,
      });
    } catch (err) {
      console.error("ensureCurrentUser: ensureWorkspace failed", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to set up account",
      });
      return;
    }

    const result = await supabase
      .from("users")
      .select("*")
      .eq("auth_provider_id", sub)
      .single();

    user = result.data;
    error = result.error;
  }

  if (error || !user) {
    res.status(500).json({ error: "User not found after setup" });
    return;
  }

  (req as Request & { user: typeof user }).user = user;
  next();
}

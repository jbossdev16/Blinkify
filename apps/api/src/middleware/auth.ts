import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase Auth: SUPABASE_URL or SUPABASE_ANON_KEY missing. Protected routes will return 401."
  );
}

/**
 * Middleware that verifies Supabase JWT access tokens.
 * Expects: Authorization: Bearer <token>
 * Sets req.auth with { sub, email, ... } from the token.
 * Returns 401 if missing/invalid.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(401).json({ error: "Auth not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  // Create a per-request Supabase client with the user's token
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let user;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    user = data.user;
  } catch (err: unknown) {
    const code = (err as { cause?: { code?: string } })?.cause?.code;
    if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT" || code === "ECONNREFUSED") {
      console.error("Auth: cannot reach Supabase –", code);
      res.status(503).json({ error: "Authentication service unreachable. Check your network or Supabase status." });
      return;
    }
    console.error("Auth: unexpected error verifying token", err);
    res.status(502).json({ error: "Authentication service error" });
    return;
  }

  // Attach auth info in the same shape the rest of the codebase expects
  req.auth = {
    payload: {
      sub: user.id,
      email: user.email,
      name: user.user_metadata?.full_name,
      picture: user.user_metadata?.avatar_url,
    },
  };

  next();
}

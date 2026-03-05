import type { Request, Response, NextFunction } from "express";

/**
 * Requires the authenticated user to be a Blinkify super admin.
 * Must run after requireAuth + ensureCurrentUser so req.user is populated.
 */
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as Request & { user: { is_super_admin?: boolean } }).user;
  if (!user?.is_super_admin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

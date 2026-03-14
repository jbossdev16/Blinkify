import { Router, Request, Response } from "express";
import { Polar } from "@polar-sh/sdk";
import { requireAuth } from "../middleware/auth.js";
import { ensureCurrentUser } from "../middleware/currentUser.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN ?? "";
const POLAR_SANDBOX = process.env.POLAR_SANDBOX === "true" || process.env.POLAR_SANDBOX === "1";

const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const defaultOrigin = allowedOrigins[0] ?? "http://localhost:3000";

function getOriginForRequest(req: Request): string {
  const origin = req.get("Origin");
  if (origin && allowedOrigins.includes(origin)) return origin;
  return defaultOrigin;
}

const POLAR_PRODUCT_IDS: Record<string, string | undefined> = {
  standard: process.env.POLAR_PRODUCT_ID_STANDARD,
  professional: process.env.POLAR_PRODUCT_ID_PROFESSIONAL,
  ultra: process.env.POLAR_PRODUCT_ID_AGENCY,
};

const POLAR_PRODUCT_IDS_ANNUAL: Record<string, string | undefined> = {
  standard: process.env.POLAR_PRODUCT_ID_STANDARD_ANNUAL,
  professional: process.env.POLAR_PRODUCT_ID_PROFESSIONAL_ANNUAL,
  ultra: process.env.POLAR_PRODUCT_ID_AGENCY_ANNUAL,
};

const polar = new Polar({
  accessToken: POLAR_ACCESS_TOKEN,
  ...(POLAR_SANDBOX && { server: "sandbox" }),
});

router.post(
  "/create-session",
  async (req: Request, res: Response) => {
    try {
      if (!POLAR_ACCESS_TOKEN) {
        res.status(503).json({ error: "Polar is not configured" });
        return;
      }

      const rawPlan = typeof req.body?.plan === "string" ? req.body.plan.trim().toLowerCase() : "";
      const plan = rawPlan === "agency" ? "ultra" : rawPlan;
      const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
      const billing = req.body?.billing === "annual" ? "annual" : "monthly";

      if (!plan) {
        res.status(400).json({ error: "Invalid plan" });
        return;
      }

      const productIds = billing === "annual" ? POLAR_PRODUCT_IDS_ANNUAL : POLAR_PRODUCT_IDS;
      const productId = productIds[plan];
      if (!productId) {
        const hint =
          billing === "annual"
            ? `Annual product ID for plan "${plan}" is missing. Set POLAR_PRODUCT_ID_${plan === "ultra" ? "AGENCY" : plan.toUpperCase()}_ANNUAL in the API .env (or in your host's environment if deployed, e.g. Vercel).`
            : "Invalid plan";
        res.status(400).json({ error: hint });
        return;
      }
      const webOrigin = getOriginForRequest(req);

      const skipTrial = req.body?.skipTrial === true;
      const checkout = await polar.checkouts.create({
        products: [productId],
        ...(email && { customerEmail: email }),
        embedOrigin: webOrigin,
        successUrl: `${webOrigin}/signin?verified=true`,
        returnUrl: skipTrial ? `${webOrigin}/billing` : `${webOrigin}/setup-plan`,
        ...(skipTrial ? {} : { trialInterval: "day", trialIntervalCount: 3 }),
      });

      res.json({ url: checkout.url });
    } catch (err: unknown) {
      const statusCode = typeof (err as { statusCode?: number })?.statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;
      const body = err as { body?: string };
      const isProductNotFound =
        statusCode === 422 &&
        typeof body?.body === "string" &&
        body.body.includes("Product does not exist");

      if (isProductNotFound) {
        console.error("POST /checkout/create-session: Polar product not found.", body?.body);
        res.status(400).json({
          error:
            "This plan is not set up in Polar. Check that each POLAR_PRODUCT_ID_* in the API .env matches a product in the same Polar org (and same environment: sandbox vs production) as your POLAR_ACCESS_TOKEN.",
        });
        return;
      }

      const isInvalidToken =
        statusCode === 401 &&
        typeof body?.body === "string" &&
        body.body.includes("invalid_token");
      if (isInvalidToken) {
        console.error("POST /checkout/create-session: Polar token rejected.", body?.body);
        res.status(401).json({
          error:
            "Polar access token is invalid or expired. If you use Sandbox product IDs, set POLAR_SANDBOX=true in the API .env and use a token from the Sandbox dashboard. Create a new Personal Access Token in the correct Polar environment, set POLAR_ACCESS_TOKEN, then restart the API.",
        });
        return;
      }

      console.error("POST /checkout/create-session error:", err);
      res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
        error: err instanceof Error ? err.message : "Failed to create checkout session",
      });
    }
  }
);

// ─── POST /checkout/cancel-subscription ─────────────────────────────────────
// Cancels the current user's Polar subscription at period end. Requires auth.
// Uses workspace.stripe_subscription_id as the Polar subscription ID (set by webhook or success flow).
router.post(
  "/cancel-subscription",
  requireAuth,
  ensureCurrentUser,
  async (req: Request, res: Response) => {
    try {
      if (!POLAR_ACCESS_TOKEN) {
        res.status(503).json({ error: "Billing is not configured" });
        return;
      }

      const user = (req as Request & { user: { id: string } }).user;

      const { data: memberships, error: memError } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(stripe_subscription_id)")
        .eq("user_id", user.id);

      if (memError) {
        console.error("POST /checkout/cancel-subscription: workspace query error", memError);
        res.status(500).json({ error: "Failed to resolve workspace" });
        return;
      }

      type Row = { workspace_id: string; workspaces: { stripe_subscription_id?: string | null } | null };
      const rows = (memberships ?? []) as unknown as Row[];
      const subscriptionId = rows
        .map((r) => r.workspaces?.stripe_subscription_id)
        .find((id): id is string => typeof id === "string" && id.length > 0);

      if (!subscriptionId) {
        res.status(400).json({ error: "No active subscription found" });
        return;
      }

      await polar.subscriptions.update({
        id: subscriptionId,
        subscriptionUpdate: { cancelAtPeriodEnd: true },
      });

      res.json({ ok: true });
    } catch (err: unknown) {
      const statusCode = typeof (err as { statusCode?: number })?.statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;
      const body = err as { body?: string };
      if (statusCode === 404 || (typeof body?.body === "string" && body.body.toLowerCase().includes("not found"))) {
        res.status(400).json({ error: "Subscription not found or already canceled" });
        return;
      }
      console.error("POST /checkout/cancel-subscription error:", err);
      res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
        error: err instanceof Error ? err.message : "Failed to cancel subscription",
      });
    }
  }
);

export default router;

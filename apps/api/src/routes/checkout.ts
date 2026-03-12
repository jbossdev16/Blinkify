import { Router, Request, Response } from "express";
import { Polar } from "@polar-sh/sdk";

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

      const plan = typeof req.body?.plan === "string" ? req.body.plan.trim().toLowerCase() : "";
      const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
      const billing = req.body?.billing === "annual" ? "annual" : "monthly";

      if (!plan) {
        res.status(400).json({ error: "Invalid plan" });
        return;
      }

      const productIds = billing === "annual" ? POLAR_PRODUCT_IDS_ANNUAL : POLAR_PRODUCT_IDS;
      const productId = productIds[plan];
      if (!productId) {
        res.status(400).json({
          error: billing === "annual"
            ? "Annual pricing is not configured for this plan. Check POLAR_PRODUCT_ID_*_ANNUAL in the API .env."
            : "Invalid plan",
        });
        return;
      }
      const webOrigin = getOriginForRequest(req);

      const checkout = await polar.checkouts.create({
        products: [productId],
        ...(email && { customerEmail: email }),
        embedOrigin: webOrigin,
        successUrl: `${webOrigin}/signin?verified=true`,
        returnUrl: `${webOrigin}/setup-plan`,
        trialInterval: "day",
        trialIntervalCount: 3,
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

export default router;

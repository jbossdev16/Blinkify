import express, { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { PLAN_CONFIG, getPlanConfig } from "../lib/plan-config.js";
import {
  clampCreditsAfterGrant,
  creditsAfterDowngradeToFree,
  isFreePlanKey,
} from "../lib/workspace-credits.js";

const router = Router();

function buildPolarPlanMap(): Record<string, string> {
  const m: Record<string, string> = {};
  const pairs: [string | undefined, string][] = [
    [process.env.POLAR_PRODUCT_ID_STANDARD, "standard"],
    [process.env.POLAR_PRODUCT_ID_PROFESSIONAL, "pro"],
    [process.env.POLAR_PRODUCT_ID_AGENCY, "agency"],
    [process.env.POLAR_PRODUCT_ID_STANDARD_ANNUAL, "standard"],
    [process.env.POLAR_PRODUCT_ID_PROFESSIONAL_ANNUAL, "pro"],
    [process.env.POLAR_PRODUCT_ID_AGENCY_ANNUAL, "agency"],
  ];
  for (const [id, plan] of pairs) {
    if (id) m[id] = plan;
  }
  return m;
}

async function resolveWorkspaceForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: userRows } = await supabase
    .from("users")
    .select("id")
    .ilike("email", normalizedEmail)
    .limit(1);
  const user = userRows?.[0];
  if (!user) return null;
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, plan, credits, polar_subscription_id")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  const ws = workspaces?.[0];
  if (!ws) return null;
  return { userId: user.id, workspace: ws };
}

router.post(
  "/polar",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    try {
      const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[Webhook] POLAR_WEBHOOK_SECRET not set");
        res.status(500).json({ error: "Webhook secret not configured" });
        return;
      }

      const { validateEvent, WebhookVerificationError } = await import(
        "@polar-sh/sdk/webhooks"
      );

      let event: ReturnType<typeof validateEvent>;
      try {
        const body = req.body;
        const raw =
          Buffer.isBuffer(body) ? body.toString("utf8") : typeof body === "string" ? body : "";
        event = validateEvent(
          raw,
          req.headers as Record<string, string>,
          webhookSecret
        );
      } catch (err) {
        if (err instanceof WebhookVerificationError) {
          console.error("[Webhook] Invalid signature");
          res.status(403).json({ error: "Invalid webhook signature" });
          return;
        }
        throw err;
      }

      const POLAR_PLAN_MAP = buildPolarPlanMap();
      const { type, data } = event as {
        type: string;
        data: Record<string, unknown> & {
          id?: string;
          productId?: string;
          status?: string;
          customer?: { email?: string };
          billingReason?: string;
          customerId?: string;
        };
      };

      console.log(`[Webhook] Received: ${type}`);

      /* ── Monthly rollover: paid plans only ───────────────────────────── */
      if (type === "order.paid") {
        const order = data as {
          billingReason?: string;
          customer?: { email?: string };
        };
        const br = order.billingReason ?? "";
        if (br === "subscription_cycle") {
          const customerEmail = order.customer?.email;
          if (customerEmail) {
            const resolved = await resolveWorkspaceForEmail(customerEmail);
            if (resolved && !isFreePlanKey(resolved.workspace.plan)) {
              const plan = resolved.workspace.plan;
              const monthly = getPlanConfig(plan).maxCredits;
              const prev = resolved.workspace.credits ?? 0;
              const next = clampCreditsAfterGrant(plan, prev + monthly);
              if (next !== prev) {
                await supabase
                  .from("workspaces")
                  .update({ credits: next })
                  .eq("id", resolved.workspace.id);
                await supabase.from("credit_transactions").insert({
                  workspace_id: resolved.workspace.id,
                  user_id: resolved.userId,
                  type: "plan_grant",
                  amount: next - prev,
                  balance_after: next,
                  description: `Monthly credit rollover (+${monthly}, capped)`,
                });
                console.log(`[Webhook] Rollover ${customerEmail}: ${prev} → ${next}`);
              }
            }
          }
        }
        res.status(200).json({ received: true });
        return;
      }

      if (type === "subscription.active") {
        const productId = data.productId as string;
        const customerEmail = data.customer?.email;
        const status = data.status as string;
        const subscriptionId = data.id as string;

        if (customerEmail && productId && (status === "active" || status === "trialing")) {
          const newPlan = POLAR_PLAN_MAP[productId];
          if (newPlan && PLAN_CONFIG[newPlan]) {
            const resolved = await resolveWorkspaceForEmail(customerEmail);
            if (resolved) {
              const ws = resolved.workspace as {
                id: string;
                plan: string;
                credits: number | null;
                polar_subscription_id?: string | null;
              };
              const monthly = PLAN_CONFIG[newPlan]!.maxCredits;
              const prev = ws.credits ?? 0;
              const firstPaidActivation =
                isFreePlanKey(ws.plan) || !ws.polar_subscription_id;

              if (firstPaidActivation) {
                const credits = clampCreditsAfterGrant(newPlan, monthly);
                await supabase
                  .from("workspaces")
                  .update({
                    plan: newPlan,
                    credits,
                    trial_ends_at: null,
                    polar_subscription_id: subscriptionId,
                  })
                  .eq("id", ws.id);

                await supabase.from("credit_transactions").insert({
                  workspace_id: ws.id,
                  user_id: resolved.userId,
                  type: "plan_grant",
                  amount: credits - prev,
                  balance_after: credits,
                  description: `Subscription active: ${newPlan}`,
                });
                console.log(`[Webhook] ${customerEmail} → ${newPlan}, ${credits} credits (initial)`);
              } else {
                await supabase
                  .from("workspaces")
                  .update({
                    plan: newPlan,
                    trial_ends_at: null,
                    polar_subscription_id: subscriptionId,
                  })
                  .eq("id", ws.id);
                console.log(`[Webhook] ${customerEmail} plan sync ${newPlan} (credits unchanged: ${prev})`);
              }
            }
          }
        }
        res.status(200).json({ received: true });
        return;
      }

      if (type === "subscription.updated") {
        const productId = data.productId as string;
        const customerEmail = data.customer?.email;
        const status = data.status as string;
        const subscriptionId = data.id as string;

        if (
          customerEmail &&
          productId &&
          (status === "active" || status === "trialing")
        ) {
          const newPlan = POLAR_PLAN_MAP[productId];
          if (newPlan && PLAN_CONFIG[newPlan]) {
            const resolved = await resolveWorkspaceForEmail(customerEmail);
            if (resolved) {
              const ws = resolved.workspace as {
                id: string;
                plan: string;
                credits: number | null;
              };
              if (isFreePlanKey(ws.plan)) {
                const monthly = PLAN_CONFIG[newPlan]!.maxCredits;
                const credits = clampCreditsAfterGrant(newPlan, monthly);
                const prev = ws.credits ?? 0;
                await supabase
                  .from("workspaces")
                  .update({
                    plan: newPlan,
                    credits,
                    trial_ends_at: null,
                    polar_subscription_id: subscriptionId,
                  })
                  .eq("id", ws.id);
                await supabase.from("credit_transactions").insert({
                  workspace_id: ws.id,
                  user_id: resolved.userId,
                  type: "plan_grant",
                  amount: credits - prev,
                  balance_after: credits,
                  description: `Subscription updated: ${newPlan}`,
                });
                console.log(`[Webhook] ${customerEmail} → ${newPlan} via updated, ${credits} credits`);
              } else {
                await supabase
                  .from("workspaces")
                  .update({
                    plan: newPlan,
                    polar_subscription_id: subscriptionId,
                  })
                  .eq("id", ws.id);
                console.log(`[Webhook] Plan sync ${customerEmail} → ${newPlan}`);
              }
            }
          }
        }
        res.status(200).json({ received: true });
        return;
      }

      if (type === "subscription.revoked") {
        const customerEmail = (data.customer as { email?: string } | undefined)?.email;
        if (customerEmail) {
          const resolved = await resolveWorkspaceForEmail(customerEmail);
          if (resolved) {
            const prev = resolved.workspace.credits ?? 0;
            const next = creditsAfterDowngradeToFree(prev);
            await supabase
              .from("workspaces")
              .update({
                plan: "free",
                credits: next,
                polar_subscription_id: null,
              })
              .eq("id", resolved.workspace.id);

            await supabase.from("credit_transactions").insert({
              workspace_id: resolved.workspace.id,
              user_id: resolved.userId,
              type: "adjustment",
              amount: next - prev,
              balance_after: next,
              description: "Subscription ended — free plan (credits capped at 100)",
            });
            console.log(`[Webhook] ${customerEmail} → free, ${next} credits`);
          }
        }
        res.status(200).json({ received: true });
        return;
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[Webhook] Unhandled error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

export default router;

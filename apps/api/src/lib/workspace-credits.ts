import { getPlanConfig } from "./plan-config.js";

/** Free workspaces cannot hold more than this balance. */
export const FREE_PLAN_CREDIT_CAP = 100;

/** Paid workspaces: max balance = monthly grant × this factor (rollover ceiling). */
export const PAID_CREDIT_ROLLOVER_MULTIPLIER = 4;

export function isFreePlanKey(plan: string): boolean {
  const p = plan.toLowerCase();
  return p === "free" || p === "trial";
}

export function paidCreditCeiling(monthlyGrant: number): number {
  return Math.max(monthlyGrant, monthlyGrant * PAID_CREDIT_ROLLOVER_MULTIPLIER);
}

/** Clamp balance when increasing credits (grants, rollover). */
export function clampCreditsAfterGrant(
  plan: string,
  newBalance: number
): number {
  const p = plan.toLowerCase();
  if (isFreePlanKey(p)) {
    return Math.min(FREE_PLAN_CREDIT_CAP, Math.max(0, newBalance));
  }
  const monthly = getPlanConfig(p).maxCredits;
  const cap = paidCreditCeiling(monthly);
  return Math.min(cap, Math.max(0, newBalance));
}

export function creditsAfterDowngradeToFree(currentCredits: number): number {
  return Math.min(FREE_PLAN_CREDIT_CAP, Math.max(0, currentCredits));
}

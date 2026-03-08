export interface PlanLimits {
  maxCredits: number;
  maxWorkspaces: number;
  videoEnabled: boolean;
  maxBrands: number;
}

export const PLAN_CONFIG: Record<string, PlanLimits> = {
  trial:      { maxCredits: 250,   maxWorkspaces: 1,  videoEnabled: true,  maxBrands: 1 },
  standard:   { maxCredits: 400,   maxWorkspaces: 1,  videoEnabled: false, maxBrands: 1 },
  pro:        { maxCredits: 1500,  maxWorkspaces: 3,  videoEnabled: true,  maxBrands: 3 },
  agency:     { maxCredits: 5000,  maxWorkspaces: 5,  videoEnabled: true,  maxBrands: 10 },
  enterprise: { maxCredits: 10000, maxWorkspaces: 10, videoEnabled: true,  maxBrands: 10 },
};

export const VALID_PLANS = Object.keys(PLAN_CONFIG);

export function getPlanConfig(plan: string): PlanLimits {
  return PLAN_CONFIG[plan.toLowerCase()] ?? PLAN_CONFIG["trial"]!;
}

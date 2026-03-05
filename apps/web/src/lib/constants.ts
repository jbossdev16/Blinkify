/**
 * Max credits per plan. Used for usage bars, alerts, and billing UI.
 * Keys match API plan values and landing names (lowercase): trial, starter/standard, professional/pro, ultra/agency.
 */
export const PLAN_MAX_CREDITS: Record<string, number> = {
  trial: 150,
  standard: 400,
  starter: 400,
  pro: 1500,
  professional: 1500,
  agency: 5000,
  ultra: 5000,
  enterprise: 10000,
};

export interface PlanFeatures {
  videoEnabled: boolean;
  maxBrands: number;
}

export const PLAN_FEATURES: Record<string, PlanFeatures> = {
  trial:        { videoEnabled: true,  maxBrands: 1 },
  standard:     { videoEnabled: false, maxBrands: 1 },
  starter:      { videoEnabled: false, maxBrands: 1 },
  pro:          { videoEnabled: true,  maxBrands: 3 },
  professional: { videoEnabled: true,  maxBrands: 3 },
  agency:       { videoEnabled: true,  maxBrands: 10 },
  ultra:        { videoEnabled: true,  maxBrands: 10 },
  enterprise:   { videoEnabled: true,  maxBrands: 10 },
};

export function getPlanFeatures(plan: string): PlanFeatures {
  return PLAN_FEATURES[plan.toLowerCase()] ?? PLAN_FEATURES["trial"]!;
}

/**
 * Max credits per plan. Used for usage bars, alerts, and billing UI.
 */
export const PLAN_MAX_CREDITS: Record<string, number> = {
  free: 100,
  trial: 100,
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
  fullCampaignEnabled: boolean;
  /** Marketing email tool (generate-email) — Standard+ */
  emailEnabled: boolean;
  maxBrands: number;
}

export const PLAN_FEATURES: Record<string, PlanFeatures> = {
  free: { videoEnabled: false, fullCampaignEnabled: false, emailEnabled: true, maxBrands: 1 },
  trial: { videoEnabled: false, fullCampaignEnabled: false, emailEnabled: true, maxBrands: 1 },
  standard: { videoEnabled: false, fullCampaignEnabled: false, emailEnabled: true, maxBrands: 1 },
  starter: { videoEnabled: false, fullCampaignEnabled: false, emailEnabled: true, maxBrands: 1 },
  pro: { videoEnabled: true, fullCampaignEnabled: true, emailEnabled: true, maxBrands: 3 },
  professional: { videoEnabled: true, fullCampaignEnabled: true, emailEnabled: true, maxBrands: 3 },
  agency: { videoEnabled: true, fullCampaignEnabled: true, emailEnabled: true, maxBrands: 10 },
  ultra: { videoEnabled: true, fullCampaignEnabled: true, emailEnabled: true, maxBrands: 10 },
  enterprise: { videoEnabled: true, fullCampaignEnabled: true, emailEnabled: true, maxBrands: 10 },
};

export function getPlanFeatures(plan: string): PlanFeatures {
  const k = plan.toLowerCase();
  if (k === "trial") return PLAN_FEATURES["free"]!;
  return PLAN_FEATURES[k] ?? PLAN_FEATURES["free"]!;
}

/** Credit cost per image by size (must match API). */
export function imageCreditCost(imageSize: "1K" | "4K"): number {
  return imageSize === "4K" ? 20 : 10;
}

/** Credit cost for email marketing (must match API getEmailCreditCost). */
export function emailCreditCost(imageSize: "1K" | "4K", numberOfImages: 1 | 2 | 3): number {
  if (imageSize === "1K") {
    return numberOfImages === 1 ? 15 : numberOfImages === 2 ? 30 : 50;
  }
  return numberOfImages === 1 ? 25 : numberOfImages === 2 ? 50 : 75;
}

/** Credit cost for Creative Studio video tool by resolution (must match API `videoCreditCost`). */
export function videoCreditCost(resolution: "1080p" | "4k"): number {
  return resolution === "4k" ? 150 : 100;
}

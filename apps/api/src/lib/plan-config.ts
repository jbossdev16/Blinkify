export interface PlanLimits {
  maxCredits: number;
  maxWorkspaces: number;
  videoEnabled: boolean;
  fullCampaignEnabled: boolean;
  maxBrands: number;
}

export const PLAN_CONFIG: Record<string, PlanLimits> = {
  free: {
    maxCredits: 100,
    maxWorkspaces: 1,
    videoEnabled: false,
    fullCampaignEnabled: false,
    maxBrands: 1,
  },
  trial: {
    maxCredits: 100,
    maxWorkspaces: 1,
    videoEnabled: false,
    fullCampaignEnabled: false,
    maxBrands: 1,
  },
  standard: {
    maxCredits: 400,
    maxWorkspaces: 1,
    videoEnabled: false,
    fullCampaignEnabled: false,
    maxBrands: 1,
  },
  pro: {
    maxCredits: 1500,
    maxWorkspaces: 3,
    videoEnabled: true,
    fullCampaignEnabled: true,
    maxBrands: 3,
  },
  agency: {
    maxCredits: 5000,
    maxWorkspaces: 5,
    videoEnabled: true,
    fullCampaignEnabled: true,
    maxBrands: 10,
  },
  enterprise: {
    maxCredits: 10000,
    maxWorkspaces: 10,
    videoEnabled: true,
    fullCampaignEnabled: true,
    maxBrands: 10,
  },
};

export const VALID_PLANS = Object.keys(PLAN_CONFIG);

export function getPlanConfig(plan: string): PlanLimits {
  if (plan.toLowerCase() === "trial") {
    return PLAN_CONFIG["free"]!;
  }
  return PLAN_CONFIG[plan.toLowerCase()] ?? PLAN_CONFIG["free"]!;
}

// ─── Credit costs per generation ───────────────

export const CREDIT_COSTS = {
  IMAGE_1K: 10,
  IMAGE_4K: 20,

  /** Creative Studio video tool only (`POST …/video-generations`). Full campaign video charges use `getFullCampaignPricing().perVideo`. */
  STANDALONE_VIDEO_1080P: 100,
  STANDALONE_VIDEO_4K: 150,

  /** Full campaign fixed totals (no separate “AI intelligence” charge). */
  FULL_CAMPAIGN_1K_TOTAL: 300,
  FULL_CAMPAIGN_4K_TOTAL: 500,
} as const;

/** Per full campaign: images (6) + videos (2) + 2 email variants. */
export function getFullCampaignPricing(quality: "1K" | "4K") {
  if (quality === "4K") {
    return {
      imageSize: "4K" as const,
      perImage: 25,
      perVideo: 150,
      emailBundle: 50,
      total: CREDIT_COSTS.FULL_CAMPAIGN_4K_TOTAL,
      videoRes169: "4k" as const,
      videoRes916: "4k" as const,
    };
  }
  return {
    imageSize: "1K" as const,
    perImage: 10,
    perVideo: 100,
    emailBundle: 40,
    total: CREDIT_COSTS.FULL_CAMPAIGN_1K_TOTAL,
    videoRes169: "1080p" as const,
    videoRes916: "720p" as const,
  };
}

export function getEmailCreditCost(
  imageCount: 1 | 2 | 3,
  imageSize: "1K" | "4K"
): number {
  if (imageSize === "1K") {
    const costs: Record<number, number> = {
      1: 15,
      2: 30,
      3: 50,
    };
    return costs[imageCount] ?? 15;
  }
  if (imageSize === "4K") {
    const costs: Record<number, number> = {
      1: 25,
      2: 50,
      3: 75,
    };
    return costs[imageCount] ?? 25;
  }
  return 15;
}

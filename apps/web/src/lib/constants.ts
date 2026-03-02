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

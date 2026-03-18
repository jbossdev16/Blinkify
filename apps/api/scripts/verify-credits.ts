/**
 * Verify credit and pricing logic.
 * Run from apps/api: npm run verify-credits
 * (Uses dummy GEMINI_API_KEY so gemini client does not throw on import.)
 */
import { creditCost, emailCreditCost, IMAGE_SIZES } from "../src/lib/gemini.js";
import { videoCreditCost, VIDEO_RESOLUTIONS } from "../src/lib/veo.js";
import { getFullCampaignPricing } from "../src/lib/plan-config.js";

let failed = 0;

function ok(condition: boolean, label: string) {
  if (!condition) {
    console.error("FAIL:", label);
    failed++;
  } else {
    console.log("OK:", label);
  }
}

// Image: 1K = 10, 4K = 20
ok(IMAGE_SIZES.length === 2 && IMAGE_SIZES[0] === "1K" && IMAGE_SIZES[1] === "4K", "IMAGE_SIZES is [1K, 4K]");
ok(creditCost("1K") === 10, "creditCost(1K) === 10");
ok(creditCost("4K") === 20, "creditCost(4K) === 20");

// Email: 1K (1,2,3) = 15,30,50; 4K (1,2,3) = 25,50,75
ok(emailCreditCost("1K", 1) === 15, "emailCreditCost(1K, 1) === 15");
ok(emailCreditCost("1K", 2) === 30, "emailCreditCost(1K, 2) === 30");
ok(emailCreditCost("1K", 3) === 50, "emailCreditCost(1K, 3) === 50");
ok(emailCreditCost("4K", 1) === 25, "emailCreditCost(4K, 1) === 25");
ok(emailCreditCost("4K", 2) === 50, "emailCreditCost(4K, 2) === 50");
ok(emailCreditCost("4K", 3) === 75, "emailCreditCost(4K, 3) === 75");

// Video: 1080p = 50, 4k = 75
ok(VIDEO_RESOLUTIONS.length === 2 && VIDEO_RESOLUTIONS[0] === "1080p" && VIDEO_RESOLUTIONS[1] === "4k", "VIDEO_RESOLUTIONS is [1080p, 4k]");
ok(videoCreditCost("1080p") === 50, "videoCreditCost(1080p) === 50");
ok(videoCreditCost("4k") === 75, "videoCreditCost(4k) === 75");

const fc1 = getFullCampaignPricing("1K");
const fc4 = getFullCampaignPricing("4K");
ok(fc1.total === 300 && fc1.perImage === 10 && fc1.perVideo === 100 && fc1.emailBundle === 40, "full campaign 1K = 300");
ok(fc4.total === 500 && fc4.perImage === 25 && fc4.perVideo === 150 && fc4.emailBundle === 50, "full campaign 4K = 500");

if (failed > 0) {
  console.error("\n" + failed + " assertion(s) failed.");
  process.exit(1);
}
console.log("\nAll credit/pricing checks passed.");

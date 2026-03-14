"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const POLAR_CHECKOUT_MESSAGE_TYPE = "POLAR_CHECKOUT";
const POLAR_ORIGINS = ["https://polar.sh", "https://sandbox.polar.sh"];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

/* ─── 3D Marquee images (same as signup) ─── */
const baseImages = [
  "/blinkify-1770839372135.png",
  "/blinkify-1770839665605.png",
  "/Starbucks AFTER.png",
  "/blinkify-1770843387104.png",
  "/blinkify-1770843757047.png",
  "/Skincare%20Product.webp",
  "/Sneakers.webp",
  "/Watch.webp",
  "/Headphones.webp",
  "/Coffee%20Bag.webp",
  "/Sunglasses.webp",
];

function getInitialMarqueeImages(): string[] {
  const cols: string[] = [];
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < 6; i++) cols.push(baseImages[i % baseImages.length]!);
  }
  return cols;
}

function shuffleMarqueeImages(): string[] {
  const cols: string[][] = [];
  for (let c = 0; c < 4; c++) {
    const pool = [...baseImages];
    const col: string[] = [];
    for (let i = 0; i < 6; i++) {
      const available = pool.length > 0
        ? pool.filter((img) => img !== col[col.length - 1])
        : baseImages.filter((img) => img !== col[col.length - 1]);
      const pick = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]!
        : baseImages[i % baseImages.length]!;
      col.push(pick);
      const idx = pool.indexOf(pick);
      if (idx !== -1) pool.splice(idx, 1);
    }
    cols.push(col);
  }
  return cols.flat();
}

function useShuffledImages() {
  const [images, setImages] = useState<string[]>(getInitialMarqueeImages);
  useEffect(() => {
    setImages(shuffleMarqueeImages());
  }, []);
  return images;
}

/* ─── Plan definitions ─── */
type Benefit = { label: string; included: boolean };

interface Plan {
  key: string;
  name: string;
  price: string;
  priceNum: number;
  priceAnnual: number;
  description: string;
  popular: boolean;
  benefits: Benefit[];
}

const plans: Plan[] = [
  {
    key: "standard",
    name: "Standard",
    price: "$39",
    priceNum: 39,
    priceAnnual: 29,
    description: "For small businesses and freelancers.",
    popular: false,
    benefits: [
      { label: "400 Credits / Month", included: true },
      { label: "1 Brand", included: true },
      { label: "1 Team Member", included: true },
      { label: "Ad Creative Generation", included: true },
      { label: "AI Prompt Enhancement", included: true },
      { label: "Multiple Formats", included: true },
      { label: "AI Email Marketing", included: true },
    ],
  },
  {
    key: "professional",
    name: "Professional",
    price: "$119",
    priceNum: 119,
    priceAnnual: 97,
    description: "For brands ready to scale.",
    popular: true,
    benefits: [
      { label: "1,500 Credits / Month", included: true },
      { label: "3 Brands", included: true },
      { label: "1 Team Member", included: true },
      { label: "Ad Creative Generation", included: true },
      { label: "Product Video Shoot", included: true },
      { label: "All AI Assets Unlocked", included: true },
      { label: "24/7 Priority Support", included: true },
    ],
  },
  {
    key: "ultra",
    name: "Agency",
    price: "$397",
    priceNum: 397,
    priceAnnual: 297,
    description: "For agencies and teams.",
    popular: false,
    benefits: [
      { label: "5,000 Credits / Month", included: true },
      { label: "10 Brands", included: true },
      { label: "10 Team Members", included: true },
      { label: "Ad Creative Generation", included: true },
      { label: "All AI Assets Unlocked", included: true },
      { label: "24/7 Priority Support", included: true },
      { label: "Dedicated Account Manager", included: true },
    ],
  },
];

const professionalPlan = plans[1]!;

/* ─── Page ─── */
export default function SetupPlanPage() {
  const marqueeImages = useShuffledImages();
  const router = useRouter();

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(professionalPlan);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutEmbedUrl, setCheckoutEmbedUrl] = useState<string | null>(null);
  const isFirstBillingRender = useRef(true);

  useEffect(() => {
    createCheckoutSession(professionalPlan, "monthly");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (isFirstBillingRender.current) {
      isFirstBillingRender.current = false;
      return;
    }
    if (!selectedPlan) return;
    createCheckoutSession(selectedPlan, billingPeriod);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only when billing changes
  }, [billingPeriod]);

  useEffect(() => {
    if (!checkoutEmbedUrl) return;
    const handler = (event: MessageEvent) => {
      if (!POLAR_ORIGINS.includes(event.origin) || event.data?.type !== POLAR_CHECKOUT_MESSAGE_TYPE) return;
      const { event: ev } = event.data;
      if (ev === "success") {
        const url = event.data.successURL ?? "/signin?verified=true";
        router.push(url);
      }
      if (ev === "close") {
        setLoading(false);
        // Do not clear checkoutEmbedUrl — clicking outside the iframe can trigger
        // "close"; keep checkout visible so the user is not asked to select a plan again.
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [checkoutEmbedUrl, router]);

  const createCheckoutSession = useCallback(async (plan: Plan, billing: "monthly" | "annual") => {
    setLoading(true);
    setError("");
    try {
      const email = typeof window !== "undefined" ? sessionStorage.getItem("signup_email") ?? "" : "";
      const res = await fetch(`${API_URL}/checkout/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.key, billing, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create checkout session");
        setLoading(false);
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const sep = data.url.includes("?") ? "&" : "?";
      const embedUrl = `${data.url}${sep}embed=true&embed_origin=${encodeURIComponent(origin)}&theme=light`;
      setCheckoutEmbedUrl(embedUrl);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }, []);

  const handlePlanClick = useCallback((plan: Plan) => {
    setSelectedPlan(plan);
    createCheckoutSession(plan, billingPeriod);
  }, [createCheckoutSession, billingPeriod]);

  return (
    <div className="relative min-h-screen flex overflow-hidden">
      {/* Background: full-screen 3D marquee */}
      <div className="absolute inset-0 z-0 min-h-screen">
        <ThreeDMarquee
          images={marqueeImages}
          aspectRatio="9/16"
          className="h-full w-full min-h-screen rounded-none pointer-events-none"
        />
      </div>

      {/* Left: plan selection — white bg, centered like signup/login */}
      <div className="relative z-10 w-full lg:w-1/2 min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 bg-[#fff]" />
        <div className="relative z-10 w-full max-w-[400px] px-8">
          <p className="text-center text-sm mb-3" style={{ color: "#000000" }}>Cancel Any Time For FREE</p>
          <Link href="/" className="block w-full h-[50px] mb-8">
            <img
              src="/logo/blinkify-logo-color.svg"
              alt="Blinkify"
              className="w-full h-full object-contain"
            />
          </Link>
          {error && (
            <p className="text-xs text-destructive/90 font-medium mb-2 text-center" role="alert">
              {error}
            </p>
          )}
          {/* Billing period toggle — centered; Save 25% to the right of Annual */}
          <div className="flex shrink-0 justify-center items-center gap-2 mb-4">
            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex p-1 rounded-full bg-muted border border-border"
            >
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  billingPeriod === "monthly"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("annual")}
                className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  billingPeriod === "annual"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual
              </button>
            </div>
            <span className="bg-gradient-brand text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-md whitespace-nowrap" aria-hidden>
              Save 25%
            </span>
          </div>
          <div className="flex flex-col gap-3 w-full">
            {plans.map((plan) => {
              const isSelected = selectedPlan?.key === plan.key;
              return (
                <div key={plan.key} className="flex flex-col gap-0">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handlePlanClick(plan)}
                    className={cn(
                      "relative w-full border px-4 py-3 flex items-center justify-between transition-all cursor-pointer text-left",
                      "bg-white hover:border-primary/50",
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-border",
                      isSelected ? "rounded-t-xl" : "rounded-xl"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "size-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                        )}
                      >
                        {isSelected && <Check className="size-2.5 text-white" />}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                      {plan.popular && (
                        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          Most Popular
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      ${billingPeriod === "annual" ? plan.priceAnnual : plan.priceNum}
                      <span className="text-xs font-normal text-muted-foreground">/mo</span>
                    </span>
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-200 ease-out"
                    style={{ gridTemplateRows: isSelected ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden min-h-0">
                      <div className={cn(
                        "rounded-b-xl border border-t-0 bg-white px-4 pb-3 pt-2 -mt-px",
                        isSelected ? "border-primary" : "border-border"
                      )}>
                        <ul className="flex flex-col gap-1">
                          {plan.benefits.map((b) => (
                            <li key={b.label} className="flex items-center gap-2 py-1 text-sm" style={{ color: "#000000" }}>
                              <Check className="size-3.5 shrink-0" style={{ color: "#007aff" }} />
                              {b.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: embedded checkout — 50% width, full scale */}
      <div className="relative z-10 hidden lg:flex lg:w-1/2 min-h-screen h-screen flex-col overflow-hidden">
        <div className="absolute inset-0 bg-[#fff]" />
        {checkoutEmbedUrl ? (
          <div className="relative z-10 flex-1 min-h-0 w-full overflow-auto">
            <iframe
              src={checkoutEmbedUrl}
              title="Polar checkout"
              className="w-full min-h-full border-0 block"
              allow="payment 'self' https://polar.sh https://sandbox.polar.sh; publickey-credentials-get 'self' https://polar.sh https://sandbox.polar.sh"
            />
          </div>
        ) : (
          <div className="relative z-10 flex-1 flex items-center justify-center text-sm text-muted-foreground">
            {loading ? "Loading checkout…" : "Select a plan"}
          </div>
        )}
      </div>

      {/* Mobile: plan chips */}
      <div className="fixed bottom-0 left-0 right-0 z-20 lg:hidden bg-white border-t border-border p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {plans.map((plan) => (
            <button
              key={plan.key}
              type="button"
              disabled={loading}
              onClick={() => handlePlanClick(plan)}
              className={cn(
                "shrink-0 rounded-xl border border-border bg-white px-4 py-3 text-left min-w-[140px] cursor-pointer",
                "hover:border-primary/40 transition-colors",
                selectedPlan?.key === plan.key && "border-primary ring-2 ring-primary/20",
                plan.popular && "border-primary/30"
              )}
            >
              {plan.popular && (
                <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">Popular</span>
              )}
              <p className="text-sm font-semibold">{plan.name}</p>
              <p className="text-base font-bold">
                ${billingPeriod === "annual" ? plan.priceAnnual : plan.priceNum}
                <span className="text-xs font-normal text-muted-foreground">/mo</span>
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import { cn } from "@/lib/utils";
import { Check, Star, CreditCard, Lock, Sparkles } from "lucide-react";

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

      {/* Left: conversion-optimized plan selection — full white area */}
      <div className="relative z-10 w-full lg:w-1/2 min-h-screen flex items-center justify-center overflow-y-auto">
        <div className="absolute inset-0 bg-[#ffffff]" />
        <div className="relative z-10 w-full max-w-[520px] min-h-screen flex flex-col px-6 sm:px-8 py-8 sm:py-10">
          {/* Trust bar — fixed at top */}
          <div className="shrink-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-black pb-4 border-b border-zinc-100">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              Choose your plan
            </span>
            <span className="flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-primary" aria-hidden />
              Cancel Anytime
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="size-3.5 text-primary" aria-hidden />
              Secure Checkout
            </span>
          </div>

          {/* Centered block: logo, billing, plan cards, next-step hint */}
          <div className="flex-1 flex flex-col justify-center items-center">
            {/* Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <Link href="/" className="inline-block h-9 w-auto">
              <img src="/logo/blinkify-logo-color.svg" alt="Blinkify" className="h-full w-auto object-contain" />
            </Link>
          </div>

          {/* Billing toggle */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex p-1 rounded-full bg-zinc-100 border border-zinc-200"
            >
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={cn(
                  "px-4 py-2.5 rounded-full text-sm font-medium transition-all",
                  billingPeriod === "monthly"
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("annual")}
                className={cn(
                  "px-4 py-2.5 rounded-full text-sm font-medium transition-all",
                  billingPeriod === "annual"
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                    : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Annual
              </button>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-500 text-white text-xs font-semibold px-3 py-1" aria-hidden>
              Save 25%
            </span>
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium mb-3 text-center bg-red-50 py-2 px-3 rounded-lg" role="alert">
              {error}
            </p>
          )}

            {/* Plan cards — selected shows benefits inline */}
            <div className="flex flex-col gap-3 w-full">
            {plans.map((plan) => {
              const isSelected = selectedPlan?.key === plan.key;
              return (
                <div
                  key={plan.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => !loading && handlePlanClick(plan)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handlePlanClick(plan)}
                  aria-pressed={isSelected}
                  aria-label={`Select ${plan.name} plan, $${billingPeriod === "annual" ? plan.priceAnnual : plan.priceNum} per month`}
                  aria-disabled={loading}
                  className={cn(
                    loading && "pointer-events-none opacity-70",
                    "w-full rounded-2xl border-2 text-left transition-all cursor-pointer overflow-hidden",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md"
                  )}
                >
                  <div className="flex items-center justify-between p-4 sm:p-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "size-5 rounded-full border-2 flex items-center justify-center shrink-0",
                          isSelected ? "border-primary bg-primary" : "border-zinc-300 bg-white"
                        )}
                      >
                        {isSelected && <Check className="size-3 text-white" strokeWidth={2.5} />}
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-900">{plan.name}</span>
                        {plan.popular && (
                          <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                            Most popular
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-bold text-zinc-900">
                        ${billingPeriod === "annual" ? plan.priceAnnual : plan.priceNum}
                      </span>
                      <span className="text-sm font-normal text-zinc-500">/mo</span>
                    </div>
                  </div>
                  {/* Benefits — always visible when selected to reduce hesitation */}
                  {isSelected && (
                    <div className="border-t border-zinc-200/80 bg-white/80 px-4 sm:px-5 py-3">
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-zinc-700">
                        {plan.benefits.map((b) => (
                          <li key={b.label} className="flex items-center gap-2">
                            <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
                            {b.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
            </div>

            {/* Next-step hint when plan selected */}
            {selectedPlan && checkoutEmbedUrl && (
              <p className="mt-2 text-center text-sm text-zinc-500">
                You’re on <span className="font-medium text-zinc-700">{selectedPlan.name}</span>.
                <span className="lg:hidden"> Complete payment in the form below.</span>
                <span className="hidden lg:inline"> Complete payment in the form on the right →</span>
              </p>
            )}
          </div>

          {/* Mobile: embedded checkout below plan selection so users can complete payment */}
          <div className="lg:hidden w-full mt-6 flex flex-col">
            {checkoutEmbedUrl ? (
              <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden min-h-[min(70vh,600px)] flex flex-col">
                <p className="text-xs font-medium text-zinc-500 px-4 py-2 border-b border-zinc-100 shrink-0">
                  Secure checkout
                </p>
                <div className="flex-1 min-h-0 relative">
                  <iframe
                    src={checkoutEmbedUrl}
                    title="Polar checkout"
                    className="absolute inset-0 w-full h-full min-h-[min(65vh,550px)] border-0 block"
                    allow="payment 'self' https://polar.sh https://sandbox.polar.sh; publickey-credentials-get 'self' https://polar.sh https://sandbox.polar.sh"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 min-h-[200px] flex items-center justify-center text-sm text-zinc-500">
                {loading ? "Loading checkout…" : "Select a plan above"}
              </div>
            )}
          </div>

          {/* Social proof + security */}
          <div className="mt-4 pt-4 border-t border-zinc-100 shrink-0">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" aria-hidden />
              ))}
            </div>
            <p className="text-center text-xs font-medium text-zinc-600 mb-1">
              Trusted by 500+ small businesses
            </p>
            <p className="text-center text-xs text-zinc-500 flex items-center justify-center gap-1">
              <Lock className="size-3" aria-hidden />
              Secure payment by Stripe · Your card is safe
            </p>
          </div>
        </div>
      </div>

      {/* Right: embedded checkout — 50% width, full scale */}
      <div className="relative z-10 hidden lg:flex lg:w-1/2 min-h-screen h-screen flex-col overflow-hidden">
        <div className="absolute inset-0 bg-[#fff]" />
        {checkoutEmbedUrl ? (
          <div className="relative z-10 flex-1 min-h-0 w-full overflow-auto">
            <iframe
              src={checkoutEmbedUrl ?? ""}
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

    </div>
  );
}

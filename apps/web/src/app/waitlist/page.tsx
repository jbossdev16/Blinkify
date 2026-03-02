"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

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

const companyLogos = [
  { name: "Google", src: "/Google/Google_Logo_0.svg" },
  { name: "Microsoft", src: "/Microsoft/Microsoft_Logo_0.svg" },
  { name: "Amazon", src: "/Amazon/Amazon_Logo_0.svg" },
  { name: "Netflix", src: "/Netflix/Netflix_Logo_0.svg" },
  { name: "Shopify", src: "/Shopify.com/Shopify.com_Logo_0.svg" },
  { name: "NVIDIA", src: "/NVIDIA/NVIDIA_Logo_0.svg" },
  { name: "TikTok", src: "/TikTok/TikTok_Logo_0.svg" },
];

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const inputBase =
  "flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none";

export default function WaitlistPage() {
  const marqueeImages = useShuffledImages();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex overflow-hidden">
      <div className="absolute inset-0 z-0 min-h-screen">
        <ThreeDMarquee
          images={marqueeImages}
          aspectRatio="9/16"
          className="h-full w-full min-h-screen rounded-none pointer-events-none"
        />
      </div>

      <div className="relative z-10 w-full lg:w-1/2 min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 bg-white" />

        <div className="relative z-10 w-full max-w-[400px] px-8">
          <Link href="/" className="block w-full h-[50px] mb-8">
            <img src="/logo/blinkify-logo-color.svg" alt="Blinkify" className="w-full h-full object-contain" />
          </Link>

          {submitted ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckIcon className="text-green-600" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                You&apos;re on the list!
              </h1>
              <p className="text-sm text-muted-foreground">
                We&apos;ll notify you when Blinkify launches.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2">
                Join the Waitlist
              </h1>
              <p className="text-sm text-muted-foreground mb-8">
                Join hundreds of marketers and eCommerce teams getting early access to AI-powered ad creatives.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-1">
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="Email Address"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      className={cn(inputBase, "pr-11", error && "border-destructive/80")}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <EnvelopeIcon className="size-[18px]" />
                    </div>
                  </div>
                  {error && (
                    <p className="text-xs text-destructive/90 font-medium" role="alert">{error}</p>
                  )}
                </div>

                <Button type="submit" size="lg" className="w-full mt-2 font-semibold cursor-pointer" disabled={loading}>
                  {loading ? "Joining…" : "Join Waitlist"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="relative z-10 hidden lg:flex lg:w-1/2 min-h-screen flex-col pointer-events-auto">
        <div className="flex-1 relative">
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </div>
        <div className="relative bg-white py-5">
          <div className="relative overflow-hidden h-8">
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-linear-to-r from-white to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-linear-to-l from-white to-transparent z-10 pointer-events-none" />
            <div className="flex w-max animate-marquee items-center h-full">
              {companyLogos.map((company) => (
                <div key={company.name} className="shrink-0 w-[140px] h-6 flex items-center justify-center mx-3">
                  <img src={company.src} alt={company.name} className="h-full w-full object-contain opacity-40 grayscale" />
                </div>
              ))}
              {companyLogos.map((company) => (
                <div key={`${company.name}-dup`} className="shrink-0 w-[140px] h-6 flex items-center justify-center mx-3">
                  <img src={company.src} alt={company.name} className="h-full w-full object-contain opacity-40 grayscale" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

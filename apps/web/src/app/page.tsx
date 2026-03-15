"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL === "https://blinkify.ai"
    ? "https://app.blinkify.ai"
    : "";

const LandingBelowFold = dynamic(
  () => import("@/components/landing/landing-below-fold"),
  {
    loading: () => <div className="min-h-[50vh] bg-[#ffffff]" aria-hidden />,
  }
);

/* ─────────────────────────────────────────────
   DEMO VIDEO PLAYER
───────────────────────────────────────────── */
const DEMO_VIDEO_SRC = "/blinkify-demo.webm";

function DemoVideoPlayer({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    v.addEventListener("pause", onPause);
    v.addEventListener("play", onPlay);
    return () => { v.removeEventListener("pause", onPause); v.removeEventListener("play", onPlay); };
  }, []);

  return (
    <div className={cn("relative w-full h-full cursor-pointer group", className)} onClick={toggle}>
      <video
        ref={videoRef}
        src={DEMO_VIDEO_SRC}
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20 transition-opacity">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Play className="h-7 w-7 md:h-9 md:w-9 text-black ml-1" fill="currentColor" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPANY LOGOS
───────────────────────────────────────────── */
const companyLogos = [
  { name: "NVIDIA", src: "/NVIDIA/NVIDIA_Logo_0.svg" },
  { name: "Microsoft", src: "/Microsoft/Microsoft_Logo_0.svg" },
  { name: "Amazon", src: "/Amazon/Amazon_Logo_0.svg" },
  { name: "Netflix", src: "/Netflix/Netflix_Logo_0.svg" },
  { name: "Shopify", src: "/Shopify.com/Shopify.com_Logo_0.svg" },
  { name: "Google", src: "/Google/Google_Logo_0.svg" },
  { name: "TikTok", src: "/TikTok/TikTok_Logo_0.svg" },
];

/* ─────────────────────────────────────────────
   TYPING SEARCH BAR
───────────────────────────────────────────── */
const PLACEHOLDER_SITES = [
  "yourwebsite.com",
  "starbucks.com",
  "instagram.com",
  "linkedin.com",
  "acme.com",
];
const TYPING_SPEED = 80;
const HOLD_DURATION = 1000;

function TypingSearchBar() {
  const [displayText, setDisplayText] = useState("");
  const [userInput, setUserInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const animatingRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let idx = 0;
    let charPos = 0;
    let deleting = false;
    animatingRef.current = true;

    function tick() {
      if (!animatingRef.current) return;
      const word = PLACEHOLDER_SITES[idx];
      if (!deleting) {
        charPos++;
        setDisplayText(word.slice(0, charPos));
        if (charPos >= word.length) {
          deleting = true;
          timeoutRef.current = setTimeout(tick, HOLD_DURATION);
          return;
        }
      } else {
        charPos--;
        setDisplayText(word.slice(0, charPos));
        if (charPos <= 0) {
          deleting = false;
          idx = (idx + 1) % PLACEHOLDER_SITES.length;
          timeoutRef.current = setTimeout(tick, HOLD_DURATION);
          return;
        }
      }
      timeoutRef.current = setTimeout(tick, TYPING_SPEED);
    }

    timeoutRef.current = setTimeout(tick, HOLD_DURATION);
    return () => {
      animatingRef.current = false;
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    animatingRef.current = false;
    clearTimeout(timeoutRef.current);
    setDisplayText("");
  };

  const handleBlur = () => {
    if (!userInput) setIsFocused(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = `${APP_BASE}/signup${userInput ? `?website=${encodeURIComponent(userInput)}` : ""}`;
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      <div className="flex items-center rounded-full border-2 border-black/[0.08] bg-white shadow-lg shadow-black/[0.04] overflow-hidden h-14 pl-5 pr-1.5">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-full bg-transparent text-base text-[#000000] outline-none placeholder-transparent"
            placeholder="yourwebsite.com"
          />
          {!isFocused && !userInput && (
            <span className="pointer-events-none absolute inset-0 flex items-center text-base text-black/40">
              {displayText}
              <span className="inline-block w-[2px] h-5 bg-black/40 ml-[1px] animate-pulse" />
            </span>
          )}
        </div>
        <button
          type="submit"
          className="shrink-0 inline-flex items-center justify-center rounded-full bg-[#007aff] hover:bg-[#0066dd] text-white text-base font-semibold px-6 h-10 transition-colors ml-2"
        >
          Get Started
        </button>
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────
   HERO SECTION - Centered text over demo video
───────────────────────────────────────────── */
function HeroSection() {
  const leftMessages: { label: string; color: string }[] = [
    { label: "Higher Ad Conversion", color: "text-[#7c3aed]" },
    { label: "Lower Cost", color: "text-[#2563eb]" },
    { label: "10x More Content", color: "text-[#db2777]" },
  ];
  const rightMessages: { label: string; color: string }[] = [
    { label: "No Designer Needed", color: "text-[#059669]" },
    { label: "Brand-Consistent", color: "text-[#7c3aed]" },
    { label: "Launch in Minutes", color: "text-[#dc2626]" },
  ];

  const MessagePill = ({ label, color, tilt }: { label: string; color: string; tilt: string }) => (
    <span className={cn("rounded-full bg-white px-4 py-2.5 text-xs font-semibold shadow-lg border border-black/5 whitespace-nowrap", color, tilt)}>
      {label}
    </span>
  );

  return (
    <section className="relative flex-none md:flex-1 bg-[#ffffff] overflow-x-hidden">
      <div className="relative z-10 max-w-[1200px] mx-auto px-4 pt-18 pb-12 lg:pt-24 lg:pb-28">
        {/* On md+: row with [left pills] [center] [right pills] */}
        <div className="hidden md:flex md:items-center md:justify-between md:gap-8">
          <div className="flex flex-col gap-3 shrink-0 pointer-events-none z-20 w-[160px] items-end justify-center">
            <MessagePill label={leftMessages[0].label} color={leftMessages[0].color} tilt="-rotate-2 self-end" />
            <MessagePill label={leftMessages[1].label} color={leftMessages[1].color} tilt="rotate-1 self-start ml-4" />
            <MessagePill label={leftMessages[2].label} color={leftMessages[2].color} tilt="-rotate-2 self-end" />
          </div>

          <div className="relative max-w-3xl mx-auto text-center flex-1 min-w-0">
            <div
              className="pointer-events-none absolute inset-[-40px] sm:inset-[-56px] -z-10 blur-3xl opacity-90"
              aria-hidden
            >
              <div className="mx-auto h-full w-full max-w-2xl bg-[radial-gradient(ellipse_80%_50%_at_20%_30%,rgba(59,130,246,0.25),_transparent_50%),radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.2),_transparent_55%),radial-gradient(ellipse_70%_50%_at_80%_70%,rgba(249,115,22,0.2),_transparent_50%),radial-gradient(ellipse_50%_50%_at_70%_20%,rgba(239,68,68,0.15),_transparent_55%)]" />
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-2">
              Ad creatives that convert,
            </h1>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-6 md:mb-7">
              <span className="text-gradient-brand">10x Faster & Cheaper.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#000000] max-w-xl mx-auto mb-7 md:mb-8 leading-relaxed">
              Upload once, get scroll-stopping visuals in seconds.
            </p>
            <TypingSearchBar />
          </div>

          <div className="flex flex-col gap-3 shrink-0 pointer-events-none z-20 w-[160px] items-start justify-center">
            <MessagePill label={rightMessages[0].label} color={rightMessages[0].color} tilt="rotate-2 self-start" />
            <MessagePill label={rightMessages[1].label} color={rightMessages[1].color} tilt="-rotate-1 self-end mr-4" />
            <MessagePill label={rightMessages[2].label} color={rightMessages[2].color} tilt="rotate-2 self-start" />
          </div>
        </div>

        {/* Mobile: center content only */}
        <div className="md:hidden relative max-w-3xl mx-auto text-center">
          <div
            className="pointer-events-none absolute inset-[-40px] sm:inset-[-56px] -z-10 blur-3xl opacity-90"
            aria-hidden
          >
            <div className="mx-auto h-full w-full max-w-2xl bg-[radial-gradient(ellipse_80%_50%_at_20%_30%,rgba(59,130,246,0.25),_transparent_50%),radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.2),_transparent_55%),radial-gradient(ellipse_70%_50%_at_80%_70%,rgba(249,115,22,0.2),_transparent_50%),radial-gradient(ellipse_50%_50%_at_70%_20%,rgba(239,68,68,0.15),_transparent_55%)]" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-2">
            Ad creatives that convert,
          </h1>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-6 md:mb-7">
            <span className="text-gradient-brand">10x Faster & Cheaper.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#000000] max-w-xl mx-auto mb-7 md:mb-8 leading-relaxed">
            Upload once, get scroll-stopping visuals in seconds.
          </p>
          <TypingSearchBar />
        </div>

        {/* Demo video: even spacing from hero content */}
        <div className="relative mt-18 sm:mt-20 lg:mt-28">
          <div className="relative w-full rounded-xl border border-black/5 bg-slate-100 overflow-hidden aspect-[16/9]">
            <DemoVideoPlayer />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   COMPANIES MARQUEE SECTION (separate from hero)
───────────────────────────────────────────── */
function CompaniesMarqueeSection() {
  const [hoveredCompany, setHoveredCompany] = useState<string | null>(null);
  return (
    <section className="py-0 bg-[#ffffff] p-1">
      <div className="max-w-[1200px] mx-auto w-full">
        <div className="w-full m-0">
          <div className="py-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center mb-2">
              LEADING COMPANIES USE AI FOR CREATIVES
            </p>
            <div
              className="relative overflow-hidden h-[72px] [mask-image:linear-gradient(to_right,transparent_0,black_60px,black_calc(100%-60px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_60px,black_calc(100%-60px),transparent_100%)]"
            >
              <div className="flex w-max animate-marquee items-center h-full">
                {companyLogos.map((company) => (
                  <div
                    key={company.name}
                    className="shrink-0 w-[120px] h-6 flex items-center justify-center mx-3"
                    onMouseEnter={() => setHoveredCompany(company.name)}
                    onMouseLeave={() => setHoveredCompany(null)}
                  >
                    <Image
                      src={company.src}
                      alt={company.name}
                      width={120}
                      height={24}
                      className={cn(
                        "max-h-full max-w-full w-auto h-auto object-contain object-center transition-all duration-300",
                        hoveredCompany !== null && hoveredCompany !== company.name && "opacity-40 grayscale"
                      )}
                    />
                  </div>
                ))}
                {companyLogos.map((company) => (
                  <div
                    key={`${company.name}-dup`}
                    className="shrink-0 w-[120px] h-6 flex items-center justify-center mx-3"
                    onMouseEnter={() => setHoveredCompany(company.name)}
                    onMouseLeave={() => setHoveredCompany(null)}
                  >
                    <Image
                      src={company.src}
                      alt={company.name}
                      width={120}
                      height={24}
                      className={cn(
                        "max-h-full max-w-full w-auto h-auto object-contain object-center transition-all duration-300",
                        hoveredCompany !== null && hoveredCompany !== company.name && "opacity-40 grayscale"
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CONTENT GUIDE LINES (Stripe-style)
───────────────────────────────────────────── */
function ContentGuideLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] hidden md:flex justify-center"
    >
      <div className="w-full max-w-[1200px] mx-auto h-full flex">
        <div className="flex-1" />
      </div>
    </div>
  );
}

function SectionDivider() {
  return (
    <div aria-hidden className="hidden md:block max-w-[1200px] mx-auto w-full">
      <div className="h-px" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function Home() {
  return (
    <>
      <ContentGuideLines />
      <LandingHeader />
      <div aria-hidden className="w-full shrink-0">
        <div className="h-px w-full" />
      </div>
      <main className="bg-[#ffffff]">
        <div className="min-h-0 md:min-h-[calc(100svh-68px)] flex flex-col">
          <div className="flex-none md:flex-1 flex flex-col min-h-0">
            <HeroSection />
          </div>
          <div className="hidden md:block">
            <CompaniesMarqueeSection />
          </div>
        </div>
        <div className="md:hidden">
          <CompaniesMarqueeSection />
        </div>
        <SectionDivider />
        <LandingBelowFold />
      </main>
      <div aria-hidden className="w-full shrink-0">
        <div className="h-px w-full" />
      </div>
      <LandingFooter />
    </>
  );
}

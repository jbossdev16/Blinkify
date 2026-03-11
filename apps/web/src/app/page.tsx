"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card-legacy";
import { Store, ShoppingCart, Users, ArrowRight, Check, X, Palette, Target, Zap, Lock, ChevronDown, Play } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { BlinkifyLogo } from "@/components/blinkify-logo";
import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";
import React, { useState, useRef, useEffect, forwardRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";

const OrbitingCircles = dynamic(
  () => import("@/components/ui/orbiting-circles").then((m) => ({ default: m.OrbitingCircles })),
  { ssr: false }
);
const AnimatedBeam = dynamic(
  () => import("@/components/ui/animated-beam").then((m) => ({ default: m.AnimatedBeam })),
  { ssr: false }
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
      <div className="relative z-10 max-w-[1200px] mx-auto px-4 pt-10 pb-12 lg:pt-14 lg:pb-20">
        {/* On md+: row with [left pills] [center] [right pills] so pills align with center content */}
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

            <p className="inline-flex items-center rounded-full border border-black/[0.08] bg-white/80 px-3 py-1 text-xs font-medium text-[#000000] shadow-sm mb-4">
              Feel the future of Ad Creatives.
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-2">
              Better Ad Creatives,
            </h1>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-6 md:mb-7">
              <span className="text-gradient-brand">10x Faster & Cheaper.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#000000] max-w-xl mx-auto mb-7 md:mb-8 leading-relaxed">
              Upload once, get scroll-stopping visuals in seconds.
            </p>
            <div className="flex flex-col sm:inline-flex sm:flex-row sm:items-center sm:justify-center gap-3 sm:gap-4">
              <Link
                href="/#how-it-works"
                className="inline-flex items-center justify-center rounded-md border-2 border-transparent bg-white px-8 h-11 text-base font-semibold text-[#000000] transition-colors hover:bg-slate-50 [background:linear-gradient(white,white)_padding-box,linear-gradient(135deg,#0079d0_0,#9e52d8_32%,#da365c_84%,#d04901_100%)_border-box]"
              >
                Learn More
              </Link>
              <Button asChild size="lg" className="text-base font-semibold px-8 h-11 rounded-md bg-[#007aff] hover:bg-[#0066dd] border-0 text-white">
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
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
          <p className="inline-flex items-center rounded-full border border-black/[0.08] bg-white/80 px-3 py-1 text-xs font-medium text-[#000000] shadow-sm mb-4">
            Feel the future of Ad Creatives.
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-2">
            Better Ad Creatives,
          </h1>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight tracking-tight text-foreground mb-6 md:mb-7">
            <span className="text-gradient-brand">10x Faster & Cheaper.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#000000] max-w-xl mx-auto mb-7 md:mb-8 leading-relaxed">
            Upload once, get scroll-stopping visuals in seconds.
          </p>
          <div className="flex flex-col sm:inline-flex sm:flex-row sm:items-center sm:justify-center gap-3 sm:gap-4">
            <Link
              href="/#how-it-works"
              className="inline-flex items-center justify-center rounded-md border-2 border-transparent bg-white px-8 h-11 text-base font-semibold text-[#000000] transition-colors hover:bg-slate-50 [background:linear-gradient(white,white)_padding-box,linear-gradient(135deg,#0079d0_0,#9e52d8_32%,#da365c_84%,#d04901_100%)_border-box]"
            >
              Learn More
            </Link>
            <Button asChild size="lg" className="text-base font-semibold px-8 h-11 rounded-md bg-[#007aff] hover:bg-[#0066dd] border-0 text-white">
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative mt-8 sm:mt-10 lg:mt-12">
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
              Companies leveraging Gen AI
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
                    <img
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
                    <img
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
   VISUAL DEMO (Marquee)
───────────────────────────────────────────── */
const demoImages = [
  {
    id: 1,
    title: "Skincare Product",
    before: "Raw product photo",
    after: "Premium lifestyle shot",
    imageRaw: "/Skincare%20Product%20RAW.webp",
    imageEdited: "/Skincare%20Product.webp",
  },
  {
    id: 2,
    title: "Sneakers",
    before: "Plain background",
    after: "Dynamic action shot",
    imageRaw: "/Sneakers%20RAW.webp",
    imageEdited: "/Sneakers.webp",
  },
  {
    id: 3,
    title: "Watch",
    before: "Simple photo",
    after: "Luxury studio lighting",
    imageRaw: "/Watch%20RAW.webp",
    imageEdited: "/Watch.webp",
  },
  {
    id: 4,
    title: "Headphones",
    before: "Basic image",
    after: "Stylized ad creative",
    imageRaw: "/Headphones%20RAW.webp",
    imageEdited: "/Headphones.webp",
  },
  {
    id: 5,
    title: "Coffee Bag",
    before: "Product only",
    after: "Lifestyle scene",
    imageRaw: "/Coffee%20Bag%20RAW.webp",
    imageEdited: "/Coffee%20Bag.webp",
  },
  {
    id: 6,
    title: "Sunglasses",
    before: "Flat lay",
    after: "Fashion editorial",
    imageRaw: "/Sunglasses%20RAW.webp",
    imageEdited: "/Sunglasses.webp",
  },
];

function ImageCard({ item, imageType }: { item: typeof demoImages[0]; imageType: "raw" | "edited" }) {
  const imageSrc = imageType === "raw" ? item.imageRaw : item.imageEdited;
  return (
    <div className="shrink-0 w-[320px]">
      <BlurFade inView inViewMargin="-30px">
        <Card className="overflow-hidden shadow-none h-full">
          <div className="aspect-9/16 relative overflow-hidden bg-slate-100">
            <Image
              src={imageSrc}
              alt={`${item.title} - ${imageType === "raw" ? "Before" : "After"}`}
              width={320}
              height={569}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
              loading="lazy"
              sizes="320px"
            />
          </div>
        </Card>
      </BlurFade>
    </div>
  );
}

function VisualDemoSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rawTrackRef = useRef<HTMLDivElement>(null);
  const editedTrackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startOffsetRef.current = dragOffset;
    // Pause animations
    if (rawTrackRef.current) rawTrackRef.current.style.animationPlayState = "paused";
    if (editedTrackRef.current) editedTrackRef.current.style.animationPlayState = "paused";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - startXRef.current;
    setDragOffset(startOffsetRef.current + delta);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // Resume animations
    if (rawTrackRef.current) rawTrackRef.current.style.animationPlayState = "running";
    if (editedTrackRef.current) editedTrackRef.current.style.animationPlayState = "running";
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startXRef.current = e.touches[0].clientX;
    startOffsetRef.current = dragOffset;
    if (rawTrackRef.current) rawTrackRef.current.style.animationPlayState = "paused";
    if (editedTrackRef.current) editedTrackRef.current.style.animationPlayState = "paused";
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientX - startXRef.current;
    setDragOffset(startOffsetRef.current + delta);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (rawTrackRef.current) rawTrackRef.current.style.animationPlayState = "running";
    if (editedTrackRef.current) editedTrackRef.current.style.animationPlayState = "running";
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (rawTrackRef.current) rawTrackRef.current.style.animationPlayState = "running";
        if (editedTrackRef.current) editedTrackRef.current.style.animationPlayState = "running";
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("touchend", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchend", handleGlobalMouseUp);
    };
  }, [isDragging]);

  return (
    <section className="py-24 bg-[#ffffff] overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-h2 text-foreground mb-4 max-w-[700px] mx-auto">
            Create Stunning Visuals{" "}
            <span className="text-gradient-brand">in a Blink</span>
          </h2>
          <p className="text-muted-foreground max-w-[520px] mx-auto font-normal">
            From product photo to ad-ready creative in a blink.
          </p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4">
        <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent_0,black_80px,black_calc(100%-80px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_80px,black_calc(100%-80px),transparent_100%)]">
          <div
            ref={containerRef}
            className="w-full relative overflow-hidden select-none"
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Raw images layer - visible on left of diagonal (bottom-left to top-right) */}
            <div
              className="absolute inset-0 overflow-hidden z-0"
              style={{ clipPath: "polygon(0 0, 55% 0, 45% 100%, 0 100%)" }}
            >
              <div
                ref={rawTrackRef}
                className="flex w-max animate-marquee-reverse items-stretch gap-6 pl-6"
                style={{ transform: `translateX(${dragOffset}px)` }}
              >
                {demoImages.map((item) => (
                  <ImageCard key={item.id} item={item} imageType="raw" />
                ))}
                {demoImages.map((item) => (
                  <ImageCard key={`${item.id}-dup`} item={item} imageType="raw" />
                ))}
              </div>
            </div>

            {/* Edited images layer - visible on right of diagonal */}
            <div
              className="relative z-0"
              style={{ clipPath: "polygon(55% 0, 100% 0, 100% 100%, 45% 100%)" }}
            >
              <div
                ref={editedTrackRef}
                className="flex w-max animate-marquee-reverse items-stretch gap-6 pl-6"
                style={{ transform: `translateX(${dragOffset}px)` }}
              >
                {demoImages.map((item) => (
                  <ImageCard key={item.id} item={item} imageType="edited" />
                ))}
                {demoImages.map((item) => (
                  <ImageCard key={`${item.id}-dup`} item={item} imageType="edited" />
                ))}
              </div>
            </div>

            {/* Diagonal white line from bottom-left to top-right */}
            <svg
              className="absolute inset-0 w-full h-full z-10 pointer-events-none"
              preserveAspectRatio="none"
            >
              <line x1="45%" y1="100%" x2="55%" y2="0%" stroke="white" strokeWidth="6" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-16">
        <Button asChild size="lg" className="text-base font-medium px-8">
          <Link href="/signup">
            Start Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   HOW IT WORKS
───────────────────────────────────────────── */
const howItWorksSteps: {
  title: string;
  description: string;
  video: string;
  videoParts?: [string, string];
}[] = [
  {
    title: "1. Signup",
    description: "Create your account and get started in seconds.",
    video: "/howitworks1.webm",
  },
  {
    title: "2. Apply your brand options",
    description: "Add your brand colors, fonts, and guidelines so every creative stays on-brand.",
    video: "/howitworks2.webm",
  },
  {
    title: "3. Get high converting Ad Creatives in a Blink",
    description: "Generate multiple ad-ready variations for Meta, Google, and your store.",
    video: "/howitworks3a.webm",
    videoParts: ["/howitworks3a.webm", "/howitworks3b.webm"],
  },
];

/** Single-source looping video (steps 1 & 2). */
function StepVideo({ src }: { src: string }) {
  return (
    <video
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      className="h-full w-full object-cover"
    />
  );
}

/** Two-part video: plays part A once, then loops part B. */
function StepVideoTwoPart({ parts }: { parts: [string, string] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [showB, setShowB] = useState(false);
  const hasPlayedA = useRef(false);

  useEffect(() => {
    const vA = videoARef.current;
    const vB = videoBRef.current;
    if (!vA || !vB) return;

    const onEndA = () => {
      hasPlayedA.current = true;
      setShowB(true);
      vB.currentTime = 0;
      vB.play().catch(() => {});
    };

    vA.addEventListener("ended", onEndA);
    return () => vA.removeEventListener("ended", onEndA);
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <video
        ref={videoARef}
        src={parts[0]}
        autoPlay
        muted
        playsInline
        preload="metadata"
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", showB ? "opacity-0 pointer-events-none" : "opacity-100")}
      />
      <video
        ref={videoBRef}
        src={parts[1]}
        loop
        muted
        playsInline
        preload="metadata"
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", showB ? "opacity-100" : "opacity-0 pointer-events-none")}
      />
    </div>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="space-y-8 md:space-y-10">
          {howItWorksSteps.map((step, i) => {
            const imageLeft = i % 2 === 1;
            return (
            <div
              key={step.title}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center bg-white rounded-2xl p-6 md:p-8"
            >
              <div className={`min-w-0 order-2 ${imageLeft ? "md:order-2" : "md:order-1"}`}>
                <h3 className="text-xl md:text-2xl font-medium tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-slate-600 font-normal leading-relaxed">
                  {step.description}
                </p>
              </div>
              <BlurFade inView inViewMargin="-40px" delay={i * 0.08} className={`relative overflow-hidden rounded-xl bg-slate-100 order-1 aspect-4/3 w-full border border-black/5 ${imageLeft ? "md:order-1" : "md:order-2"}`}>
                {step.videoParts ? (
                  <StepVideoTwoPart parts={step.videoParts} />
                ) : (
                  <StepVideo src={step.video} />
                )}
              </BlurFade>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   WHO IT'S FOR
───────────────────────────────────────────── */
const audiences = [
  {
    icon: Store,
    title: "Small Businesses",
    description:
      "No design team? No problem. Auto-generate professional product images, branded and ready to use.",
  },
  {
    icon: ShoppingCart,
    title: "eCommerce Stores",
    description:
      "Shopify, WooCommerce, and more. Upload products → get consistent, high-quality images + carousel layouts.",
  },
  {
    icon: Users,
    title: "Agencies",
    description:
      "Fast turnaround for multiple clients. Bulk upload → generate branded variations → save design hours.",
  },
];

function WhoItsForSection() {
  return (
    <section id="who-its-for" className="py-24 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-h2 font-medium tracking-tight text-foreground mb-4 max-w-[600px] mx-auto">
            Who It&apos;s For
          </h2>
          <p className="text-slate-600 max-w-[520px] mx-auto font-normal">
            Built for teams that need high-quality visuals without the overhead
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {audiences.map((audience, i) => (
            <BlurFade key={audience.title} inView inViewMargin="-40px" delay={i * 0.1}>
              <Card className="relative overflow-visible bg-white border border-black/5 rounded-2xl shadow-none hover:shadow-xs transition-shadow p-6 md:p-7">
                <div className="absolute inset-0 rounded-[inherit] z-10 pointer-events-none">
                  <BorderBeam size={80} duration={8} />
                </div>
                <CardHeader className="p-0 pb-4 relative z-0">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4">
                    <audience.icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-h4 font-medium">{audience.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-body text-slate-600 font-normal leading-relaxed">
                    {audience.description}
                  </p>
                </CardContent>
              </Card>
            </BlurFade>
          ))}
        </div>

        <div className="flex justify-center mt-16">
          <Button asChild size="lg" className="text-base font-medium px-8">
            <Link href="/signup">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   VALUE SECTION – central visual + 4 benefit cards
───────────────────────────────────────────── */
const valueCards: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  visual: "palette" | "target" | "zap" | "lock";
}[] = [
  {
    title: "Stays On Brand",
    description: "Your colors, tone, and aesthetics. Every asset feels like it came from inside your team.",
    icon: Palette,
    visual: "palette",
  },
  {
    title: "Your Data Stays Yours",
    description: "Brand assets and inputs are never shared or trained on. Private by default.",
    icon: Lock,
    visual: "lock",
  },
  {
    title: "Scales Creative Output",
    description: "Go from one product to dozens of ad variations in minutes. No design bottleneck.",
    icon: Zap,
    visual: "zap",
  },
  {
    title: "Built for Performance",
    description: "Creatives tuned for the platforms and audiences that convert—Meta, Google, TikTok, and more.",
    icon: Target,
    visual: "target",
  },
];

const platformLogos = [
  { name: "Shopify", src: "/Shopify.com/Shopify.com_Symbol_12.svg" },
  { name: "Facebook", src: null },
  { name: "Google", src: "/Google/Google_Symbol_3.svg" },
  { name: "TikTok", src: "/TikTok/TikTok_Symbol_30.svg" },
  { name: "Instagram", src: "/Instagram/Instagram_Symbol_0.svg" },
  { name: "X", src: "/X/X_idJxGuURW1_0.svg" },
];

function ValueSection() {
  return (
    <section id="value" className="relative py-24 bg-[#ffffff]">
      <div
        className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-90 flex items-center justify-center"
        aria-hidden
      >
        <div className="w-full max-w-md h-64 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(59,130,246,0.25),_transparent_50%),radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.2),_transparent_55%),radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(249,115,22,0.2),_transparent_50%),radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(239,68,68,0.15),_transparent_55%)]" />
      </div>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="brandGradientLanding" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0079d0" />
            <stop offset="33%" stopColor="#9e52d8" />
            <stop offset="66%" stopColor="#da365c" />
            <stop offset="100%" stopColor="#d04901" />
          </linearGradient>
        </defs>
      </svg>
      <div className="max-w-[1200px] mx-auto px-4 relative z-10">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-h2 font-medium tracking-tight text-foreground mb-3 max-w-[560px] mx-auto">
            Built for Your Brand
          </h2>
          <p className="text-slate-600 max-w-[520px] mx-auto text-base md:text-lg font-normal">
            From brand tone to product style. Blinkify learns what makes you unique—then generates creatives that match.
          </p>
        </div>

        <div className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8 items-stretch md:items-center">
          {/* Left column: 2 cards */}
          <div className="order-1 flex flex-col gap-6 md:gap-8">
            {valueCards.slice(0, 2).map((card, i) => (
              <BlurFade key={card.title} inView inViewMargin="-40px" delay={i * 0.08}>
                <ValueCard card={card} />
              </BlurFade>
            ))}
          </div>

          {/* Center: Blinkify icon – between card 2 and 3 on mobile */}
          <BlurFade inView inViewMargin="-40px" delay={0.12} className="order-2 flex shrink-0 items-center justify-center my-2 md:my-0">
            <div className="rounded-2xl border border-black/5 bg-[#ffffff] p-6 md:p-8 shadow-[0_0_40px_-12px_rgba(0,0,0,0.08)]">
              <BlinkifyLogo variant="icon" height={80} className="object-contain" />
            </div>
          </BlurFade>

          {/* Right column: 2 cards – icon on left */}
          <div className="order-3 flex flex-col gap-6 md:gap-8">
            {valueCards.slice(2, 4).map((card, i) => (
              <BlurFade key={card.title} inView inViewMargin="-40px" delay={(i + 2) * 0.08}>
                <ValueCard card={card} iconOnLeft />
              </BlurFade>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformLogosRow() {
  return (
    <div className="flex items-center gap-3">
      {platformLogos.map((p) =>
        p.src ? (
          <img key={p.name} src={p.src} alt={p.name} className="h-6 w-6 object-contain shrink-0" />
        ) : (
          <span key={p.name} className={`flex h-6 w-6 shrink-0 items-center justify-center ${p.name === "Facebook" ? "text-[#1877F2]" : "text-foreground"}`} aria-label={p.name}>
            {p.name === "Facebook" && (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            )}
          </span>
        )
      )}
    </div>
  );
}

function ValueCard({
  card,
  iconOnLeft,
}: {
  card: (typeof valueCards)[number];
  iconOnLeft?: boolean;
}) {
  const Icon = card.icon;
  const iconEl = (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconOnLeft ? "" : "ml-auto"}`}>
      <Icon className="h-10 w-10 text-[#007AFF]" />
    </div>
  );
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 md:p-7 shadow-none hover:shadow-xs transition-all duration-200 hover:-translate-y-0.5 relative overflow-visible">
      {card.visual === "zap" && (
        <div className="absolute inset-0 rounded-[inherit] z-10 pointer-events-none">
          <BorderBeam size={80} duration={8} />
        </div>
      )}
      <h3 className="text-lg font-medium text-foreground mb-2 relative z-10">{card.title}</h3>
      <p className="text-slate-600 text-sm md:text-base font-normal leading-relaxed mb-5 relative z-10">
        {card.description}
      </p>
      <div className="flex items-center gap-2 relative z-10">
        {iconOnLeft && iconEl}
        {card.visual === "palette" && (
          <div className="flex gap-1">
            {["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#ef4444"].map((c) => (
              <div key={c} className="h-6 w-6 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: c }} />
            ))}
          </div>
        )}
        {card.visual === "target" && (
          <div className={iconOnLeft ? "ml-auto" : ""}>
            <PlatformLogosRow />
          </div>
        )}
        {!iconOnLeft && iconEl}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   AI CREATIVES CAROUSEL (3 rows: row1 9:16 images+videos R→L, row2 16:9 videos L→R, row3 4:5/1:1 images R→L)
───────────────────────────────────────────── */
const carouselImages9x16 = [
  "/blinkify-1771103967464.webp",
  "/blinkify-1771027611405.webp",
  "/blinkify-2-1771678793306.webp",
  "/blinkify-1-1771440155212.webp",
];

const carouselVideos9x16 = [
  "/blinkify-video-3235da29.mp4",
  "/blinkify-video-8daaf9f4.mp4",
];

const carouselVideos16x9 = [
  "/blinkify-video-8daaf9f4.mp4",
  "/blinkify-video-74541ceb.mp4",
  "/blinkify-video-e64682ce.mp4",
  "/blinkify-video-1771438910604.mp4",
  "/7beb3a7c-7632-4e91-8ba5-873620e7a7fd%20(1).mp4",
];

/** Row 3: 4:5 or 1:1 images */
const carouselRow3Images = [
  "/blinkify-1771182527688.webp",
  "/blinkify-1771018883317.webp",
  "/blinkify-1771181704771.webp",
  "/blinkify-1771182966232.webp",
  "/blinkify-1771184047178.webp",
  "/blinkify-1771183902474.webp",
  "/blinkify-email-2-1771668188680.webp",
  "/blinkify-1-1771439178300.webp",
  "/blinkify-1771181814642.webp",
  "/blinkify-1771183222672.webp",
  "/blinkify-1771183526417.webp",
  "/blinkify-1771182573050.webp",
  "/blinkify-2-1771676875776.webp",
];

/** Row 3 images that should zoom to fill the card (object-cover); rest use object-contain */
const carouselRow3ZoomFit = new Set(["/blinkify-2-1771676875776.webp"]);

/** Row 1: images and 9:16 videos interleaved evenly */
function getRow1Items(): Array<{ type: "image"; src: string } | { type: "video"; src: string }> {
  const numVideos = carouselVideos9x16.length;
  const numImages = carouselImages9x16.length;
  const total = numImages + numVideos;
  const items: Array<{ type: "image"; src: string } | { type: "video"; src: string }> = [];
  const videoIndices = new Set(
    numVideos ? Array.from({ length: numVideos }, (_, j) => Math.round(((j + 1) / (numVideos + 1)) * total) - 1) : []
  );
  let imageIdx = 0;
  let videoIdx = 0;
  for (let i = 0; i < total; i++) {
    if (videoIndices.has(i) && videoIdx < numVideos) {
      items.push({ type: "video", src: carouselVideos9x16[videoIdx]! });
      videoIdx++;
    } else {
      items.push({ type: "image", src: carouselImages9x16[imageIdx]! });
      imageIdx++;
    }
  }
  return items;
}

const row1Items = getRow1Items();

function AICreativesCarouselSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const videos = el.querySelectorAll<HTMLVideoElement>("video");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        videos.forEach((v) => (visible ? v.play().catch(() => {}) : v.pause()));
      },
      { rootMargin: "20%", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="ai-creatives-carousel py-24 bg-[#ffffff] overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto px-4 mb-12">
        <div className="text-center">
          <BlurFade inView inViewMargin="-40px">
            <h2 className="text-h2 font-medium tracking-tight text-foreground mb-3 max-w-[560px] mx-auto">
              AI Creatives in Motion
            </h2>
            <p className="text-muted-foreground max-w-[520px] mx-auto text-base md:text-lg font-normal">
              Scroll-stopping creatives and videos, generated in a blink.
            </p>
          </BlurFade>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4">
        <div className="relative overflow-hidden carousel-contain [mask-image:linear-gradient(to_right,transparent_0,black_80px,black_calc(100%-80px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_80px,black_calc(100%-80px),transparent_100%)]">
          {/* Row 1: 9:16 images + videos (evenly spaced), moves right to left; object-contain so full content visible; no pause on hover */}
          <div className="relative overflow-hidden py-2">
            <div className="flex w-max animate-marquee animate-marquee-no-pause items-stretch gap-4 pl-4 carousel-row" style={{ animationDuration: "25s" }}>
            {row1Items.map((item, i) => (
              <div key={`row1-${i}`} className="shrink-0 w-[160px] md:w-[200px]">
                <div className="aspect-[9/16] w-full rounded-xl overflow-hidden border border-black/5 bg-slate-100 shadow-sm flex items-center justify-center">
                  {item.type === "image" ? (
                    <img
                      src={item.src}
                      alt=""
                      width={200}
                      height={355}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <video
                      src={item.src}
                      className="w-full h-full object-contain"
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                      aria-label="AI-generated creative video"
                    />
                  )}
                </div>
              </div>
            ))}
            {row1Items.map((item, i) => (
              <div key={`row1-dup-${i}`} className="shrink-0 w-[160px] md:w-[200px]">
                <div className="aspect-[9/16] w-full rounded-xl overflow-hidden border border-black/5 bg-slate-100 shadow-sm flex items-center justify-center">
                  {item.type === "image" ? (
                    <img
                      src={item.src}
                      alt=""
                      width={200}
                      height={355}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <video
                      src={item.src}
                      className="w-full h-full object-contain"
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                      aria-label="AI-generated creative video"
                    />
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>

          {/* Row 2: 16:9 videos — moves left to right; no pause on hover */}
          <div className="relative overflow-hidden py-2">
            <div className="flex w-max animate-marquee-reverse animate-marquee-no-pause items-stretch gap-4 pl-4 carousel-row" style={{ animationDuration: "25s" }}>
            {carouselVideos16x9.map((src, i) => (
              <div key={`row2-${i}`} className="shrink-0 w-[320px] md:w-[400px]">
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-black/5 bg-slate-100 shadow-sm">
                  <video
                    src={src}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="metadata"
                    aria-label="AI-generated creative video"
                  />
                </div>
              </div>
            ))}
            {carouselVideos16x9.map((src, i) => (
              <div key={`row2-dup-${i}`} className="shrink-0 w-[320px] md:w-[400px]">
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-black/5 bg-slate-100 shadow-sm">
                  <video
                    src={src}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="metadata"
                    aria-label="AI-generated creative video"
                  />
                </div>
              </div>
            ))}
            </div>
          </div>

          {/* Row 3: 4:5 or 1:1 images — moves right to left; zoom-fit images use object-cover; no pause on hover; slower duration to match row 1 visual speed */}
          <div className="relative overflow-hidden py-2">
            <div className="flex w-max animate-marquee animate-marquee-no-pause items-stretch gap-4 pl-4 carousel-row" style={{ animationDuration: "58s" }}>
            {carouselRow3Images.map((src, i) => (
              <div key={`row3-${i}`} className="shrink-0 w-[180px] md:w-[220px]">
                <div className="aspect-[4/5] w-full rounded-xl overflow-hidden border border-black/5 bg-slate-100 shadow-sm flex items-center justify-center">
                  <img
                    src={src}
                    alt=""
                    width={220}
                    height={275}
                    className={cn("w-full h-full", carouselRow3ZoomFit.has(src) ? "object-cover" : "object-contain")}
                    loading="lazy"
                    draggable={false}
                  />
                </div>
              </div>
            ))}
            {carouselRow3Images.map((src, i) => (
              <div key={`row3-dup-${i}`} className="shrink-0 w-[180px] md:w-[220px]">
                <div className="aspect-[4/5] w-full rounded-xl overflow-hidden border border-black/5 bg-slate-100 shadow-sm flex items-center justify-center">
                  <img
                    src={src}
                    alt=""
                    width={220}
                    height={275}
                    className={cn("w-full h-full", carouselRow3ZoomFit.has(src) ? "object-cover" : "object-contain")}
                    loading="lazy"
                    draggable={false}
                  />
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   STATS BENTO GRID
───────────────────────────────────────────── */
/* Looping stack for Grid D – enough items to fill card, then cycle (oldest out, next in) */
const BENTO_LIST_ICON = (
  <img
    src="/Shopify.com/Shopify.com_Symbol_12.svg"
    alt=""
    width={40}
    height={40}
    className="size-10 object-contain"
  />
);
const BENTO_LIST_BASE: {
  name: string;
  description: string;
  icon: string;
  color: string;
  iconNode?: React.ReactNode;
}[] = [
  { name: "Shopify", description: "New Order for $39.90 from Online Store", icon: "✨", color: "#ffffff", iconNode: BENTO_LIST_ICON },
  { name: "Shopify", description: "New Order for $39.90 from Online Store", icon: "✨", color: "#ffffff", iconNode: BENTO_LIST_ICON },
  { name: "Shopify", description: "New Order for $39.90 from Online Store", icon: "✨", color: "#ffffff", iconNode: BENTO_LIST_ICON },
  { name: "Shopify", description: "New Order for $39.90 from Online Store", icon: "✨", color: "#ffffff", iconNode: BENTO_LIST_ICON },
];
const bentoListItems = Array.from({ length: 4 }, () => BENTO_LIST_BASE).flat();
const BENTO_VISIBLE_COUNT = 10;
const BENTO_LOOP_DELAY_MS = 1200;

function BentoListItem({
  name,
  description,
  icon,
  color,
  iconNode,
}: {
  name: string;
  description: string;
  icon: string;
  color: string;
  iconNode?: React.ReactNode;
}) {
  return (
    <figure
      className={cn(
        "relative mx-auto w-full min-h-fit cursor-pointer overflow-hidden rounded-xl p-4 transition-all duration-200 ease-in-out hover:scale-[102%]",
        "bg-white shadow-[0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_8px_16px_rgba(0,0,0,.04)]"
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg"
          style={color !== "#ffffff" ? { backgroundColor: color } : undefined}
        >
          {iconNode ?? icon}
        </div>
        <div className="min-w-0 flex flex-col justify-center py-0.5">
          <figcaption className="font-medium text-foreground text-sm truncate">{name}</figcaption>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
        </div>
      </div>
    </figure>
  );
}

function LoopingBentoList() {
  const [position, setPosition] = useState(0);
  const L = bentoListItems.length;

  useEffect(() => {
    const t = setInterval(() => {
      setPosition((p) => (p + 1) % L);
    }, BENTO_LOOP_DELAY_MS);
    return () => clearInterval(t);
  }, [L]);

  /* Newest first (top); advance = new at top, oldest drops from bottom; "last one gets put first" */
  const visibleIndices = Array.from({ length: BENTO_VISIBLE_COUNT }, (_, i) => ((position - i + L) % L));

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden px-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {visibleIndices.map((idx) => {
          const item = bentoListItems[idx]!;
          return (
            <motion.div
              key={idx}
              layout
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 350, damping: 40 }}
              className="shrink-0"
            >
              <BentoListItem {...item} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const BeamCircle = forwardRef<
  HTMLDivElement,
  { className?: string; children?: React.ReactNode }
>(({ className, children }, ref) => (
  <div
    ref={ref}
    className={cn(
      "z-10 flex size-12 items-center justify-center rounded-full border-2 bg-white p-2.5",
      className
    )}
  >
    {children}
  </div>
))
BeamCircle.displayName = "BeamCircle"

function AnimatedBeamBiDirectional() {
  const containerRef = useRef<HTMLDivElement>(null)
  const div1Ref = useRef<HTMLDivElement>(null)
  const div2Ref = useRef<HTMLDivElement>(null)
  return (
    <div
      className="relative flex w-full min-w-[200px] max-w-full items-center justify-center overflow-hidden"
      ref={containerRef}
    >
      {/* 16px narrower so distance shortens by the amount icons grew (40px→48px per circle) */}
      <div className="flex size-full max-w-[calc(100%-16px)] mx-auto flex-row items-center justify-between gap-3">
        <BeamCircle ref={div1Ref}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </BeamCircle>
        <BeamCircle ref={div2Ref}>
          <BlinkifyLogo variant="icon" height={28} className="object-contain" />
        </BeamCircle>
      </div>
      <AnimatedBeam containerRef={containerRef} fromRef={div1Ref} toRef={div2Ref} startYOffset={8} endYOffset={8} curvature={-20} />
      <AnimatedBeam containerRef={containerRef} fromRef={div1Ref} toRef={div2Ref} startYOffset={-8} endYOffset={-8} curvature={20} reverse />
    </div>
  )
}

const BENTO_CAROUSEL_IMAGE = "/blinkify-1771027611405.webp";

const BENTO_10X_VIDEO = "/blinkify-video-1771438910604.mp4";

function StatsBentoSection() {
  return (
    <section className="py-24 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-3 md:grid-rows-3 md:gap-8 md:h-[1000px]">
          {/* 10x Faster – first on mobile for clear message */}
          <BlurFade inView inViewMargin="-40px" delay={0} className="order-1 md:order-none md:col-start-2 md:row-start-2 md:col-span-2 md:row-span-2 min-h-[240px] md:min-h-0">
            <div className="h-full min-h-[240px] md:min-h-0 rounded-2xl overflow-hidden relative border border-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs flex flex-col justify-center">
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
                src={BENTO_10X_VIDEO}
                aria-hidden
              />
              <div className="absolute inset-0 bg-black/30" aria-hidden />
              <div className="relative z-10 p-6 md:p-7 flex flex-col justify-center">
                <p className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium text-white mb-3 drop-shadow-md">10x</p>
                <p className="text-lg sm:text-xl md:text-2xl font-medium text-white drop-shadow-md">Faster Ad Creation</p>
              </div>
            </div>
          </BlurFade>

          {/* $2,400 card – second on mobile */}
          <BlurFade inView inViewMargin="-40px" delay={0.08} className="order-2 md:order-none md:col-start-2 md:row-start-1 md:col-span-2 md:row-span-1 min-h-[200px] md:min-h-0">
            <div className="h-full min-h-[200px] md:min-h-0 rounded-2xl overflow-hidden relative bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs flex flex-col md:flex-row items-stretch">
              <div className="relative w-full md:w-[42%] min-h-0 flex shrink-0 items-center justify-center overflow-hidden rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none aspect-[2/1] md:aspect-auto">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-75 sm:scale-90 md:scale-100 origin-center">
                  <div className="relative size-[180px] sm:size-[220px] md:size-[266px] lg:size-[304px]">
                    <OrbitingCircles radius={72} duration={20} delay={2.22} className="border-0 bg-transparent">
                      <img src="/Amazon/Amazon_Symbol_30.svg" alt="Amazon" className="h-9 w-9 object-contain" width={36} height={36} />
                    </OrbitingCircles>
                    <OrbitingCircles radius={72} duration={20} delay={8.88} className="border-0 bg-transparent">
                      <img src="/LinkedIn/LinkedIn_Symbol_9.svg" alt="LinkedIn" className="h-9 w-9 object-contain" width={36} height={36} />
                    </OrbitingCircles>
                    <OrbitingCircles radius={72} duration={20} delay={15.55} className="border-0 bg-transparent">
                      <img src="/X/X_idJxGuURW1_0.svg" alt="X" className="h-9 w-9 object-contain" width={36} height={36} />
                    </OrbitingCircles>
                    <OrbitingCircles radius={133} duration={20} delay={4.44} className="border-0 bg-transparent">
                      <img src="/Instagram/Instagram_Symbol_0.svg" alt="Instagram" className="h-9 w-9 object-contain" width={36} height={36} />
                    </OrbitingCircles>
                    <OrbitingCircles radius={133} duration={20} delay={11.11} className="border-0 bg-transparent">
                      <img src="/Facebook/Facebook_Symbol_0.png" alt="Facebook" className="h-9 w-9 object-contain" width={36} height={36} />
                    </OrbitingCircles>
                    <OrbitingCircles radius={133} duration={20} delay={17.77} className="border-0 bg-transparent">
                      <img src="/Shopify.com/Shopify.com_Symbol_12.svg" alt="Shopify" className="h-9 w-9 object-contain" width={36} height={36} />
                    </OrbitingCircles>
                  </div>
                </div>
              </div>
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 p-6 md:p-7">
                <div className="flex w-full flex-col items-center justify-center gap-4">
                  <p className="text-center text-3xl sm:text-4xl md:text-5xl font-medium leading-tight">
                    <span className="text-gradient-brand">$2,400</span>
                    <span className="ml-2 text-base md:text-lg font-medium text-slate-600">Saved Monthly</span>
                  </p>
                  <div className="w-full min-w-0 hidden sm:block">
                    <AnimatedBeamBiDirectional />
                  </div>
                </div>
              </div>
            </div>
          </BlurFade>

          {/* Carousel image */}
          <BlurFade inView inViewMargin="-40px" delay={0.16} className="order-3 md:order-none md:col-start-1 md:row-start-1 md:col-span-1 md:row-span-2 min-h-[280px] md:min-h-0">
            <div className="h-full min-h-[280px] md:min-h-0 rounded-2xl overflow-hidden border border-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs flex items-center justify-center bg-slate-100 relative">
              <Image
                src={BENTO_CAROUSEL_IMAGE}
                alt="AI creative"
                width={378}
                height={677}
                className="h-full w-auto max-w-full object-contain"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 378px"
              />
            </div>
          </BlurFade>

          {/* Notifications list – shorter on mobile */}
          <BlurFade inView inViewMargin="-40px" delay={0.24} className="order-4 md:order-none md:col-start-1 md:row-start-3 md:col-span-1 md:row-span-1 min-h-[160px] max-h-[220px] md:min-h-0 md:max-h-none">
            <div className="relative flex h-full w-full min-h-[160px] max-h-[220px] md:min-h-0 md:max-h-none flex-col overflow-hidden rounded-2xl">
              <LoopingBentoList />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#ffffff] to-transparent" />
            </div>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   TESTIMONIALS BENTO
───────────────────────────────────────────── */
const VerifiedBadge = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg aria-label="Verified" viewBox="0 0 24 24" className={className} {...props}>
    <g fill="currentColor">
      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
    </g>
  </svg>
);

const testimonials: {
  name: string;
  role: string;
  quote: string;
  avatarSeed: string;
  bgHex: string;
  span?: "default" | "wide";
  rowSpan?: number;
  image?: string;
  imageAspect?: "16/9" | "9/16" | "4/3";
  location?: string;
  date?: string;
}[] = [
  {
    name: "Sarah Chen",
    role: "Head of Creative, DTC Brand",
    quote: "We used to outsource every ad shoot. Now we run 50+ variations a week in-house. Blinkify paid for itself in the first month.",
    avatarSeed: "Sarah+Chen",
    bgHex: "6366f1",
    span: "wide",
    image: "/1.png",
    location: "CA",
    date: "Mar 6, 2025",
  },
  {
    name: "Marcus Johnson",
    role: "Freelance Performance Marketer",
    quote: "Finally, ad creatives that don’t look like generic AI slop. The brand context actually works.",
    avatarSeed: "Marcus+Johnson",
    bgHex: "0d9488",
    image: "/2.png",
    location: "US",
    date: "Mar 5, 2025",
  },
  {
    name: "Lorda Reid",
    role: "Content Lead, Media Co",
    quote: "We ship hero images and carousel assets in one session. The 16:9 outputs are exactly what we need for paid social.",
    avatarSeed: "Lorda+Reid",
    bgHex: "7c3aed",
    rowSpan: 2,
    image: "/lorda.png",
    imageAspect: "9/16",
    location: "NY",
    date: "Mar 2, 2025",
  },
  {
    name: "Elena Vasquez",
    role: "Growth Lead, SaaS",
    quote: "Our creative throughput went from 10 to 200+ assets per month. No designer hire needed.",
    avatarSeed: "Elena+Vasquez",
    bgHex: "c026d3",
    span: "wide",
    image: "/3.png",
    location: "UK",
    date: "Mar 4, 2025",
  },
  {
    name: "James Park",
    role: "Founder, E‑commerce Agency",
    quote: "We run Blinkify for every client. Same quality as a $3k/month retainer at a fraction of the cost.",
    avatarSeed: "James+Park",
    bgHex: "ea580c",
    location: "US",
    date: "Mar 3, 2025",
  },
  {
    name: "Sam Rivera",
    role: "Indie Founder",
    quote: "From zero design skills to launching ads in a day. The AI gets our vibe.",
    avatarSeed: "Sam+Rivera",
    bgHex: "0ea5e9",
    location: "FL",
    date: "Feb 27, 2025",
  },
];

function TestimonialBentoSection() {
  return (
    <section className="py-24 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-h2 font-medium tracking-tight text-foreground mb-2">
            Loved by Creators and Teams
          </h2>
          <p className="text-slate-600 max-w-[520px] mx-auto font-normal text-sm md:text-base">
            See what marketers and brands say about shipping ad creatives faster.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3 items-stretch">
          {testimonials.map((t, i) => (
            <BlurFade
              key={t.name}
              inView
              inViewMargin="-40px"
              delay={i * 0.06}
              className={cn(
                t.span === "wide" && "md:col-span-2",
                t.rowSpan === 2 && "md:row-span-2"
              )}
            >
              <div className={cn(
                "relative rounded-2xl bg-white border border-black/8 overflow-hidden flex flex-col h-full"
              )}>
                <div className="p-3 md:p-4 flex flex-col flex-1 min-w-0">
                  {/* Twitter-style header: avatar + name + verified */}
                  <div className="flex items-center gap-2.5 mb-2">
                    <img
                      src={`https://ui-avatars.com/api/?name=${t.avatarSeed}&size=96&background=${t.bgHex}&color=fff`}
                      alt={t.name}
                      width={40}
                      height={40}
                      className="size-9 md:size-10 rounded-full object-cover shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-foreground truncate">{t.name}</span>
                      <VerifiedBadge className="size-4 text-[#1d9bf0] shrink-0" aria-hidden />
                    </div>
                  </div>
                  <p className="text-foreground text-[14px] md:text-[15px] leading-relaxed font-normal">
                    {t.quote}
                  </p>
                  <div className="mt-auto pt-2 flex flex-col gap-2">
                    {t.image && (
                      <div
                        className={cn(
                          "rounded-xl overflow-hidden border border-black/5 shrink-0 relative",
                          t.imageAspect === "9/16" ? "aspect-[9/16]" : t.span === "wide" ? "aspect-video" : "aspect-[4/3]"
                        )}
                      >
                        <Image
                          src={t.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 352px, 468px"
                        />
                      </div>
                    )}
                    {(t.location || t.date) && (
                      <p className="text-slate-500 text-xs md:text-sm font-normal shrink-0">
                        {[t.location, t.date].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                {i === 0 && (
                  <div className="absolute inset-0 rounded-[inherit] pointer-events-none z-0 overflow-hidden">
                    <BorderBeam size={60} duration={8} />
                  </div>
                )}
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PRICING
───────────────────────────────────────────── */
type Benefit = { label: string; included: boolean };

const plans: {
  name: string;
  price: string;
  description: string;
  popular: boolean;
  benefits: Benefit[];
}[] = [
  {
    name: "Standard",
    price: "$39",
    description: "For small businesses and freelancers who want better ad creatives without overthinking.",
    popular: false,
    benefits: [
      { label: "400 Credits / Month", included: true },
      { label: "1 Brand", included: true },
      { label: "1 Team Member", included: true },
      { label: "Ad Creative Generation", included: true },
      { label: "Custom Branding", included: true },
      { label: "AI Prompt Enhancement", included: true },
      { label: "Multiple Formats", included: true },
      { label: "AI Email Marketing", included: true },
      { label: "Product Video Shoot", included: false },
      { label: "All AI Assets Unlocked", included: false },
      { label: "24/7 Priority Support", included: false },
    ],
  },
  {
    name: "Professional",
    price: "$119",
    description: "For brands ready to turn ideas into high-converting ad creatives.",
    popular: true,
    benefits: [
      { label: "1,500 Credits / Month", included: true },
      { label: "3 Brands", included: true },
      { label: "1 Team Member", included: true },
      { label: "Ad Creative Generation", included: true },
      { label: "Custom Branding", included: true },
      { label: "AI Prompt Enhancement", included: true },
      { label: "Multiple Formats", included: true },
      { label: "AI Email Marketing", included: true },
      { label: "Product Video Shoot", included: true },
      { label: "All AI Assets Unlocked", included: true },
      { label: "24/7 Priority Support", included: true },
    ],
  },
  {
    name: "Ultra",
    price: "$397",
    description: "For agencies and teams managing creative production across multiple clients.",
    popular: false,
    benefits: [
      { label: "5,000 Credits / Month", included: true },
      { label: "10 Brands", included: true },
      { label: "10 Team Members", included: true },
      { label: "Ad Creative Generation", included: true },
      { label: "Custom Branding", included: true },
      { label: "AI Prompt Enhancement", included: true },
      { label: "Multiple Formats", included: true },
      { label: "AI Email Marketing", included: true },
      { label: "Product Video Shoot", included: true },
      { label: "All AI Assets Unlocked", included: true },
      { label: "24/7 Priority Support", included: true },
      { label: "Dedicated Account Manager", included: true },
    ],
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-h2 font-medium tracking-tight text-foreground mb-4 max-w-[600px] mx-auto">
            Predictable Pricing
          </h2>
          <p className="text-slate-600 max-w-[520px] mx-auto font-normal">
            Start small, scale as you grow. No hidden fees. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, i) => (
            <BlurFade key={plan.name} inView inViewMargin="-40px" delay={i * 0.06}>
              <div
                className={`relative flex flex-col rounded-2xl p-6 md:p-8 transition-all h-full overflow-visible ${
                  plan.popular
                    ? "border-0 shadow-xl scale-[1.02] -translate-y-1 md:scale-[1.04] md:-translate-y-2"
                    : "bg-white border border-black/5 hover:shadow-xs"
                }`}
              >
                {plan.popular && (
                  <div className="absolute inset-0 rounded-[inherit] overflow-hidden z-0">
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 w-full h-full object-cover"
                      src="/grainient-1770491527486.webm"
                    />
                  </div>
                )}
                <div className="absolute inset-0 rounded-[inherit] z-10 pointer-events-none">
                  <BorderBeam size={80} duration={8} />
                </div>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30">
                    <span className="bg-white text-foreground text-sm font-normal px-4 py-2 rounded-full shadow-md border border-black/5 whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className={`flex-1 relative flex flex-col ${plan.popular ? "z-20" : "z-0"}`}>
                  <h3
                    className={`text-xl md:text-2xl font-medium tracking-tight ${
                      plan.popular ? "text-white" : "text-foreground"
                    }`}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={`mt-2 text-sm font-normal ${
                      plan.popular ? "text-white/90" : "text-slate-600"
                    }`}
                  >
                    {plan.description}
                  </p>
                  <div className="mt-5">
                    <span
                      className={`text-3xl md:text-4xl font-medium ${
                        plan.popular ? "text-white" : "text-foreground"
                      }`}
                    >
                      {plan.price}
                    </span>
                    <span
                      className={`text-base font-normal ml-0.5 ${
                        plan.popular ? "text-white/80" : "text-slate-600"
                      }`}
                    >
                      /month
                    </span>
                  </div>
                  <div className="mt-6">
                    <Button
                      variant={plan.popular ? "secondary" : "default"}
                      className={
                        plan.popular
                          ? "w-full font-medium bg-white text-foreground hover:bg-white/95 border-0 shadow-sm"
                          : "w-full font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                      }
                      asChild
                    >
                      <Link href="/signup">
                        Start Free Trial
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <ul
                    className={`mt-6 pt-6 space-y-3 flex-1 border-t ${
                      plan.popular ? "border-white/30" : "border-black/5"
                    }`}
                  >
                    {plan.benefits.map((b) => (
                      <li
                        key={b.label}
                        className="flex items-center gap-3 text-sm font-normal"
                      >
                        {b.included ? (
                          <Check
                            className={`size-4 shrink-0 ${
                              plan.popular ? "text-white" : "text-foreground"
                            }`}
                            strokeWidth={2.5}
                          />
                        ) : (
                          <X
                            className={`size-4 shrink-0 ${
                              plan.popular ? "text-white/50" : "text-muted-foreground"
                            }`}
                            strokeWidth={2}
                          />
                        )}
                        <span
                          className={
                            b.included
                              ? plan.popular
                                ? "text-white"
                                : "text-foreground"
                              : plan.popular
                                ? "text-white/60"
                                : "text-muted-foreground"
                          }
                        >
                          {b.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </BlurFade>
          ))}
        </div>

        <p className="text-center text-foreground mt-12 text-base font-normal">
          Need a custom plan or enterprise solution?{" "}
          <Link
            href="mailto:support@blinkify.ai"
            className="font-medium underline underline-offset-4 text-primary hover:text-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
          >
            Book a call
          </Link>{" "}
          and let&apos;s talk.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FAQ (objection handling before final CTA)
───────────────────────────────────────────── */
const faqItems: { q: string; a: string }[] = [
  {
    q: "Is there really a free trial?",
    a: "Yes. Start your free trial in one click. Cancel anytime.",
  },
  {
    q: "What formats can I generate?",
    a: "Meta, Google, TikTok, and store-ready formats—including static ads, carousels, and video. All tuned for performance.",
  },
  {
    q: "Is my brand data safe?",
    a: "Your brand assets and inputs are never shared or trained on. Private by default.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No long-term commitment. Cancel from your account whenever you want.",
  },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-4">
        <h2 className="text-h2 font-medium tracking-tight text-foreground mb-8 text-center">
          Frequently Asked Questions
        </h2>
        <ul className="max-w-[640px] mx-auto space-y-3">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <li key={item.q}>
                <div
                  className={cn(
                    "rounded-xl bg-white/80 overflow-hidden transition-colors",
                    isOpen && "bg-black/[0.02]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 transition-colors hover:bg-black/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffffff]"
                  >
                    <span className="text-base font-semibold text-foreground pr-2">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="text-muted-foreground text-sm md:text-base leading-relaxed py-3 px-5">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FINAL CTA
───────────────────────────────────────────── */
function FinalCTASection() {
  return (
    <section className="relative py-24 bg-[#ffffff] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-[-40px] sm:inset-[-80px] -z-10 blur-3xl opacity-90"
        aria-hidden
      >
        <div className="mx-auto h-full w-full max-w-4xl bg-[radial-gradient(ellipse_80%_50%_at_20%_30%,rgba(59,130,246,0.35),_transparent_50%),radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.28),_transparent_55%),radial-gradient(ellipse_70%_50%_at_80%_70%,rgba(249,115,22,0.28),_transparent_50%),radial-gradient(ellipse_50%_50%_at_70%_20%,rgba(239,68,68,0.22),_transparent_55%)]" />
      </div>
      <div className="max-w-[1200px] mx-auto px-4 text-center relative z-10">
        <div>
          <h2 className="text-h2 text-foreground mb-4 max-w-[700px] mx-auto">
            Create Ad Creatives <span className="text-gradient-brand">10x Faster</span>
          </h2>
          <p className="text-muted-foreground max-w-[520px] mx-auto mb-10 font-normal">
            Join teams already creating at 10x speed. No designer needed.
          </p>
          <Button asChild size="lg" className="text-base font-medium px-8">
            <Link href="/signup">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
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
          <CompaniesMarqueeSection />
        </div>
        <SectionDivider />
        <StatsBentoSection />
        <SectionDivider />
        <VisualDemoSection />
        <SectionDivider />
        <HowItWorksSection />
        <SectionDivider />
        <WhoItsForSection />
        <SectionDivider />
        <ValueSection />
        <SectionDivider />
        <AICreativesCarouselSection />
        <SectionDivider />
        <TestimonialBentoSection />
        <SectionDivider />
        <PricingSection />
        <SectionDivider />
        <FAQSection />
        <SectionDivider />
        <FinalCTASection />
      </main>
      <div aria-hidden className="w-full shrink-0">
        <div className="h-px w-full" />
      </div>
      <LandingFooter />
    </>
  );
}

"use client";

import React, { useState, useRef, useEffect, forwardRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card-legacy";
import {
  Store,
  ShoppingCart,
  Users,
  ArrowRight,
  Check,
  X,
  Palette,
  Target,
  Zap,
  Lock,
  ChevronDown,
  DollarSign,
  Clock,
} from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { BlinkifyLogo } from "@/components/blinkify-logo";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { OrbitingCircles } from "@/components/ui/orbiting-circles";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { LANDING_FAQ_ITEMS } from "@/lib/homepage-faq-schema";

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL === "https://blinkify.ai"
    ? "https://app.blinkify.ai"
    : "";

function SectionDivider() {
  return (
    <div aria-hidden className="hidden md:block max-w-[1200px] mx-auto w-full">
      <div className="h-px" />
    </div>
  );
}

/** Sets video src only when in viewport to avoid loading all carousel/bento videos on initial load. */
function LazyVideo({
  src,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"video"> & { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setLoad(true);
      },
      { rootMargin: "50%", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={load ? src : undefined}
      className={className}
      preload={load ? "metadata" : "none"}
      {...props}
    />
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
              quality={72}
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
          <h2 className="text-h2 font-medium text-foreground mb-4 max-w-[700px] mx-auto">
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
    <LazyVideo
      src={src}
      autoPlay
      loop
      muted
      playsInline
      className="h-full w-full object-cover"
    />
  );
}

/** Two-part video: plays part A once, then loops part B. Loads src only when in view. */
function StepVideoTwoPart({ parts }: { parts: [string, string] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [showB, setShowB] = useState(false);
  const [load, setLoad] = useState(false);
  const hasPlayedA = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setLoad(true);
      },
      { rootMargin: "20%", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!load) return;
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
  }, [load]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <video
        ref={videoARef}
        src={load ? parts[0] : undefined}
        autoPlay
        muted
        playsInline
        preload={load ? "metadata" : "none"}
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", showB ? "opacity-0 pointer-events-none" : "opacity-100")}
      />
      <video
        ref={videoBRef}
        src={load ? parts[1] : undefined}
        loop
        muted
        playsInline
        preload={load ? "metadata" : "none"}
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", showB ? "opacity-100" : "opacity-0 pointer-events-none")}
      />
    </div>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-4">
        <h2 className="sr-only">How it works</h2>
        <div className="space-y-8 md:space-y-10">
          {howItWorksSteps.map((step, i) => {
            const imageLeft = i % 2 === 1;
            const isLastStep = i === howItWorksSteps.length - 1;
            return (
            <div
              key={step.title}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center bg-white rounded-2xl p-6 md:p-8"
            >
              <div className={`min-w-0 order-2 flex flex-col ${imageLeft ? "md:order-2" : "md:order-1"}`}>
                <h3 className="text-xl md:text-2xl font-medium tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-slate-600 font-normal leading-relaxed">
                  {step.description}
                </p>
                {isLastStep && (
                  <div className="mt-8">
                    <Button asChild size="lg" className="text-base font-medium px-8">
                      <a href={`${APP_BASE}/signup`}>
                        Start free
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </a>
                    </Button>
                  </div>
                )}
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

// Reserved for future "Who it's for" section
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _WhoItsForSection() {
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
          <Image key={p.name} src={p.src} alt={p.name} width={24} height={24} className="h-6 w-6 object-contain shrink-0" />
        ) : (
          <span
            key={p.name}
            role="img"
            className={`flex h-6 w-6 shrink-0 items-center justify-center ${p.name === "Facebook" ? "text-[#1877F2]" : "text-foreground"}`}
            aria-label={p.name}
          >
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
  "/blinkify-video-3235da29.mp4",
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
                    <Image
                      src={item.src}
                      alt=""
                      width={200}
                      height={355}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      draggable={false}
                      sizes="(max-width: 768px) 160px, 200px"
                    />
                  ) : (
                    <LazyVideo
                      src={item.src}
                      className="w-full h-full object-contain"
                      muted
                      loop
                      playsInline
                      autoPlay
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
                    <Image
                      src={item.src}
                      alt=""
                      width={200}
                      height={355}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      draggable={false}
                      sizes="(max-width: 768px) 160px, 200px"
                    />
                  ) : (
                    <LazyVideo
                      src={item.src}
                      className="w-full h-full object-contain"
                      muted
                      loop
                      playsInline
                      autoPlay
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
                  <LazyVideo
                    src={src}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                    aria-label="AI-generated creative video"
                  />
                </div>
              </div>
            ))}
            {carouselVideos16x9.map((src, i) => (
              <div key={`row2-dup-${i}`} className="shrink-0 w-[320px] md:w-[400px]">
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-black/5 bg-slate-100 shadow-sm">
                  <LazyVideo
                    src={src}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
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
                  <Image
                    src={src}
                    alt=""
                    width={220}
                    height={275}
                    className={cn("w-full h-full", carouselRow3ZoomFit.has(src) ? "object-cover" : "object-contain")}
                    loading="lazy"
                    draggable={false}
                    sizes="(max-width: 768px) 180px, 220px"
                  />
                </div>
              </div>
            ))}
            {carouselRow3Images.map((src, i) => (
              <div key={`row3-dup-${i}`} className="shrink-0 w-[180px] md:w-[220px]">
                <div className="aspect-[4/5] w-full rounded-xl overflow-hidden border border-black/5 bg-slate-100 shadow-sm flex items-center justify-center">
                  <Image
                    src={src}
                    alt=""
                    width={220}
                    height={275}
                    className={cn("w-full h-full", carouselRow3ZoomFit.has(src) ? "object-cover" : "object-contain")}
                    loading="lazy"
                    draggable={false}
                    sizes="(max-width: 768px) 180px, 220px"
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
  <Image
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
              <LazyVideo
                autoPlay
                loop
                muted
                playsInline
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
                      <Image src="/Amazon/Amazon_Symbol_30.svg" alt="Amazon" className="h-9 w-9 object-contain" width={36} height={36} sizes="36px" />
                    </OrbitingCircles>
                    <OrbitingCircles radius={72} duration={20} delay={8.88} className="border-0 bg-transparent">
                      <Image src="/LinkedIn/LinkedIn_Symbol_9.svg" alt="LinkedIn" className="h-9 w-9 object-contain" width={36} height={36} sizes="36px" />
                    </OrbitingCircles>
                    <OrbitingCircles radius={72} duration={20} delay={15.55} className="border-0 bg-transparent">
                      <Image src="/X/X_idJxGuURW1_0.svg" alt="X" className="h-9 w-9 object-contain" width={36} height={36} sizes="36px" />
                    </OrbitingCircles>
                    <OrbitingCircles radius={133} duration={20} delay={4.44} className="border-0 bg-transparent">
                      <Image src="/Instagram/Instagram_Symbol_0.svg" alt="Instagram" className="h-9 w-9 object-contain" width={36} height={36} sizes="36px" />
                    </OrbitingCircles>
                    <OrbitingCircles radius={133} duration={20} delay={11.11} className="border-0 bg-transparent">
                      <Image src="/Facebook/Facebook_Symbol_0.png" alt="Facebook" className="h-9 w-9 object-contain" width={36} height={36} sizes="36px" />
                    </OrbitingCircles>
                    <OrbitingCircles radius={133} duration={20} delay={17.77} className="border-0 bg-transparent">
                      <Image src="/Shopify.com/Shopify.com_Symbol_12.svg" alt="Shopify" className="h-9 w-9 object-contain" width={36} height={36} sizes="36px" />
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
   ROI CALCULATOR – Blinkify savings vs agency/freelance
───────────────────────────────────────────── */
const ROI_COUNTRIES = [
  { id: "us", label: "United States", hourlyRate: 85 },
  { id: "uk", label: "United Kingdom", hourlyRate: 72 },
  { id: "ca", label: "Canada", hourlyRate: 78 },
  { id: "eu", label: "Europe (EU)", hourlyRate: 70 },
  { id: "au", label: "Australia", hourlyRate: 82 },
  { id: "other", label: "Other", hourlyRate: 65 },
] as const;

const ROI_TEAM_OPTIONS = [
  { id: "1", label: "1 User", users: 1 },
  { id: "2", label: "2 Users", users: 2 },
  { id: "3-10", label: "3–10 Users", users: 6 },
  { id: "11-25", label: "11–25 Users", users: 18 },
] as const;

const ROI_CREATIVES_PER_WEEK = [
  { id: "0-3", label: "Up to 3 creatives / week", mid: 2 },
  { id: "4-5", label: "4 – 5 creatives / week", mid: 4.5 },
  { id: "6-8", label: "6 – 8 creatives / week", mid: 7 },
  { id: "9-13", label: "9 – 13 creatives / week", mid: 11 },
  { id: "14-20", label: "14 – 20 creatives / week", mid: 17 },
  { id: "21-26", label: "21 – 26 creatives / week", mid: 23 },
  { id: "27-38", label: "27 – 38 creatives / week", mid: 32 },
  { id: "39-50", label: "39 – 50 creatives / week", mid: 44 },
  { id: "50+", label: "More than 50 creatives / week", mid: 60 },
] as const;

const BLINKIFY_PLANS = [
  { id: "standard", name: "Standard", credits: 400, price: 39 },
  { id: "professional", name: "Professional", credits: 1500, price: 119 },
  { id: "agency", name: "Agency", credits: 5000, price: 397 },
];

const HOURS_PER_CREATIVE = 1;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future ROI display
const _CREDITS_PER_CREATIVE = 2; // blended average (static/carousel/video)

const CREATIVES_TO_PLAN: Record<string, (typeof BLINKIFY_PLANS)[number]> = (() => {
  const [Standard, Professional, Agency] = BLINKIFY_PLANS;
  const map: Record<string, (typeof BLINKIFY_PLANS)[number]> = {};
  ROI_CREATIVES_PER_WEEK.forEach((c) => {
    if (["0-3", "4-5", "6-8"].includes(c.id)) map[c.id] = Standard;
    else if (["9-13", "14-20", "21-26"].includes(c.id)) map[c.id] = Professional;
    else map[c.id] = Agency; // 27-38, 39-50, 50+
  });
  return map;
})();

function getRecommendedPlanByCreatives(creativesId: string): (typeof BLINKIFY_PLANS)[number] {
  return CREATIVES_TO_PLAN[creativesId] ?? BLINKIFY_PLANS[1];
}

function getRecommendedPlan(teamId: string, creativesId: string): (typeof BLINKIFY_PLANS)[number] {
  if (teamId === "3-10" || teamId === "11-25") return BLINKIFY_PLANS[2]; // 3+ users → Agency
  return getRecommendedPlanByCreatives(creativesId);
}

const ROI_DISCLAIMER = `This ROI calculator is for informational and estimation purposes only. Results do not guarantee or predict actual financial outcomes and may vary based on your business, workflows, and market conditions.

Blinkify does not assume responsibility for the accuracy of any output or for decisions made based on these estimates. We encourage you to seek independent professional advice before making financial or strategic decisions.

Pricing and savings estimates are illustrative and should not be interpreted as fixed quotes. The model is based on typical usage, industry benchmarks, and estimated efficiency gains from automation. Blinkify makes no warranties regarding the completeness or applicability of results for your specific situation.

This tool is provided "AS IS" without express or implied warranties. Blinkify disclaims all liability for any damages or losses arising from reliance on these estimates.`;

function CostCalculatorSection() {
  const [countryId, setCountryId] = useState<string>(ROI_COUNTRIES[0].id);
  const [teamId, setTeamId] = useState<string>(ROI_TEAM_OPTIONS[0].id);
  const [creativesId, setCreativesId] = useState<string>(ROI_CREATIVES_PER_WEEK[3].id); // 9–13 default
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const country = ROI_COUNTRIES.find((c) => c.id === countryId) ?? ROI_COUNTRIES[0];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used for future team-based UI
  const _team = ROI_TEAM_OPTIONS.find((t) => t.id === teamId) ?? ROI_TEAM_OPTIONS[0];
  const creativesRange = ROI_CREATIVES_PER_WEEK.find((c) => c.id === creativesId) ?? ROI_CREATIVES_PER_WEEK[3];

  const creativesPerMonth = Math.round((creativesRange.mid * 52) / 12);
  const recommendedPlan = getRecommendedPlan(teamId, creativesId);

  const agencyCostMonthly = creativesPerMonth * HOURS_PER_CREATIVE * country.hourlyRate;
  const agencyCostAnnual = agencyCostMonthly * 12;
  const blinkifyCostAnnual = recommendedPlan.price * 12;
  const costSavingsAnnual = Math.max(0, agencyCostAnnual - blinkifyCostAnnual);
  const timeSavedHours = Math.round(creativesRange.mid * 52 * HOURS_PER_CREATIVE);
  const roiMultiplier = blinkifyCostAnnual > 0 ? costSavingsAnnual / blinkifyCostAnnual : 0;
  const roiCapped = Math.max(2, Math.min(roiMultiplier, 20));
  const roiDisplay = roiCapped >= 2 ? `${roiCapped.toFixed(1)}x` : "2.0x";

  return (
    <section id="cost-calculator" className="py-16 sm:py-24 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-h2 font-medium tracking-tight text-foreground mb-3 max-w-[600px] mx-auto">
            Calculate your Return on Investment
          </h2>
          <p className="text-slate-600 max-w-[520px] mx-auto font-normal">
            See how much you could save with Blinkify vs. agency or freelance.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch w-full max-w-5xl mx-auto">
          {/* Left: inputs — stretches toward center */}
          <div className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6 lg:min-w-0 lg:flex-1">
            <p className="text-base sm:text-lg font-semibold text-foreground mb-4 sm:mb-5">
              Your inputs
            </p>
            <div className="space-y-5">
              <div>
                <label htmlFor="roi-country" className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
                  Country of operation
                  <span className="text-muted-foreground" title="Designer rates vary by region">ⓘ</span>
                </label>
                <select
                  id="roi-country"
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {ROI_COUNTRIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="roi-team" className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
                  Number of team members who will use Blinkify
                  <span className="text-muted-foreground" title="Affects recommended plan">ⓘ</span>
                </label>
                <select
                  id="roi-team"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {ROI_TEAM_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="roi-creatives" className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
                  How many creatives do you need per week on average?
                  <span className="text-muted-foreground" title="Ad creatives per week">ⓘ</span>
                </label>
                <select
                  id="roi-creatives"
                  value={creativesId}
                  onChange={(e) => setCreativesId(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {ROI_CREATIVES_PER_WEEK.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDisclaimerOpen(true)}
              className="mt-4 text-xs text-red-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Disclaimer
            </button>
          </div>

          {/* Right: results — stretches toward center */}
          <div className="lg:min-w-0 lg:flex-1 lg:flex lg:flex-col">
            <div className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6 lg:pt-6 lg:p-6 w-full h-full text-[#000000] flex flex-col">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-[#000000]">
                Your Return on Investment with Blinkify
              </h3>
              <div className="mb-4 sm:mb-6">
                <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-gradient-brand">{roiDisplay}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                <div className="rounded-xl border border-black/5 p-4">
                  <div className="flex items-center gap-2 text-sm mb-1.5 text-[#000000]">
                    <DollarSign className="h-4 w-4 text-primary shrink-0" aria-hidden />
                    Cost Savings
                  </div>
                  <p className="text-2xl sm:text-3xl font-semibold text-[#000000]">
                    ${(costSavingsAnnual / 1000).toFixed(1)}k
                  </p>
                </div>
                <div className="rounded-xl border border-black/5 p-4">
                  <div className="flex items-center gap-2 text-sm mb-1.5 text-[#000000]">
                    <Clock className="h-4 w-4 text-primary shrink-0" aria-hidden />
                    Time Saved
                  </div>
                  <p className="text-2xl sm:text-3xl font-semibold text-[#000000]">≈ {timeSavedHours} hours</p>
                </div>
              </div>
              <p className="text-xs mb-4 text-[#000000]">Currency in $USD · Annual estimates</p>
              <div className="rounded-xl border border-black/5 p-4 mb-6">
                <p className="text-sm font-medium mb-2 text-[#000000]">Your recommended plan</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-lg sm:text-xl font-semibold text-[#000000]">{recommendedPlan.name}</span>
                  <span className="text-lg sm:text-xl font-medium text-[#000000]">${recommendedPlan.price}/mo</span>
                </div>
              </div>
              <Button asChild size="lg" className="w-full text-base font-medium mt-auto">
                <a href={`${APP_BASE}/signup`}>
                  Try for free now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer modal */}
      <AnimatePresence>
        {disclaimerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setDisclaimerOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="disclaimer-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-black/5">
                <h2 id="disclaimer-title" className="text-lg font-semibold text-foreground">Disclaimer</h2>
                <button
                  type="button"
                  onClick={() => setDisclaimerOpen(false)}
                  className="p-2 rounded-lg hover:bg-black/5 text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {ROI_DISCLAIMER}
              </div>
              <div className="p-4 border-t border-black/5">
                <Button onClick={() => setDisclaimerOpen(false)} className="w-full">
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
  metric?: string;
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
    metric: "50+ variations/week",
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
                    <Image
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(t.avatarSeed)}&size=96&background=${t.bgHex}&color=fff`}
                      alt={t.name}
                      width={40}
                      height={40}
                      className="size-9 md:size-10 rounded-full object-cover shrink-0"
                      unoptimized
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-foreground truncate">{t.name}</span>
                      <VerifiedBadge className="size-4 text-[#1d9bf0] shrink-0" aria-hidden />
                    </div>
                  </div>
                  <p className="text-foreground text-[14px] md:text-[15px] leading-relaxed font-normal">
                    {t.quote}
                  </p>
                  {t.metric && (
                    <p className="text-sm font-semibold text-primary mt-2">
                      {t.metric}
                    </p>
                  )}
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
  priceMonthly: number;
  priceAnnual: number;
  description: string;
  popular: boolean;
  benefits: Benefit[];
}[] = [
  {
    name: "Standard",
    priceMonthly: 39,
    priceAnnual: 29,
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
    priceMonthly: 119,
    priceAnnual: 97,
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
    name: "Agency",
    priceMonthly: 397,
    priceAnnual: 297,
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

function PricingPopularBackground() {
  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden rounded-[inherit] bg-gradient-brand"
      aria-hidden
    />
  );
}

function AnimatedPrice({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.85, opacity: 0.85 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn("inline-block", className)}
    >
      ${value}
    </motion.span>
  );
}

function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");
  return (
    <section id="pricing" className="py-24 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-16 md:mb-20">
          <div className="text-left">
            <h2 className="text-h2 font-medium tracking-tight text-foreground mb-4 max-w-[600px]">
              Predictable Pricing
            </h2>
            <p className="text-slate-700 max-w-[520px] font-normal">
              Start small, scale as you grow. No hidden fees. Cancel anytime.
            </p>
          </div>
          <div className="flex shrink-0 relative">
            {/* Save 25% callout – NW of Annual button, like it’s “saying” it */}
            <div
              className="absolute bottom-full right-2 mb-2 flex justify-end pointer-events-none"
              aria-hidden
            >
              <span className="inline-flex items-center rounded-full bg-emerald-500 text-white text-xs font-semibold px-3 py-1 whitespace-nowrap">
                Save 25%
              </span>
              <span className="absolute top-full right-6 -mt-px border-[6px] border-transparent border-t-emerald-500" />
            </div>
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
                    : "text-foreground/80 hover:text-foreground bg-transparent"
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
                    : "text-foreground/80 hover:text-foreground bg-transparent"
                }`}
              >
                Annual
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, i) => (
            <BlurFade key={plan.name} inView inViewMargin="-40px" delay={i * 0.06}>
              <div
                className={`relative flex flex-col rounded-2xl p-6 md:p-8 transition-all h-full overflow-visible ${
                  plan.popular
                    ? "border-0 shadow-xl"
                    : "bg-white border border-black/5 hover:shadow-xs"
                }`}
              >
                {plan.popular && (
                  <div className="absolute inset-0 rounded-[inherit] overflow-hidden z-0">
                    <PricingPopularBackground />
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
                <div
                  className={`flex-1 relative flex flex-col ${
                    plan.popular
                      ? "z-20 [text-shadow:0_1px_2px_rgba(0,0,0,0.28)]"
                      : "z-0"
                  }`}
                >
                  <h3
                    className={`text-xl md:text-2xl font-medium tracking-tight ${
                      plan.popular ? "text-white" : "text-foreground"
                    }`}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={`mt-2 text-sm font-normal ${
                      plan.popular ? "text-white" : "text-slate-600"
                    }`}
                  >
                    {plan.description}
                  </p>
                  <div className="mt-5">
                    {(() => {
                      const displayPrice =
                        billingPeriod === "annual" ? plan.priceAnnual : plan.priceMonthly;
                      const annualTotal = plan.priceAnnual * 12;
                      return (
                        <>
                          <AnimatedPrice
                            value={displayPrice}
                            className={cn(
                              "text-3xl md:text-4xl font-medium",
                              plan.popular ? "text-white" : "text-foreground"
                            )}
                          />
                          <span
                            className={`text-base font-normal ml-0.5 ${
                              plan.popular ? "text-white" : "text-slate-600"
                            }`}
                          >
                            /month
                          </span>
                          {billingPeriod === "annual" && (
                            <p
                              className={`mt-1 text-sm ${
                                plan.popular ? "text-white" : "text-slate-600"
                              }`}
                            >
                              Billed annually at ${annualTotal.toLocaleString()}
                            </p>
                          )}
                        </>
                      );
                    })()}
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
                      <a href={`${APP_BASE}/signup`}>
                        Start free
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
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
                        className="flex items-center gap-3 text-sm font-medium"
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
                              :                               plan.popular
                                ? "text-white/85"
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
const faqItems = LANDING_FAQ_ITEMS;

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
        <nav
          className="max-w-[640px] mx-auto mt-10 pt-8 border-t border-black/[0.06] space-y-2 text-center"
          aria-label="Related guides"
        >
          <p className="text-sm text-muted-foreground mb-3">Learn more</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link
                href="/ai-ad-creative-generator"
                className="text-foreground font-medium hover:underline underline-offset-2"
              >
                Learn more about AI ad creative generation →
              </Link>
            </li>
            <li>
              <Link
                href="/adcreative-ai-alternative"
                className="text-foreground font-medium hover:underline underline-offset-2"
              >
                See how Blinkify compares to AdCreative.ai →
              </Link>
            </li>
            <li>
              <Link
                href="/ai-marketing-tools-shopify"
                className="text-foreground font-medium hover:underline underline-offset-2"
              >
                AI marketing tools for Shopify →
              </Link>
            </li>
            <li>
              <Link
                href="/product-photo-to-ad"
                className="text-foreground font-medium hover:underline underline-offset-2"
              >
                Product photo to ad campaign guide →
              </Link>
            </li>
          </ul>
        </nav>
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
            <a href={`${APP_BASE}/signup`}>
              Start free
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}


export default function LandingBelowFold() {
  return (
    <>
      <SectionDivider />
      <VisualDemoSection />
      <SectionDivider />
      <HowItWorksSection />
      <SectionDivider />
      <ValueSection />
      <SectionDivider />
      <AICreativesCarouselSection />
      <SectionDivider />
      <CostCalculatorSection />
      <SectionDivider />
      <StatsBentoSection />
      <SectionDivider />
      <TestimonialBentoSection />
      <SectionDivider />
      <PricingSection />
      <SectionDivider />
      <FAQSection />
      <SectionDivider />
      <FinalCTASection />
    </>
  );
}

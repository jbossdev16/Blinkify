"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BlinkifyLogo } from "@/components/blinkify-logo";
import { cn } from "@/lib/utils";

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL === "https://blinkify.ai"
    ? "https://app.blinkify.ai"
    : "";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-50 transition-colors duration-200", scrolled ? "bg-[#ffffff]" : "bg-transparent")}>
      <div className="max-w-[1200px] mx-auto min-h-[68px] pt-3 pb-3 px-4 flex items-center justify-between relative">
        <div className="flex items-center shrink-0">
          <BlinkifyLogo variant="full" height={30} href="/" className="text-xl" priority />
        </div>
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          <Link
            href="/#how-it-works"
            className="text-body-sm font-medium text-[#000000] transition-all duration-200 hover:-translate-y-0.5"
          >
            How it Works
          </Link>
          <Link
            href="/#who-its-for"
            className="text-body-sm font-medium text-[#000000] transition-all duration-200 hover:-translate-y-0.5"
          >
            Use Cases
          </Link>
          <Link
            href="/#value"
            className="text-body-sm font-medium text-[#000000] transition-all duration-200 hover:-translate-y-0.5"
          >
            Features
          </Link>
          <Link
            href="/#pricing"
            className="text-body-sm font-medium text-[#000000] transition-all duration-200 hover:-translate-y-0.5"
          >
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={`${APP_BASE}/signin`}
            className="inline-flex items-center justify-center rounded-md border-2 border-transparent bg-white px-5 h-10 text-sm font-semibold text-[#000000] transition-colors hover:bg-slate-50 [background:linear-gradient(white,white)_padding-box,linear-gradient(135deg,#0079d0_0,#9e52d8_32%,#da365c_84%,#d04901_100%)_border-box]"
          >
            Log in
          </a>
            <Button asChild size="sm" className="font-semibold h-10 px-6 rounded-md bg-primary hover:bg-primary/90 border-0 text-primary-foreground">
            <a href={`${APP_BASE}/signup`}>Sign up</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

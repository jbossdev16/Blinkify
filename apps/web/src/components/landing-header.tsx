"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BlinkifyLogo } from "@/components/blinkify-logo";

export function LandingHeader() {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY.current) setVisible(false);
      else setVisible(true);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-[opacity,transform] duration-300 ease-out bg-[#ffffff] border-b border-black/[0.06]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-12px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="max-w-[1200px] mx-auto min-h-[68px] pt-3 pb-3 px-4 flex items-center justify-between relative">
        <div className="flex items-center shrink-0">
          <BlinkifyLogo variant="full" height={40} href="/" className="text-xl" />
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
          <Button asChild size="sm" className="font-semibold h-10 px-6">
            <Link href="/waitlist">Join Waitlist</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

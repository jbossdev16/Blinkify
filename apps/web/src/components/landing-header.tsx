"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlinkifyLogo } from "@/components/blinkify-logo";

export function LandingHeader() {
  return (
    <header className="bg-[#ffffff] border-b border-black/[0.06]">
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

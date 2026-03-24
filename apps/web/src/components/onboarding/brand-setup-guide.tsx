"use client";

import { cn } from "@/lib/utils";

interface BrandSetupGuideProps {
  onComplete: () => void;
  brandName: string;
  /** Primary brand hex (e.g. from project colors) for the step pill background */
  brandColor?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function BrandSetupGuide({ onComplete, brandName, brandColor }: BrandSetupGuideProps) {
  const canContinue = brandName.trim().length > 0;
  const validBrandHex = !!(brandColor && HEX.test(brandColor));

  return (
    <div className="mb-6 border-b border-border px-6 py-4">
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-[#ffffff]",
            !validBrandHex && "bg-primary"
          )}
          style={validBrandHex ? { backgroundColor: brandColor } : undefined}
        >
          Step 1 of 2
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Set up your brand to start generating</p>
          <p className="text-xs text-muted-foreground">
            Enter your website URL and click Apply Brand - we&apos;ll fill everything in automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onComplete}
          disabled={!canContinue}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Continue to Studio →
        </button>
      </div>
    </div>
  );
}

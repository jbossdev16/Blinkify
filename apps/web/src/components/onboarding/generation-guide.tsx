"use client";

import { cn } from "@/lib/utils";

interface GenerationGuideProps {
  productAdded: boolean;
}

export function GenerationGuidePanel() {
  return (
    <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <ShimmerCard />
        <ShimmerCard />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground text-center">Your ad creatives will appear here</p>
      <p className="mt-1 text-xs text-muted-foreground text-center">1K or 4K quality</p>
    </div>
  );
}

export function GenerationGuideBar({ productAdded }: GenerationGuideProps) {
  return (
    <>
      <div className="w-full border-y border-border bg-secondary/60 px-5 py-2.5 flex items-center gap-3">
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
          Step 2 of 2
        </span>
        <p className={cn("flex-1 text-xs", productAdded ? "text-green-600 dark:text-green-400" : "text-foreground")}>
          {productAdded
            ? "✓ Product photo added - now click Send to generate your creative"
            : "Upload your product photo and describe what you want"}
        </p>
        <span className="text-muted-foreground text-base onboarding-bounce-down">↓</span>
      </div>
      <style jsx global>{`
        @keyframes bounce-down {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(4px);
          }
        }
        .onboarding-bounce-down {
          animation: bounce-down 1.5s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}

function ShimmerCard() {
  return <div className="aspect-[4/5] rounded-xl border border-border bg-gradient-to-r from-muted/50 via-muted/20 to-muted/50 animate-pulse" />;
}

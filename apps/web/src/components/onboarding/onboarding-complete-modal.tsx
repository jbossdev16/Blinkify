"use client";

import { useRouter } from "next/navigation";
import { BlinkifyLogo } from "@/components/blinkify-logo";

interface OnboardingCompleteModalProps {
  onClose: () => void;
}

export function OnboardingCompleteModal({ onClose }: OnboardingCompleteModalProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-[90vw] max-w-[460px] rounded-[20px] border border-border bg-card p-10 shadow-2xl">
        <div className="flex justify-center mb-5">
          <div className="size-11 rounded-xl border border-border bg-background flex items-center justify-center">
            <BlinkifyLogo variant="icon" height={20} />
          </div>
        </div>

        <h2 className="text-center text-2xl font-bold text-foreground">You&apos;re all set</h2>
        <p className="mt-3 text-center text-[15px] leading-relaxed text-muted-foreground">
          ✦ Your first creative is ready — download it from the preview and test it as an ad.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Continue Creating
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/setup-plan");
            }}
            className="flex-1 h-12 rounded-xl border border-border bg-secondary/50 text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
          >
            Unlock More Options
          </button>
        </div>
      </div>
    </div>
  );
}

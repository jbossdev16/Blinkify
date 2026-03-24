"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { BlinkifyLogo } from "@/components/blinkify-logo";
import { useOnboarding } from "@/hooks/use-onboarding";

interface WelcomeModalProps {
  onClose: () => void;
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const router = useRouter();
  const { setStep, dismiss } = useOnboarding();

  function handleStart() {
    setStep("1");
    onClose();
    router.push("/brand");
  }

  function handleSkip() {
    dismiss();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-[90vw] max-w-[460px] rounded-[20px] border border-border bg-card p-10 shadow-2xl">
        <div className="flex justify-center mb-5">
          <div className="size-11 rounded-xl border border-border bg-background flex items-center justify-center">
            <BlinkifyLogo variant="icon" height={20} />
          </div>
        </div>

        <h2 className="text-center text-2xl font-bold text-foreground">Welcome to Blinkify</h2>
        <p className="mt-3 text-center text-[15px] leading-relaxed text-muted-foreground">
          You&apos;re 2 steps away from your first professional ad creative. Let&apos;s set up your brand - it
          takes 30 seconds.
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Dot active label="Brand" />
          <span>·</span>
          <Dot label="Generate" />
          <span>·</span>
          <Dot label="Done" />
        </div>

        <div className="mt-5 rounded-xl bg-secondary/50 p-4 space-y-2.5">
          <Row text="100 free credits to generate with" />
          <Row text="1K and 4K ad creative images" />
          <Row text="Marketing email generator" />
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="mt-6 h-12 w-full rounded-xl bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
        >
          Set Up My Brand →
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip - I&apos;ll explore on my own
        </button>
      </div>
    </div>
  );
}

function Dot({ active = false, label }: { active?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={active ? "size-2.5 rounded-full bg-primary" : "size-2.5 rounded-full bg-muted-foreground/40"} />
      <span>{label}</span>
    </span>
  );
}

function Row({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-foreground">
      <Check className="size-4 text-green-500" />
      <span>{text}</span>
    </div>
  );
}

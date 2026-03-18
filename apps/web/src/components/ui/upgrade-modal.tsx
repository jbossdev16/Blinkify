"use client";

import { useRouter } from "next/navigation";

export interface UpgradeModalProps {
  feature: string;
  requiredPlan: "standard" | "pro";
  onClose: () => void;
}

const COPY: Record<
  string,
  { title: string; body: string }
> = {
  full_campaign: {
    title: "Unlock Full Campaign",
    body: "Full Campaign generates 6 ad images, 2 videos, email marketing, and social copy from one product photo. Available on Professional and Agency plans.",
  },
  video: {
    title: "Unlock Video Generation",
    body: "Generate product videos for Meta, TikTok, and Reels. Available on Professional and Agency plans.",
  },
  credits_empty: {
    title: "Out of Credits",
    body: "You've used all your free credits. Upgrade to get more credits and unlock all features.",
  },
  email: {
    title: "Unlock Marketing Email",
    body: "Generate on-brand marketing emails with hero images. Available on Standard and higher plans.",
  },
};

export function UpgradeModal({ feature, requiredPlan, onClose }: UpgradeModalProps) {
  const router = useRouter();
  const c = COPY[feature] ?? COPY["credits_empty"]!;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 text-foreground">
        <h2 id="upgrade-modal-title" className="text-lg font-semibold mb-2">
          {c.title}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{c.body}</p>
        <p className="text-xs text-muted-foreground mb-4">
          {requiredPlan === "pro"
            ? "Requires Professional or Agency."
            : "Upgrade to Standard or higher for more credits."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/setup-plan");
            }}
            className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Upgrade Now
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-secondary/50 py-3 text-sm font-medium hover:bg-secondary transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

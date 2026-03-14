"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const BILLING_PLANS = [
  { key: "standard" as const, name: "Standard", price: "$39", description: "400 credits/mo, 1 brand" },
  { key: "professional" as const, name: "Professional", price: "$119", description: "1,500 credits/mo, 3 brands" },
  { key: "ultra" as const, name: "Agency", price: "$397", description: "5,000 credits/mo, 10 brands" },
];

function planMatchesCurrent(planKey: string, currentPlan: string | null): boolean {
  if (!currentPlan) return false;
  const p = currentPlan.toLowerCase();
  if (planKey === "standard") return p === "standard" || p === "starter";
  if (planKey === "professional") return p === "professional" || p === "pro";
  if (planKey === "ultra") return p === "agency" || p === "ultra";
  return false;
}

interface BillingUpgradeModalProps {
  currentPlan: string | null;
  /** Optional class for the trigger button (e.g. "mt-0" for inline use). */
  buttonClassName?: string;
}

export function BillingUpgradeModal({ currentPlan, buttonClassName }: BillingUpgradeModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"plan" | "checkout">("plan");
  const [selectedPlan, setSelectedPlan] = useState<typeof BILLING_PLANS[0] | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpen = useCallback(() => {
    setOpen(true);
    setStep("plan");
    setSelectedPlan(null);
    setCheckoutUrl(null);
    setError("");
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setStep("plan");
    setSelectedPlan(null);
    setCheckoutUrl(null);
    setError("");
  }, []);

  const handleSelectPlan = useCallback(
    async (plan: (typeof BILLING_PLANS)[0]) => {
      setSelectedPlan(plan);
      setError("");
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/checkout/create-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: plan.key,
            billing: "monthly",
            skipTrial: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to start checkout");
          setLoading(false);
          return;
        }
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const sep = data.url?.includes("?") ? "&" : "?";
        const embedUrl = `${data.url}${sep}embed=true&embed_origin=${encodeURIComponent(origin)}&theme=light`;
        setCheckoutUrl(embedUrl);
        setStep("checkout");
      } catch {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    },
    []
  );

  const handleCheckoutMessage = useCallback(
    (event: MessageEvent) => {
      if (event.origin !== "https://polar.sh" && event.origin !== "https://sandbox.polar.sh") return;
      if (event.data?.type !== "POLAR_CHECKOUT") return;
      if (event.data?.event === "success") {
        handleClose();
        router.refresh();
      }
    },
    [handleClose, router]
  );

  useEffect(() => {
    if (step !== "checkout" || !checkoutUrl) return;
    window.addEventListener("message", handleCheckoutMessage);
    return () => window.removeEventListener("message", handleCheckoutMessage);
  }, [step, checkoutUrl, handleCheckoutMessage]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 rounded-xl px-3 mt-4",
          buttonClassName
        )}
      >
        Upgrade
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-md"
              onClick={handleClose}
              aria-hidden
            />
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
              <div
                className={cn(
                  "relative rounded-2xl border border-border bg-card shadow-xl w-full max-w-lg overflow-hidden transition-all duration-200 my-auto pointer-events-auto",
                  step === "checkout" && "max-w-2xl"
                )}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="billing-plan-title"
              >
                {step === "plan" && (
                  <>
                    <div className="p-5 border-b border-border bg-card">
                      <h2 id="billing-plan-title" className="text-lg font-semibold text-foreground">Choose a plan</h2>
                      <p className="text-sm text-muted-foreground mt-1">Select a package to upgrade. You will be charged immediately.</p>
                    </div>
                    <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                      {error && (
                        <p className="text-sm text-destructive mb-2" role="alert">
                          {error}
                        </p>
                      )}
                      {BILLING_PLANS.map((plan) => {
                        const isCurrent = planMatchesCurrent(plan.key, currentPlan);
                        return (
                          <button
                            key={plan.key}
                            type="button"
                            disabled={loading}
                            onClick={() => handleSelectPlan(plan)}
                            className={cn(
                              "w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                              isCurrent
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                          >
                            <div>
                              <p className="font-medium text-foreground">{plan.name}</p>
                              <p className="text-xs text-muted-foreground">{plan.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isCurrent && (
                                <span className="text-xs font-medium text-primary">Current</span>
                              )}
                              <span className="font-semibold text-foreground">{plan.price}/mo</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-4 border-t border-border flex justify-end">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
                {step === "checkout" && checkoutUrl && (
                  <>
                    <div className="p-3 border-b border-border flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        Complete payment — {selectedPlan?.name}
                      </p>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                    <div className="h-[70vh] min-h-[400px] w-full">
                      <iframe
                        src={checkoutUrl}
                        title="Polar checkout"
                        className="w-full h-full border-0 block"
                        allow="payment 'self' https://polar.sh https://sandbox.polar.sh; publickey-credentials-get 'self' https://polar.sh https://sandbox.polar.sh"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

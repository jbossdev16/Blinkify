"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { BillingUpgradeModal } from "@/components/dashboard/billing-upgrade-modal";
import { apiClientFetch } from "@/lib/api-client";

interface BillingCreditUsageCardProps {
  credits: number;
  plan: string;
  used: number;
  max: number;
  usagePct: number;
}

function planDisplayName(plan: string): string {
  const p = plan.toLowerCase();
  if (p === "ultra") return "Agency";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function BillingCreditUsageCard({ credits, plan, used, max, usagePct }: BillingCreditUsageCardProps) {
  const router = useRouter();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const handleCancelConfirm = useCallback(async () => {
    setCancelError("");
    setCancelLoading(true);
    try {
      await apiClientFetch("/checkout/cancel-subscription", { method: "POST" });
      setCancelModalOpen(false);
      router.refresh();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Failed to cancel subscription");
    } finally {
      setCancelLoading(false);
    }
  }, [router]);

  const tooltipText = `${used} / ${max} used · ${usagePct}% consumed`;
  const packageName = planDisplayName(plan);

  return (
    <DashboardCard className="min-h-[140px] flex flex-col justify-center shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-stretch sm:justify-between gap-4">
        <div className="flex flex-col min-w-0 flex-1 sm:max-w-[50%]">
          <p className="text-3xl font-bold tracking-tight tabular-nums">{credits}</p>
          <div
            className="mt-4 h-2 w-full rounded-full bg-secondary/60 overflow-hidden cursor-default min-h-[8px]"
            title={tooltipText}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, usagePct)}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col justify-end items-start sm:items-end gap-2 shrink-0 sm:w-1/2 sm:min-w-0">
          <p className="text-lg font-semibold text-foreground">Current Plan {packageName}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <BillingUpgradeModal
              currentPlan={plan}
              buttonClassName="mt-0 cursor-pointer flex items-center justify-center h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 hover:bg-primary transition-opacity border-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-[120px]"
            />
            <button
              type="button"
              onClick={() => { setCancelError(""); setCancelModalOpen(true); }}
              className="mt-0 cursor-pointer flex items-center justify-center h-10 rounded-xl bg-card border border-border text-foreground text-sm font-medium hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-[120px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      {cancelModalOpen && typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-md"
              onClick={() => !cancelLoading && setCancelModalOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
              <div
                className="relative rounded-2xl border border-border bg-card shadow-xl w-full max-w-md overflow-hidden transition-all duration-200 my-auto p-5 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-subscription-title"
              >
                <h2 id="cancel-subscription-title" className="text-lg font-semibold text-foreground">
                  Cancel Subscription?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  You are about to cancel {packageName} and will not be billed nor have access to the account after the period ends. Are you sure?
                </p>
                {cancelError && (
                  <p className="mt-2 text-sm text-destructive" role="alert">{cancelError}</p>
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !cancelLoading && setCancelModalOpen(false)}
                    disabled={cancelLoading}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelConfirm}
                    disabled={cancelLoading}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelLoading ? "Canceling…" : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </DashboardCard>
  );
}

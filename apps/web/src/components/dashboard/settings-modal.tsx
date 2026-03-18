"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Settings,
  Shield,
  User,
  CreditCard,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_MAX_CREDITS } from "@/lib/constants";
import { BillingUpgradeModal } from "@/components/dashboard/billing-upgrade-modal";
import { apiClientFetch } from "@/lib/api-client";

/* ─── Types ───────────────────────────────────────────────────────────── */

type Tab = "general" | "security" | "account" | "plan";

interface SettingsModalProps {
  onClose: () => void;
  plan?: string | null;
  credits?: number | null;
  initialTab?: Tab;
}

export interface SettingsContentProps {
  /** When set, show close button (modal). When unset, show back link (page). */
  onClose?: () => void;
  plan?: string | null;
  credits?: number | null;
  initialTab?: Tab;
}

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "security", label: "Security", icon: Shield },
  { id: "account", label: "Account", icon: User },
  { id: "plan", label: "Manage Plan", icon: CreditCard },
];

/* ─── Shared content (modal + page) ────────────────────────────────────── */

export function SettingsContent({ onClose, plan, credits, initialTab }: SettingsContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "general");

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="relative w-full max-w-2xl rounded-2xl bg-background border border-border shadow-sm flex overflow-hidden max-h-[80vh]">
      <div className="w-48 shrink-0 border-r border-border bg-secondary/20 py-4 flex flex-col">
        {!onClose && (
          <Link
            href="/creative-studio"
            className="flex items-center gap-2 px-3 py-2 mb-3 ml-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-colors w-fit"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        )}

        <nav className="px-2 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                activeTab === tab.id
                  ? "bg-secondary/80 text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <tab.icon className="size-4 shrink-0" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "general" && <GeneralTab showHeading={false} />}
        {activeTab === "security" && <SecurityTab showHeading={false} />}
        {activeTab === "account" && <AccountTab showHeading={false} />}
        {activeTab === "plan" && <ManagePlanTab plan={plan ?? "free"} credits={credits ?? 0} />}
      </div>
    </div>
  );
}

/* ─── Modal wrapper ────────────────────────────────────────────────────── */

export function SettingsModal({ onClose, plan, credits, initialTab }: SettingsModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
      <SettingsContent onClose={onClose} plan={plan} credits={credits} initialTab={initialTab} />
    </div>
  );
}

/* ─── Page layout: vertical sections (same width as billing) ────────────── */

export function SettingsContentSections() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold mb-4">General</h2>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <GeneralTab showHeading={false} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-4">Security</h2>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <SecurityTab showHeading={false} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <AccountTab showHeading={false} />
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB PANELS
   ═══════════════════════════════════════════════════════════════════════ */

function planDisplayName(plan: string): string {
  const p = plan.toLowerCase();
  if (p === "ultra") return "Agency";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/* ─── Manage Plan ─────────────────────────────────────────────────────── */

function ManagePlanTab({ plan, credits }: { plan: string; credits: number }) {
  const router = useRouter();
  const max = PLAN_MAX_CREDITS[plan.toLowerCase()] ?? 100;
  const used = max - credits;
  const usagePct = max > 0 ? Math.round((used / max) * 100) : 0;
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

  return (
    <div>
      <div className="flex items-center justify-between py-3 border-b border-border">
        <p className="text-sm font-medium">Credit Usage</p>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm tabular-nums text-muted-foreground">{used} / {max}</span>
          <div className="w-24 h-2 rounded-full bg-secondary/60 overflow-hidden" title={`${usagePct}% used`}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, usagePct)}%` }} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between py-3 border-b border-border">
        <p className="text-sm font-medium">Current Plan</p>
        <span className="text-sm font-medium text-foreground">{planDisplayName(plan)}</span>
      </div>
      <div className="flex items-center justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={() => { setCancelError(""); setCancelModalOpen(true); }}
          className="mt-0 cursor-pointer flex items-center justify-center h-10 rounded-xl bg-card border border-border text-foreground text-sm font-medium hover:bg-destructive hover:text-destructive-foreground hover:border-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-[120px]"
        >
          Cancel
        </button>
        <BillingUpgradeModal
          currentPlan={plan}
          buttonClassName="!mt-0 cursor-pointer flex items-center justify-center h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 hover:bg-primary border-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-[120px]"
        />
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
                  You are about to cancel {planDisplayName(plan)} and will not be billed nor have access to the account after the period ends. Are you sure?
                </p>
                {cancelError && (
                  <p className="mt-2 text-sm text-destructive" role="alert">{cancelError}</p>
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !cancelLoading && setCancelModalOpen(false)}
                    disabled={cancelLoading}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
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
    </div>
  );
}

/* ─── General ─────────────────────────────────────────────────────────── */

const GUI_SCALE_STEPS = [
  { value: 0.75, label: "0.75×" },
  { value: 0.875, label: "0.875×" },
  { value: 1, label: "1×" },
  { value: 1.125, label: "1.125×" },
  { value: 1.25, label: "1.25×" },
  { value: 1.5, label: "1.5×" },
  { value: 2, label: "2×" },
];

function GeneralTab({ showHeading = true }: { showHeading?: boolean }) {
  const [appearance, setAppearance] = useState<"system" | "light" | "dark">("system");
  const [language, setLanguage] = useState("en");
  const [guiScale, setGuiScale] = useState(1);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const isDragging = useRef(false);

  // Sync with current theme + GUI scale on mount
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") setAppearance("dark");
    else if (stored === "light") setAppearance("light");
    else setAppearance("system");

    const storedScale = localStorage.getItem("gui-scale");
    if (storedScale) setGuiScale(parseFloat(storedScale) || 1);
  }, []);

  function handleAppearanceChange(value: string) {
    const v = value as "system" | "light" | "dark";
    setAppearance(v);

    if (v === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      localStorage.removeItem("theme");
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      localStorage.setItem("theme", v);
      document.documentElement.classList.toggle("dark", v === "dark");
    }
  }

  function applyGuiScale(value: number) {
    setGuiScale(value);
    localStorage.setItem("gui-scale", String(value));
    document.documentElement.style.fontSize = `${value * 16}px`;
  }

  // Find closest step index for the slider
  const stepIndex = GUI_SCALE_STEPS.findIndex((s) => s.value === guiScale);
  const currentIndex = stepIndex >= 0 ? stepIndex : 2; // default to 1×
  const displayIndex = previewIndex ?? currentIndex;

  return (
    <div>
      {showHeading && <h2 className="text-lg font-semibold mb-6">General</h2>}

      <SettingRow label="Appearance">
        <SettingSelect
          value={appearance}
          onChange={handleAppearanceChange}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </SettingRow>

      <SettingRow label="Language">
        <SettingSelect
          value={language}
          onChange={setLanguage}
          options={[
            { value: "en", label: "English" },
          ]}
        />
      </SettingRow>

      <SettingRow
        label="GUI Size"
        description="Adjust the size of interface elements. Applied on release."
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={GUI_SCALE_STEPS.length - 1}
            step={1}
            value={displayIndex}
            onChange={(e) => {
              isDragging.current = true;
              setPreviewIndex(Number(e.target.value));
            }}
            onPointerUp={() => {
              if (previewIndex !== null) {
                applyGuiScale(GUI_SCALE_STEPS[previewIndex].value);
                setPreviewIndex(null);
              }
              isDragging.current = false;
            }}
            onMouseUp={() => {
              if (previewIndex !== null) {
                applyGuiScale(GUI_SCALE_STEPS[previewIndex].value);
                setPreviewIndex(null);
              }
              isDragging.current = false;
            }}
            className="w-28 h-1.5 accent-primary cursor-pointer"
          />
          <span className="text-xs font-medium text-muted-foreground w-10 text-right">
            {GUI_SCALE_STEPS[displayIndex].label}
          </span>
        </div>
      </SettingRow>
    </div>
  );
}

/* ─── Security ────────────────────────────────────────────────────────── */

function SecurityTab({ showHeading = true }: { showHeading?: boolean }) {
  return (
    <div>
      {showHeading && <h2 className="text-lg font-semibold mb-6">Security</h2>}

      <SettingRow label="Change password" description="Update your account password.">
        <button className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
          Change
        </button>
      </SettingRow>

      <SettingRow label="Two-factor authentication" description="Add an extra layer of security to your account.">
        <button className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
          Enable
        </button>
      </SettingRow>
    </div>
  );
}

/* ─── Account ─────────────────────────────────────────────────────────── */

function AccountTab({ showHeading = true }: { showHeading?: boolean }) {
  return (
    <div>
      {showHeading && <h2 className="text-lg font-semibold mb-6">Account</h2>}

      <SettingRow label="Delete account" description="Permanently delete your account and all data. This cannot be undone.">
        <button className="px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer">
          Delete
        </button>
      </SettingRow>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARED UI
   ═══════════════════════════════════════════════════════════════════════ */

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
      <div className="min-w-0 flex-1 mr-4">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-8 rounded-lg border border-input bg-background px-3 pr-7 text-xs font-medium focus:outline-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
    </div>
  );
}


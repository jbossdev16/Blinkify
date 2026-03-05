"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Settings,
  Shield,
  User,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ───────────────────────────────────────────────────────────── */

type Tab = "general" | "security" | "account";

interface SettingsModalProps {
  onClose: () => void;
}

export interface SettingsContentProps {
  /** When set, show close button (modal). When unset, show back link (page). */
  onClose?: () => void;
}

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "security", label: "Security", icon: Shield },
  { id: "account", label: "Account", icon: User },
];

/* ─── Shared content (modal + page) ────────────────────────────────────── */

export function SettingsContent({ onClose }: SettingsContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");

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
      </div>
    </div>
  );
}

/* ─── Modal wrapper ────────────────────────────────────────────────────── */

export function SettingsModal({ onClose }: SettingsModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <SettingsContent onClose={onClose} />
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


"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Palette,
  Sparkles,
  Menu,
  X,
  Coins,
  PanelLeftClose,
  LogOut,
  Bookmark,
  Settings,
  HelpCircle,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlanFeatures } from "@/lib/constants";
import { BlinkifyLogo } from "@/components/blinkify-logo";
import { SettingsModal } from "@/components/dashboard/settings-modal";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useOnboarding } from "@/hooks/use-onboarding";
import { ChevronDown as ChevronDownIcon, Plus } from "lucide-react";

/* ─── Props ───────────────────────────────────────────────────────────── */

interface SidebarProps {
  user: {
    name: string | null;
    email: string | null;
    avatar: string | null;
  };
  plan: string | null;
  credits: number | null;
  isAdmin?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/* ─── Nav items ───────────────────────────────────────────────────────── */

const baseNav = [
  { label: "Creative Studio", href: "/creative-studio", icon: Sparkles },
  { label: "Brand", href: "/brand", icon: Palette },
  { label: "Asset Collection", href: "/asset-collection", icon: Bookmark },
];

/* ─── Component ───────────────────────────────────────────────────────── */

export function Sidebar({
  user,
  plan,
  credits,
  isAdmin,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const nav = isAdmin
    ? [...baseNav, { label: "Admin", href: "/admin", icon: Shield }]
    : baseNav;
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"general" | "security" | "account" | "plan" | undefined>(undefined);
  const profileRef = useRef<HTMLDivElement>(null);

  const planFeatures = getPlanFeatures(plan ?? "free");
  const hasMultiBrand = planFeatures.maxBrands > 1;
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandProjects, setBrandProjects] = useState<{ id: string; name: string }[]>([]);
  const [brandProjectsLoaded, setBrandProjectsLoaded] = useState(false);
  const { getStep } = useOnboarding();
  const [onboardingStep, setOnboardingStep] = useState("0");
  const [creditsPulse, setCreditsPulse] = useState(false);
  /** false until mounted — must not call isDone()/localStorage during SSR (server vs client DOM mismatch). */
  const [showGettingStarted, setShowGettingStarted] = useState(false);

  useEffect(() => {
    setOnboardingStep(getStep());
  }, [pathname]);

  useEffect(() => {
    const sync = () => setOnboardingStep(getStep());
    window.addEventListener("blinkify:onboarding-change", sync);
    return () => window.removeEventListener("blinkify:onboarding-change", sync);
  }, [getStep]);

  useEffect(() => {
    const sync = () => {
      try {
        const step = window.localStorage.getItem("blinkify:onboarding:step") ?? "0";
        setShowGettingStarted(step !== "done");
      } catch {
        setShowGettingStarted(false);
      }
    };
    sync();
    window.addEventListener("blinkify:onboarding-change", sync);
    return () => window.removeEventListener("blinkify:onboarding-change", sync);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const generated = window.localStorage.getItem("blinkify:onboarding:generated") === "true";
    const seen = window.localStorage.getItem("blinkify:onboarding:credits_anim_seen") === "true";
    if (generated && !seen) {
      setCreditsPulse(true);
      window.localStorage.setItem("blinkify:onboarding:credits_anim_seen", "true");
      const t = window.setTimeout(() => setCreditsPulse(false), 1000);
      return () => window.clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!hasMultiBrand || brandProjectsLoaded) return;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("projects")
      .select("id, name")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setBrandProjects(data ?? []);
        setBrandProjectsLoaded(true);
      });
  }, [hasMultiBrand, brandProjectsLoaded]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [profileOpen]);

  async function handleSignOut() {
    setProfileOpen(false);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/signin");
    router.refresh();
  }

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  function openSettings(initialTab?: "general" | "security" | "account" | "plan") {
    setProfileOpen(false);
    setSettingsInitialTab(initialTab);
    setSettingsModalOpen(true);
  }

  /* ─── Sidebar content (shared between mobile drawer and desktop) ──── */

  const sidebarContent = (
    <>
      {/* Header: Logo + Collapse */}
      <div
        className={cn(
          "flex items-center py-4 shrink-0",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {collapsed ? (
          /* Collapsed: icon = expand button */
          <SidebarTooltip label="Open sidebar" side="right">
            <button
              onClick={onToggleCollapse}
              className="size-9 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity bg-background border border-border"
            >
              <BlinkifyLogo variant="icon" height={18} />
            </button>
          </SidebarTooltip>
        ) : (
          <>
            {/* Expanded: full logo */}
            <BlinkifyLogo variant="full" height={22} href="https://blinkify.ai" className="flex items-center" priority />

            {/* Collapse button */}
            <button
              onClick={onToggleCollapse}
              className="size-8 flex items-center justify-center rounded-lg text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
              title="Close sidebar"
            >
              <PanelLeftClose className="size-[18px]" />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1", collapsed ? "px-2" : "px-3")}>
        {nav.map((item) => {
          const isBrand = item.href === "/brand";
          const active = pathname === item.href || pathname.startsWith(item.href + "/") || pathname.startsWith(item.href + "?");

          if (isBrand && hasMultiBrand && !collapsed) {
            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-normal transition-colors cursor-pointer",
                    active
                      ? "text-foreground"
                      : "text-foreground hover:bg-secondary/50"
                  )}
                >
                  <item.icon className={cn("size-[18px] shrink-0", active && "icon-gradient-brand")} />
                  <span className={cn("flex-1 text-left", active && "text-foreground font-medium")}>{item.label}</span>
                  <ChevronDownIcon className={cn("size-3.5 transition-transform text-foreground", brandDropdownOpen && "rotate-180")} />
                </button>
                {brandDropdownOpen && (
                  <div className="ml-9 mt-0.5 space-y-0.5">
                    {brandProjects.map((p) => {
                      const projActive = pathname === "/brand" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("project") === p.id;
                      return (
                        <Link
                          key={p.id}
                          href={`/brand?project=${p.id}`}
                          className={cn(
                            "block px-3 py-1.5 rounded-lg text-xs font-normal transition-colors truncate",
                            projActive
                              ? "text-foreground bg-secondary/50 font-medium"
                              : "text-black dark:text-foreground hover:bg-secondary/40 hover:text-foreground"
                          )}
                        >
                          {p.name}
                        </Link>
                      );
                    })}
                    {brandProjects.length < planFeatures.maxBrands && (
                      <Link
                        href="/brand?new=1"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-normal text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="size-3" />
                        New Brand
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          }

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-xl text-sm font-normal transition-colors",
                collapsed
                  ? "justify-center py-2.5 px-0"
                  : "gap-3 px-3 py-2.5",
                active
                  ? "text-foreground"
                  : "text-foreground hover:bg-secondary/50"
              )}
            >
              <item.icon
                className={cn(
                  "size-[18px] shrink-0",
                  active && "icon-gradient-brand"
                )}
              />
              {!collapsed && (
                <span className={cn(active && "text-foreground font-medium")}>
                  {item.label}
                </span>
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <SidebarTooltip key={item.href} label={item.label} side="right">
                {link}
              </SidebarTooltip>
            );
          }

          return link;
        })}
      </nav>

      {/* Bottom section */}
      <div className={cn("pb-4 space-y-1", collapsed ? "px-2" : "px-3")}>
        {showGettingStarted && !collapsed && (
          <div className="px-3 pb-2">
            <div className="rounded-xl bg-secondary/60 border border-border p-3">
              <p className="text-xs font-semibold text-foreground mb-2">Getting started</p>
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                    onboardingStep === "done" || onboardingStep === "2"
                      ? "bg-green-500 text-white"
                      : onboardingStep === "1"
                        ? "bg-primary text-white"
                        : "bg-secondary border border-border text-muted-foreground"
                  )}
                >
                  {onboardingStep === "done" || onboardingStep === "2" ? "✓" : "1"}
                </div>
                <span
                  className={cn(
                    "text-xs",
                    onboardingStep === "done" || onboardingStep === "2"
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  )}
                >
                  Set up your brand
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                    onboardingStep === "done"
                      ? "bg-green-500 text-white"
                      : onboardingStep === "2"
                        ? "bg-primary text-white"
                        : "bg-secondary border border-border text-muted-foreground"
                  )}
                >
                  {onboardingStep === "done" ? "✓" : "2"}
                </div>
                <span
                  className={cn(
                    "text-xs",
                    onboardingStep === "done" ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  Generate your first creative
                </span>
              </div>
              <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width:
                      onboardingStep === "0" || onboardingStep === "1"
                        ? "0%"
                        : onboardingStep === "2"
                          ? "50%"
                          : "100%",
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {/* Credits card */}
        {credits !== null && !collapsed && (
          <SidebarCreditsCard credits={credits} plan={plan ?? "free"} pulse={creditsPulse} />
        )}
        {credits !== null && collapsed && (
          <SidebarTooltip label={`${credits} credits · Manage plan`} side="right" enabled>
            <button
              type="button"
              onClick={() => openSettings("plan")}
              className="flex justify-center w-full py-2.5 rounded-xl text-[#007aff] dark:text-[#007aff] hover:bg-secondary/60 transition-colors cursor-pointer"
            >
              <Coins className="size-[18px]" />
            </button>
          </SidebarTooltip>
        )}

        {/* Profile: click opens popover with user menu (dark mode, Settings, Help, Log out) */}
        <div ref={profileRef} className="relative">
          {profileOpen && (
            <UserMenuPopover
              collapsed={collapsed}
              onOpenSettings={openSettings}
              onSignOut={handleSignOut}
            />
          )}
          <SidebarTooltip label={user.name || "Profile"} side="right" enabled={collapsed}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className={cn(
                "flex items-center w-full mt-1 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer",
                collapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2.5"
              )}
            >
              <UserAvatar user={user} size="size-8" />
              {!collapsed && (
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-normal truncate">{user.name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{sidebarPlanLabel(plan ?? "free")}</p>
                </div>
              )}
            </button>
          </SidebarTooltip>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden size-10 flex items-center justify-center rounded-xl bg-background border border-border shadow-sm cursor-pointer"
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {settingsModalOpen && (
        <SettingsModal
          onClose={() => { setSettingsModalOpen(false); setSettingsInitialTab(undefined); }}
          plan={plan}
          credits={credits}
          initialTab={settingsInitialTab}
        />
      )}

      {/* Sidebar — mobile full width; desktop flush left, full height */}
      <aside
        className={cn(
          "fixed z-40 flex flex-col transition-all duration-200",
          "left-0 top-0 h-screen w-56 bg-background border-r border-border",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          collapsed ? "lg:w-16" : "lg:w-56"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

/* ─── User menu popover ────────────────────────────────────────────────── */

type ThemeMode = "system" | "light" | "dark";

const THEME_CYCLE: ThemeMode[] = ["system", "light", "dark"];

function UserMenuPopover({
  collapsed,
  onOpenSettings,
  onSignOut,
}: {
  collapsed: boolean;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
    return "system";
  });

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") setTheme(stored);
    else setTheme("system");
  }, []);

  function cycleTheme() {
    const nextIndex = (THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length;
    const next = THEME_CYCLE[nextIndex];
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
    }
  }

  const themeLabel = theme === "system" ? "System" : theme === "light" ? "Light" : "Dark";
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const menuContent = (
    <div
      className={cn(
        "absolute bottom-full mb-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 z-50",
        collapsed ? "left-0 min-w-[220px]" : "left-0 right-0 min-w-[240px]"
      )}
    >
      <div className="py-1">
        <button
          type="button"
          onClick={cycleTheme}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
        >
          <ThemeIcon className="size-[18px] text-muted-foreground shrink-0" />
          <span className="flex-1 text-left">Dark mode</span>
          <span className="text-xs text-muted-foreground">{themeLabel}</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
        >
          <Settings className="size-[18px] text-muted-foreground shrink-0" />
          Settings
        </button>

        <Link
          href="/help"
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50 transition-colors"
        >
          <HelpCircle className="size-[18px] text-muted-foreground shrink-0" />
          <span className="flex-1 text-left">Help</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>

        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
        >
          <LogOut className="size-[18px] text-muted-foreground shrink-0" />
          Log out
        </button>
      </div>
    </div>
  );

  return menuContent;
}

/* ─── Sidebar credits card (image-style) ───────────────────────────────── */

export function sidebarPlanLabel(plan: string): string {
  const p = plan.toLowerCase();
  if (p === "free" || p === "trial") return "Free";
  if (p === "standard" || p === "starter") return "Standard";
  if (p === "pro" || p === "professional") return "Professional";
  if (p === "ultra" || p === "agency") return "Agency";
  if (p === "enterprise") return "Enterprise";
  return "Free";
}

function SidebarCreditsCard({ credits, plan, pulse = false }: { credits: number; plan: string; pulse?: boolean }) {
  const router = useRouter();
  const label = sidebarPlanLabel(plan);
  const noCredits = credits === 0;
  const isFreeish = label === "Free";

  return (
    <div className="px-3 py-2 space-y-2 text-sm text-foreground">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-muted-foreground shrink-0">Credits Left</span>
        <span className={cn("font-medium tabular-nums", pulse && "animate-pulse")}>
          {credits.toLocaleString("en-US")}
        </span>
      </div>
      <button
        type="button"
        onClick={() => router.push("/setup-plan")}
        className={cn(
          "w-full rounded-xl py-2 text-xs font-semibold text-white",
          noCredits && isFreeish
            ? "bg-[#ef4444] hover:bg-[#dc2626]"
            : "bg-[#3b82f6] hover:bg-[#2563eb]"
        )}
      >
        {noCredits && isFreeish ? "Upgrade to Continue" : "Upgrade plan"}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

function UserAvatar({
  user,
  size = "size-8",
}: {
  user: { name: string | null; email: string | null; avatar: string | null };
  size?: string;
}) {
  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        className={cn(size, "rounded-full object-cover shrink-0")}
      />
    );
  }
  return (
    <div
      className={cn(
        size,
        "rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs font-semibold shrink-0"
      )}
    >
      {(user.name?.[0] || user.email?.[0] || "?").toUpperCase()}
    </div>
  );
}

function SidebarTooltip({
  label,
  side = "right",
  enabled = true,
  children,
}: {
  label: string;
  side?: "right" | "top";
  enabled?: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;

  const positionClass =
    side === "right"
      ? "left-full ml-3 top-1/2 -translate-y-1/2"
      : "bottom-full mb-2 left-1/2 -translate-x-1/2";

  return (
    <div className="relative group">
      {children}
      <div
        className={cn(
          "absolute px-2 py-1 rounded-md bg-foreground text-background text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50",
          positionClass
        )}
      >
        {label}
      </div>
    </div>
  );
}

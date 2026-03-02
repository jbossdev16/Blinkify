"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Palette,
  Sparkles,
  Menu,
  X,
  Coins,
  PanelLeftClose,
  CreditCard,
  Info,
  LogOut,
  Bookmark,
  Settings,
  HelpCircle,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_MAX_CREDITS } from "@/lib/constants";
import { BlinkifyLogo } from "@/components/blinkify-logo";
import { SettingsModal } from "@/components/dashboard/settings-modal";
import { createSupabaseBrowserClient } from "@/lib/supabase";

/* ─── Props ───────────────────────────────────────────────────────────── */

interface SidebarProps {
  user: {
    name: string | null;
    email: string | null;
    avatar: string | null;
  };
  plan: string | null;
  credits: number | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/* ─── Nav items ───────────────────────────────────────────────────────── */

const baseNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Creative Studio", href: "/dashboard/creative-studio", icon: Sparkles },
  { label: "Brand", href: "/dashboard/brand", icon: Palette },
  { label: "Asset Collection", href: "/dashboard/asset-collection", icon: Bookmark },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
];

/* ─── Component ───────────────────────────────────────────────────────── */

export function Sidebar({
  user,
  plan,
  credits,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const nav = baseNav;
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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

  function openSettings() {
    setProfileOpen(false);
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
              <BlinkifyLogo variant="icon" height={22} />
            </button>
          </SidebarTooltip>
        ) : (
          <>
            {/* Expanded: full logo */}
            <BlinkifyLogo variant="full" height={28} href="https://blinkify.ai" className="flex items-center" />

            {/* Collapse button */}
            <button
              onClick={onToggleCollapse}
              className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors cursor-pointer"
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
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

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
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
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
        {/* Credits card */}
        {credits !== null && !collapsed && (
          <SidebarCreditsCard credits={credits} plan={plan ?? "trial"} />
        )}
        {credits !== null && collapsed && (
          <SidebarTooltip label={`${credits} credits`} side="right" enabled>
            <Link
              href="/dashboard/billing"
              className="flex justify-center py-2.5 rounded-xl bg-secondary/40 text-amber-500 hover:bg-secondary/60 transition-colors"
            >
              <Coins className="size-[18px]" />
            </Link>
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
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
        <SettingsModal onClose={() => setSettingsModalOpen(false)} />
      )}

      {/* Sidebar — mobile full width; desktop detached with card style (no floaty blur/shadow) */}
      <aside
        className={cn(
          "fixed z-40 flex flex-col transition-all duration-200",
          /* Mobile: full height, slide in/out */
          "h-screen w-64 bg-background border-r border-border",
          mobileOpen ? "translate-x-0 left-0 top-0" : "-translate-x-full left-0 top-0",
          /* Desktop: detached inset, solid card look */
          "lg:left-4 lg:top-4 lg:bottom-4 lg:h-[calc(100vh-2rem)] lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:shadow-none",
          collapsed ? "lg:translate-x-0 lg:w-16" : "lg:translate-x-0 lg:w-64"
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

const LOW_CREDITS_THRESHOLD = 0.2;

function SidebarCreditsCard({ credits, plan }: { credits: number; plan: string }) {
  const max = PLAN_MAX_CREDITS[plan.toLowerCase()] ?? 30;
  const used = max - credits;
  const pct = max > 0 ? Math.round((used / max) * 100) : 0;
  const lowCredits = credits <= max * LOW_CREDITS_THRESHOLD;

  return (
    <div className="relative group p-3">
      {lowCredits && (
        <div
          role="alert"
          className="absolute bottom-full left-0 right-0 mb-2 px-3 py-2 rounded-lg border border-amber-500/50 bg-amber-500/10 text-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none"
        >
          You’re at 20% or less of your plan credits ({credits} of {max} remaining).
          Consider upgrading to avoid running out.
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-foreground">
            {credits}
            <span className="font-normal text-muted-foreground"> credits left</span>
          </p>
        </div>
        <SidebarTooltip label={`Current Plan: ${plan.charAt(0).toUpperCase() + plan.slice(1)}`} side="top">
          <button
            type="button"
            className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors cursor-pointer shrink-0"
            aria-label="Credits info"
          >
            <Info className="size-4" />
          </button>
        </SidebarTooltip>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <Link
        href="/dashboard/billing"
        className="flex items-center justify-center w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Upgrade
      </Link>
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

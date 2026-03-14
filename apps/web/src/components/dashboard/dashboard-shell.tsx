"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

interface DashboardShellProps {
  user: {
    name: string | null;
    email: string | null;
    avatar: string | null;
  };
  plan: string | null;
  credits: number | null;
  isAdmin?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({ user, plan, credits, isAdmin, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Global gradient def for icon-gradient-brand (sidebar + dashboard) */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0079d0" />
            <stop offset="33%" stopColor="#9e52d8" />
            <stop offset="66%" stopColor="#da365c" />
            <stop offset="100%" stopColor="#d04901" />
          </linearGradient>
        </defs>
      </svg>
      <Sidebar
        user={user}
        plan={plan}
        credits={credits}
        isAdmin={isAdmin}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <main
        className={cn(
          "flex flex-col min-h-screen pt-14 lg:pt-0 bg-[#ffffff] dark:bg-background",
          collapsed ? "lg:pl-20" : "lg:pl-72"
        )}
      >
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}

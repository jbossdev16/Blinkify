"use client";

import { useEffect } from "react";

/**
 * Applies app-only dark mode when mounted (dashboard), and removes it on unmount
 * so the marketing site (signin, landing, etc.) always stays light.
 */
export function DashboardTheme({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    document.documentElement.classList.toggle("dark", stored === "dark");

    // Apply saved GUI scale
    const scale = parseFloat(localStorage.getItem("gui-scale") || "1") || 1;
    if (scale !== 1) {
      document.documentElement.style.fontSize = `${scale * 16}px`;
    }

    return () => {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.fontSize = "";
    };
  }, []);

  return <>{children}</>;
}

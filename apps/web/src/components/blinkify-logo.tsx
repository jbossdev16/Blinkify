"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { cn } from "@/lib/utils";

interface BlinkifyLogoProps {
  /** "full" = icon + wordmark (for headers, auth pages). "icon" = star only (for collapsed sidebar, favicon areas). */
  variant?: "full" | "icon";
  /** Height in pixels; width scales for "full", square for "icon". */
  height?: number;
  className?: string;
  /** Use for links (e.g. to blinkify.ai or /). */
  href?: string;
  /** Prefer dark icon (for light backgrounds). Icon asset is gradient star; no separate dark/light. */
  priority?: boolean;
}

export function BlinkifyLogo({
  variant = "full",
  height = 32,
  className,
  href,
  priority = false,
}: BlinkifyLogoProps) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const isFull = variant === "full";
  const lightSrc = isFull ? "/logo/blinkify-logo-color.svg" : "/logo/blinkify-icon-color.svg";
  const darkSrc = isFull ? "/logo/blinkify-icon-color-logo-white.svg" : "/logo/blinkify-icon-color.svg";
  const w = isFull ? Math.round(height * 3.2) : height;
  const src = dark ? darkSrc : lightSrc;

  const img = (
    <NextImage
      src={src}
      alt="Blinkify"
      width={w}
      height={height}
      className={cn("object-contain flex items-center", className)}
      priority={priority}
    />
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className={cn("inline-flex items-center shrink-0", className)}
      >
        {img}
      </a>
    );
  }

  return <span className={cn("inline-flex shrink-0", className)}>{img}</span>;
}

"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "a";
  href?: string;
}

const cardBase =
  "relative rounded-2xl border border-border bg-card p-5 overflow-visible transition-all duration-200";

/**
 * Card used across dashboard/app with gradient border glow on hover (mouse near edges).
 * Use as="a" and href for link cards (uses Next.js Link for client-side nav).
 */
export function DashboardCard({
  children,
  className,
  as: Tag = "div",
  href,
}: DashboardCardProps) {
  const content = (
    <>
      <GlowingEffect
        variant="brand"
        disabled={false}
        spread={24}
        borderWidth={1}
        className="z-10"
      />
      <div className="relative z-0">{children}</div>
    </>
  );

  if (Tag === "a" && href) {
    return (
      <Link href={href} className={cn(cardBase, className)}>
        {content}
      </Link>
    );
  }

  return <div className={cn(cardBase, className)}>{content}</div>;
}

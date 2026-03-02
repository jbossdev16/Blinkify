"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoProjectEmptyStateProps {
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
  icon: LucideIcon;
}

export function NoProjectEmptyState({
  title,
  description,
  ctaHref,
  ctaLabel,
  icon: Icon,
}: NoProjectEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] lg:min-h-[100vh] p-6 text-center">
      <div className="rounded-2xl border border-border px-8 py-12 max-w-md">
        <Icon className="mx-auto size-12 icon-gradient-brand mb-4" />
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
        <Button asChild className="mt-6">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { PLAN_MAX_CREDITS } from "@/lib/constants";

const ALERT_THRESHOLD = 0.2;

export function CreditsAlert({
  plan,
  credits,
}: {
  plan: string | null;
  credits: number | null;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (credits === null || plan === null || dismissed) return null;

  const max = PLAN_MAX_CREDITS[plan.toLowerCase()] ?? PLAN_MAX_CREDITS.trial;
  const threshold = Math.floor(max * ALERT_THRESHOLD);
  if (credits > threshold) return null;

  return (
    <Alert variant="default" className="rounded-lg border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>
          You’re at 20% or less of your plan credits ({credits} of {max} remaining).
          Consider upgrading to avoid running out.
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}

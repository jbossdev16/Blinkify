import { cn } from "@/lib/utils";

interface SpinnerProps {
  /** Size: sm (16px), default (24px), lg (32px) */
  size?: "sm" | "default" | "lg";
  /** Optional class for color override (default: text-primary) */
  className?: string;
}

const sizeMap = { sm: 16, default: 24, lg: 32 } as const;

/**
 * Modern minimal spinner — thin circular stroke, smooth rotation.
 * Use for loading states, buttons, and page transitions.
 */
export function Spinner({ size = "default", className }: SpinnerProps) {
  const s = sizeMap[size];
  const stroke = size === "sm" ? 2 : 2.5;
  const r = (s - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = circumference * 0.75;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("animate-spin text-primary", className)}
      aria-hidden
      role="img"
      aria-label="Loading"
    >
      <circle
        cx={s / 2}
        cy={s / 2}
        r={r}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference - gap} ${gap}`}
        strokeDashoffset={circumference * 0.25}
      />
    </svg>
  );
}

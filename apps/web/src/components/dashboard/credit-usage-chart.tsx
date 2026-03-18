"use client";

import { PLAN_MAX_CREDITS } from "@/lib/constants";

/**
 * Smooth wavy area chart rendered as pure SVG.
 * Shows a simulated credit-usage curve with a gradient fill.
 * No external dependencies.
 */

interface CreditUsageChartProps {
  credits: number;
  plan: string;
}

export function CreditUsageChart({ credits, plan }: CreditUsageChartProps) {
  const max = PLAN_MAX_CREDITS[plan.toLowerCase()] ?? PLAN_MAX_CREDITS.free;
  const used = max - credits;
  const pct = Math.round((used / max) * 100);

  // Generate a smooth "usage over time" curve that ends at the current usage %
  // 7 data points simulating weekly usage, ending near the real ratio
  const endY = used / max; // 0..1 where 1 = all used
  const points = generateSmoothCurve(endY, 7);

  const W = 280;
  const H = 80;
  const padX = 0;
  const padY = 6;

  const coords = points.map((y, i) => ({
    x: padX + (i / (points.length - 1)) * (W - padX * 2),
    y: padY + (1 - y) * (H - padY * 2), // invert: 0 = bottom, 1 = top
  }));

  // Build smooth cubic bezier path
  const d = smoothPath(coords);
  const areaD = `${d} L ${coords[coords.length - 1].x},${H} L ${coords[0].x},${H} Z`;

  return (
    <div className="flex flex-col gap-3">
      {/* Stat row */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold tracking-tight">{credits}</p>
          <p className="text-xs text-muted-foreground">credits remaining</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-muted-foreground">
            {used}
            <span className="text-xs font-normal"> / {max} used</span>
          </p>
          <p className="text-xs text-muted-foreground">{pct}% consumed</p>
        </div>
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {/* Filled area */}
        <path d={areaD} fill="url(#chartGrad)" />
        {/* Line */}
        <path
          d={d}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        <circle
          cx={coords[coords.length - 1].x}
          cy={coords[coords.length - 1].y}
          r="3"
          fill="hsl(var(--primary))"
        />
      </svg>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-brand transition-all duration-500"
          style={{ width: `${Math.max(1, 100 - pct)}%` }}
        />
      </div>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────── */

/** Generate 0..1 values that ramp from ~0 to ~endY with gentle randomness */
function generateSmoothCurve(endY: number, n: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Base: ease-in curve toward endY
    const base = endY * (t * t * 0.6 + t * 0.4);
    // Gentle wobble seeded by index (deterministic)
    const wobble = Math.sin(i * 2.3) * 0.06;
    pts.push(Math.max(0, Math.min(1, base + wobble)));
  }
  // Ensure last point is exact
  pts[pts.length - 1] = Math.max(0, Math.min(1, endY));
  return pts;
}

/** Convert points to a smooth cubic bezier SVG path */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { cn } from "@/lib/utils";
import { apiClientFetch } from "@/lib/api-client";

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "28", label: "Last 28 days", days: 28 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "365", label: "Last 365 days", days: 365 },
  { key: "custom", label: "Custom range", days: null },
] as const;

interface BillingSpendingChartProps {
  used: number;
  plan: string;
  /** When set, chart fetches real daily usage from API; otherwise uses mock distribution of `used`. */
  workspaceId?: string | null;
}

type DataPoint = { date: string; credits: number };

/** Smooth daily distribution: gentle variation, no sawtooth. Sum = totalUsed. */
function getMockDailyUsage(days: number, totalUsed: number): DataPoint[] {
  const now = new Date();
  const data: DataPoint[] = [];
  const base = totalUsed / Math.max(1, days);
  const raw: number[] = [];
  let sum = 0;
  for (let i = days - 1; i >= 0; i--) {
    const variation = 0.12 * Math.sin((i / Math.max(1, days)) * Math.PI * 3) + 0.98;
    const v = Math.round(base * variation);
    raw.push(v);
    sum += v;
  }
  const diff = totalUsed - sum;
  if (diff !== 0 && raw.length > 0) {
    const spread = Math.min(5, raw.length);
    const per = Math.round(diff / spread);
    for (let j = 0; j < spread; j++) {
      raw[raw.length - 1 - j] = Math.max(0, (raw[raw.length - 1 - j] ?? 0) + per);
    }
    raw[raw.length - 1] = Math.max(0, (raw[raw.length - 1] ?? 0) + (totalUsed - raw.reduce((a, b) => a + b, 0)));
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    data.push({ date: d.toISOString().slice(0, 10), credits: raw[days - 1 - i] ?? 0 });
  }
  return data;
}

function getMockDailyUsageForRange(startStr: string, endStr: string, totalUsed: number): DataPoint[] {
  const start = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const base = totalUsed / days;
  const raw: number[] = [];
  let sum = 0;
  for (let i = 0; i < days; i++) {
    const variation = 0.12 * Math.sin((i / Math.max(1, days)) * Math.PI * 3) + 0.98;
    raw.push(Math.round(base * variation));
    sum += raw[raw.length - 1]!;
  }
  const diff = totalUsed - sum;
  if (diff !== 0 && raw.length > 0) {
    const spread = Math.min(5, raw.length);
    const per = Math.round(diff / spread);
    for (let j = 0; j < spread; j++) {
      raw[raw.length - 1 - j] = Math.max(0, (raw[raw.length - 1 - j] ?? 0) + per);
    }
    raw[raw.length - 1] = Math.max(0, (raw[raw.length - 1] ?? 0) + (totalUsed - raw.reduce((a, b) => a + b, 0)));
  }
  const data: DataPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (d > end) break;
    data.push({ date: d.toISOString().slice(0, 10), credits: raw[i] ?? 0 });
  }
  return data;
}

function toYMD(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** X-axis tick: which data index and what label to show. */
function getXAxisTicks(
  data: DataPoint[],
  rangeKey: string,
  rangeDays: number
): { index: number; label: string }[] {
  if (data.length === 0) return [];
  const n = data.length - 1;
  if (n <= 0) return [{ index: 0, label: formatTickLabel(data[0]!.date, rangeKey, rangeDays) }];

  const ticks: { index: number; label: string }[] = [];

  if (rangeKey === "7" || rangeDays <= 7) {
    for (let i = 0; i < data.length; i++) {
      ticks.push({ index: i, label: formatTickLabel(data[i]!.date, "7", 7) });
    }
    return ticks;
  }

  if (rangeKey === "28" || (rangeDays > 7 && rangeDays <= 35)) {
    for (let i = 0; i < data.length; i += 7) {
      ticks.push({ index: i, label: formatTickLabel(data[i]!.date, "28", rangeDays) });
    }
    if (data.length > 1 && ticks[ticks.length - 1]!.index !== n) {
      ticks.push({ index: n, label: formatTickLabel(data[n]!.date, "28", rangeDays) });
    }
    return ticks;
  }

  /* 365d: months only (Jan, Feb, Mar, …) */
  if (rangeKey === "365" || rangeDays > 365) {
    let lastMonth = -1;
    for (let i = 0; i < data.length; i++) {
      const d = new Date(data[i]!.date + "T12:00:00");
      const month = d.getMonth();
      if (month !== lastMonth) {
        lastMonth = month;
        ticks.push({ index: i, label: formatTickLabel(data[i]!.date, "365", rangeDays) });
      }
    }
    if (data.length > 1 && ticks[ticks.length - 1]!.index !== n) {
      ticks.push({ index: n, label: formatTickLabel(data[n]!.date, "365", rangeDays) });
    }
    return ticks;
  }

  if (rangeKey === "90" || (rangeDays > 35 && rangeDays < 365)) {
    for (let i = 0; i < data.length; i += 7) {
      ticks.push({ index: i, label: formatTickLabel(data[i]!.date, "90", rangeDays) });
    }
    if (data.length > 1 && ticks[ticks.length - 1]!.index !== n) {
      ticks.push({ index: n, label: formatTickLabel(data[n]!.date, "90", rangeDays) });
    }
    return ticks;
  }

  if (rangeKey === "custom") {
    for (let i = 0; i < data.length; i += 7) {
      ticks.push({ index: i, label: formatTickLabel(data[i]!.date, "28", rangeDays) });
    }
    if (data.length > 1 && ticks[ticks.length - 1]!.index !== n) {
      ticks.push({ index: n, label: formatTickLabel(data[n]!.date, "28", rangeDays) });
    }
    return ticks;
  }

  return [
    { index: 0, label: formatTickLabel(data[0]!.date, rangeKey, rangeDays) },
    { index: n, label: formatTickLabel(data[n]!.date, rangeKey, rangeDays) },
  ];
}

function formatTickLabel(dateStr: string, rangeKey: string, rangeDays: number): string {
  const d = new Date(dateStr + "T12:00:00");
  if (rangeKey === "7" || rangeDays <= 7) {
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
  }
  if (rangeKey === "28" || rangeKey === "90" || rangeKey === "custom") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (rangeKey === "365" || rangeDays > 365) {
    return d.toLocaleDateString(undefined, { month: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ─── Custom date range picker ────────────────────────────────────────────── */
function CustomRangePicker({
  start,
  end,
  onSelect,
  onClose,
}: {
  start: string | null;
  end: string | null;
  onSelect: (start: string, end: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [leftMonth, setLeftMonth] = useState(() => {
    const d = start ? new Date(start + "T12:00:00") : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [draftStart, setDraftStart] = useState<string | null>(start);
  const [draftEnd, setDraftEnd] = useState<string | null>(end);
  const rightMonth = useMemo(() => {
    const n = new Date(leftMonth);
    n.setMonth(n.getMonth() + 1);
    return n;
  }, [leftMonth]);

  const apply = () => {
    const s = draftStart ?? toYMD(new Date());
    const e = draftEnd ?? s;
    const [a, b] = s <= e ? [s, e] : [e, s];
    if (a && b) {
      onSelect(a, b);
      onClose();
    }
  };

  const handleDateClick = (ymd: string) => {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(ymd);
      setDraftEnd(null);
    } else {
      if (ymd >= draftStart) {
        onSelect(draftStart, ymd);
        onClose();
      } else {
        onSelect(ymd, draftStart);
        onClose();
      }
    }
  };

  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  function monthGrid(monthStart: Date) {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const last = new Date(year, month + 1, 0);
    const daysInMonth = last.getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(toYMD(new Date(year, month, d)));
    }
    return cells;
  }

  return (
    <div className="absolute top-full right-0 mt-2 z-50 flex gap-6 p-5 rounded-2xl border border-border bg-card shadow-xl min-w-[320px]">
      <div className="flex gap-6">
        <div className="min-w-[140px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">
              {leftMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setLeftMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="size-8 flex items-center justify-center rounded-lg text-foreground hover:bg-secondary/60 transition-colors"
              aria-label="Previous month"
            >
              ←
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {weekdays.map((w, i) => (
              <span key={i} className="py-1">
                {w}
              </span>
            ))}
            {monthGrid(leftMonth).map((ymd, i) =>
              ymd ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDateClick(ymd)}
                  className={cn(
                    "size-8 rounded-lg text-sm font-medium transition-colors",
                    "text-foreground hover:bg-[#007aff]/15",
                    draftStart === ymd && "bg-[#007aff] text-white hover:bg-[#007aff]",
                    draftEnd === ymd && "bg-[#007aff] text-white hover:bg-[#007aff]",
                    draftStart && draftEnd && ymd >= draftStart && ymd <= draftEnd && "bg-[#007aff]/20",
                    draftStart && draftEnd && ymd > draftStart && ymd < draftEnd && "bg-[#007aff]/15"
                  )}
                >
                  {new Date(ymd + "T12:00:00").getDate()}
                </button>
              ) : (
                <span key={i} />
              )
            )}
          </div>
        </div>
        <div className="min-w-[140px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">
              {rightMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setLeftMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="size-8 flex items-center justify-center rounded-lg text-foreground hover:bg-secondary/60 transition-colors"
              aria-label="Next month"
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {weekdays.map((w, i) => (
              <span key={i} className="py-1">
                {w}
              </span>
            ))}
            {monthGrid(rightMonth).map((ymd, i) =>
              ymd ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDateClick(ymd)}
                  className={cn(
                    "size-8 rounded-lg text-sm font-medium transition-colors",
                    "text-foreground hover:bg-[#007aff]/15",
                    draftStart === ymd && "bg-[#007aff] text-white hover:bg-[#007aff]",
                    draftEnd === ymd && "bg-[#007aff] text-white hover:bg-[#007aff]",
                    draftStart && draftEnd && ymd >= draftStart && ymd <= draftEnd && "bg-[#007aff]/20",
                    draftStart && draftEnd && ymd > draftStart && ymd < draftEnd && "bg-[#007aff]/15"
                  )}
                >
                  {new Date(ymd + "T12:00:00").getDate()}
                </button>
              ) : (
                <span key={i} />
              )
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-end gap-2 border-l border-border pl-4">
        <button
          type="button"
          onClick={apply}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-[#007aff] text-white hover:opacity-90 transition-opacity"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function BillingSpendingChart({ used, plan, workspaceId }: BillingSpendingChartProps) {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("28");
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dailyFromApi, setDailyFromApi] = useState<DataPoint[] | null>(null);
  const customButtonRef = useRef<HTMLButtonElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const range = RANGES.find((r) => r.key === rangeKey);
  const days = range?.days ?? 28;

  const fetchUsage = useCallback(async () => {
    if (!workspaceId) return;
    try {
      if (rangeKey === "custom" && customStart && customEnd) {
        const { daily } = await apiClientFetch<{ daily: DataPoint[] }>(
          `/workspaces/${workspaceId}/usage?start=${encodeURIComponent(customStart)}&end=${encodeURIComponent(customEnd)}`
        );
        setDailyFromApi(daily ?? []);
      } else {
        const daysParam = rangeKey === "custom" ? 28 : (range?.days ?? 28);
        const { daily } = await apiClientFetch<{ daily: DataPoint[] }>(
          `/workspaces/${workspaceId}/usage?days=${daysParam}`
        );
        setDailyFromApi(daily ?? []);
      }
    } catch {
      setDailyFromApi(null);
    }
  }, [workspaceId, rangeKey, customStart, customEnd, range?.days]);

  useEffect(() => {
    if (workspaceId) {
      fetchUsage();
    } else {
      setDailyFromApi(null);
    }
  }, [workspaceId, fetchUsage]);

  const data = useMemo(() => {
    if (dailyFromApi && dailyFromApi.length > 0) return dailyFromApi;
    if (rangeKey === "custom" && customStart && customEnd) {
      return getMockDailyUsageForRange(customStart, customEnd, used);
    }
    return getMockDailyUsage(days, used);
  }, [dailyFromApi, rangeKey, customStart, customEnd, days, used]);

  const rangeDays =
    rangeKey === "custom" && customStart && customEnd
      ? Math.ceil(
          (new Date(customEnd + "T12:00:00").getTime() - new Date(customStart + "T12:00:00").getTime()) /
            (24 * 60 * 60 * 1000)
        ) + 1
      : days;

  const xTicks = useMemo(
    () => getXAxisTicks(data, rangeKey, rangeDays),
    [data, rangeKey, rangeDays]
  );

  const chartHeight = 320;
  const padX = 24;
  const padY = 24;
  const width = 560;
  const height = chartHeight - padY * 2;
  const maxDaily = Math.max(1, ...data.map((d) => d.credits));
  const n = data.length - 1;

  const points = data.map((d, i) => ({
    x: padX + (n > 0 ? (i / n) * (width - padX * 2) : 0),
    y: padY + height - (d.credits / maxDaily) * height,
    value: d.credits,
  }));

  const lineD =
    points.length > 0
      ? points.reduce((acc, p, i) => (i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`), "")
      : "";

  const areaD =
    points.length > 0
      ? `${lineD} L ${points[points.length - 1]!.x},${padY + height} L ${points[0]!.x},${padY + height} Z`
      : "";

  const handleRangeClick = (key: (typeof RANGES)[number]["key"]) => {
    if (key === "custom") {
      setCustomPickerOpen((v) => !v);
      return;
    }
    setCustomPickerOpen(false);
    setRangeKey(key);
  };

  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = chartRef.current;
    if (!el || points.length === 0) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const closest = Math.round(((x - padX) / (width - padX * 2)) * n);
    const idx = Math.max(0, Math.min(n, closest));
    setHoveredIndex(idx);
  };

  const handleChartMouseLeave = () => setHoveredIndex(null);

  useEffect(() => {
    if (!customPickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (customButtonRef.current && !customButtonRef.current.contains(e.target as Node)) {
        const popover = document.querySelector("[data-billing-custom-picker]");
        if (popover && !popover.contains(e.target as Node)) setCustomPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [customPickerOpen]);

  return (
    <DashboardCard className="overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-lg font-semibold text-foreground">Credits used over time</p>
        <div className="flex flex-wrap gap-1.5 relative">
          {RANGES.map((r) => (
            <button
              key={r.key}
              ref={r.key === "custom" ? customButtonRef : undefined}
              type="button"
              onClick={() => (r.key === "custom" ? handleRangeClick(r.key) : setRangeKey(r.key))}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                rangeKey === r.key
                  ? "bg-[#007aff] text-white"
                  : "bg-secondary/60 text-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {r.key === "custom" ? "Custom" : r.label.replace("Last ", "").replace(" days", "d")}
            </button>
          ))}
          {customPickerOpen && (
            <div data-billing-custom-picker className="absolute top-full right-0 z-50">
              <CustomRangePicker
                start={customStart}
                end={customEnd}
                onSelect={(s, e) => {
                  setCustomStart(s);
                  setCustomEnd(e);
                  setRangeKey("custom");
                  setCustomPickerOpen(false);
                }}
                onClose={() => setCustomPickerOpen(false)}
                anchorRef={customButtonRef}
              />
            </div>
          )}
        </div>
      </div>

      <div
        ref={chartRef}
        className="relative cursor-crosshair"
        style={{ height: chartHeight }}
        onMouseMove={handleChartMouseMove}
        onMouseLeave={handleChartMouseLeave}
      >
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          className="w-full h-full min-h-[280px] pointer-events-none block"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="billingChartGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#007aff" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#007aff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#billingChartGrad)" />
          <path
            d={lineD}
            fill="none"
            stroke="#007aff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.length > 0 && (
            <circle
              cx={points[points.length - 1]!.x}
              cy={points[points.length - 1]!.y}
              r={4}
              fill="#007aff"
            />
          )}
        </svg>
        {hoveredIndex !== null && points[hoveredIndex] !== undefined && (
          <>
            <div
              className="absolute pointer-events-none z-10 size-3 rounded-full bg-gradient-brand ring-2 ring-white"
              style={{
                left: `${(points[hoveredIndex]!.x / width) * 100}%`,
                top: `${(points[hoveredIndex]!.y / chartHeight) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
            <div
              className="absolute pointer-events-none z-10 whitespace-nowrap rounded-lg bg-card px-3 py-2 text-sm font-medium text-foreground shadow-md border border-border/50"
              style={{
                left: `${(points[hoveredIndex]!.x / width) * 100}%`,
                top: `${(points[hoveredIndex]!.y / chartHeight) * 100}%`,
                transform: "translate(-50%, -100%)",
                marginTop: "-8px",
              }}
            >
              Credits used: {data[hoveredIndex]!.credits}
            </div>
          </>
        )}
      </div>

      {/* X-axis: ticks aligned with chart content area (padX to width-padX) */}
      <div className="relative mt-2 h-6 w-full">
        {xTicks.map((tick, i) => (
          <span
            key={i}
            className="absolute text-xs text-foreground whitespace-nowrap -translate-x-1/2"
            style={{
              left: n > 0
                ? `calc(${(padX / width) * 100}% + ${(tick.index / n) * ((width - padX * 2) / width) * 100}%)`
                : `${(padX / width) * 100}%`,
              top: 0,
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </DashboardCard>
  );
}

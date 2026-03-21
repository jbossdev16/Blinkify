"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiClientFetch } from "@/lib/api-client";
import {
  Bookmark,
  Download,
  Trash2,
  Image as ImageIcon,
  Video,
  RotateCw,
  X,
  Play,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Filter options (match image/video generation tabs) ──────────────────── */

/* Match creative studio labels */
/** Feed 4:5, story 9:16, landscape 16:9 (no separate 1:1 filter — use "Any"). */
const IMAGE_ASPECT_RATIOS = [
  { value: "4:5", label: "Instagram Feed (4:5)" },
  { value: "9:16", label: "Story" },
  { value: "16:9", label: "Landscape Ad (16:9)" },
];

const VIDEO_ASPECT_RATIOS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

const VIDEO_RESOLUTIONS = [
  { value: "1080p", label: "Standard" },
  { value: "4k", label: "4K" },
];

const VIDEO_MODEL_LABELS: Record<string, string> = {
  "veo-3.1-generate-preview": "Blinkify Standard",
  "veo-3.1-fast-generate-preview": "Blinkify Fast",
};

const VIDEO_MODEL_FILTER_VALUES = [
  { value: "veo-3.1-generate-preview", label: "Blinkify Standard" },
  { value: "veo-3.1-fast-generate-preview", label: "Blinkify Fast" },
] as const;

function videoModelLabel(raw: string | undefined): string | null {
  if (!raw) return null;
  return VIDEO_MODEL_LABELS[raw] ?? raw;
}

/** Spans for a 3-col bento (same ratios as old 6-col: wide = half row, tall = 1×2). */
function getBentoSpans(item: AssetItem): { colSpan: number; rowSpan: number } {
  const ar = (item.metadata?.aspectRatio ?? "").trim() || "1:1";
  if (
    ["16:9", "21:9", "5:4", "4:3", "3:2"].includes(ar)
  ) {
    return { colSpan: 2, rowSpan: 1 };
  }
  if (["9:16", "2:3", "3:4"].includes(ar) || ar === "4:5") {
    return { colSpan: 1, rowSpan: 2 };
  }
  return { colSpan: 1, rowSpan: 1 };
}

function getBentoLayout(item: AssetItem): {
  gridClass: string;
  aspectClass: string;
} {
  const ar = (item.metadata?.aspectRatio ?? "").trim() || "1:1";
  const wide =
    "col-span-2 row-span-1";
  switch (ar) {
    case "16:9":
    case "21:9":
    case "5:4":
    case "4:3":
    case "3:2":
      return {
        gridClass: wide,
        aspectClass: ar === "21:9" ? "aspect-[21/9]" : ar === "5:4" ? "aspect-[5/4]" : ar === "4:3" ? "aspect-[4/3]" : ar === "3:2" ? "aspect-[3/2]" : "aspect-video",
      };
    case "9:16":
    case "2:3":
    case "3:4":
      return {
        gridClass: "col-span-1 row-span-2",
        aspectClass: ar === "2:3" ? "aspect-[2/3]" : ar === "3:4" ? "aspect-[3/4]" : "aspect-[9/16]",
      };
    case "4:5":
      return {
        gridClass: "col-span-1 row-span-2",
        aspectClass: "aspect-[4/5]",
      };
    case "1:1":
    default:
      return {
        gridClass: "col-span-1 row-span-1",
        aspectClass: "aspect-square",
      };
  }
}

const BENTO_COLS = 3;

/** Pack items left-to-right in a 3-col bento until row budget; approximates CSS dense grid. */
function sliceItemsWithinRowBudget(items: AssetItem[], maxRows: number): AssetItem[] {
  if (maxRows <= 0) return [];
  const colEnd = new Array(BENTO_COLS).fill(0);
  const out: AssetItem[] = [];
  for (const item of items) {
    const { colSpan: cs, rowSpan: rs } = getBentoSpans(item);
    let placed = false;
    for (let c = 0; c <= BENTO_COLS - cs && !placed; c++) {
      const startRow = Math.max(...colEnd.slice(c, c + cs));
      if (startRow + rs <= maxRows) {
        for (let k = 0; k < cs; k++) colEnd[c + k] = startRow + rs;
        out.push(item);
        placed = true;
      }
    }
    if (!placed) break;
  }
  return out;
}

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface AssetItem {
  id: string;
  generationId?: string;
  videoGenerationId?: string;
  type: "image" | "video";
  url: string | null;
  /** Present when API returns it; used for brand-scoped filtering. */
  projectId?: string;
  projectName: string;
  prompt: string | null;
  createdAt: string;
  metadata?: {
    aspectRatio?: string;
    resolution?: string;
    durationSeconds?: number;
    model?: string;
  };
}

interface AssetCollectionViewProps {
  workspaceId: string;
  /** When true, omit outer padding and page title (e.g. when embedded on dashboard). */
  embedded?: boolean;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function AssetCollectionView({ workspaceId, embedded }: AssetCollectionViewProps) {
  const [items, setItems] = useState<AssetItem[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<AssetItem | null>(null);
  const [brandProjectId, setBrandProjectId] = useState<string | null>(null);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [imageAspectFilter, setImageAspectFilter] = useState<string>("");
  const [videoAspectFilter, setVideoAspectFilter] = useState<string>("");
  const [videoResolutionFilter, setVideoResolutionFilter] = useState<string>("");
  const [videoModelFilter, setVideoModelFilter] = useState<string>("");
  /** Grid row tracks to show (3-col bento); +6 per "View More". Resets on refresh / filter change / remount. */
  const [visibleRowBudget, setVisibleRowBudget] = useState(6);
  /** More pages available from API (paginated to limit disk I/O per request). */
  const [hasMoreServer, setHasMoreServer] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchAbortedRef = useRef(false);
  const brandMenuRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async (silent = false) => {
    if (!workspaceId) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    fetchAbortedRef.current = false;
    try {
      const res = await apiClientFetch<{ items?: AssetItem[]; hasMore?: boolean }>(
        `/workspaces/${workspaceId}/asset-collection?limit=100&offset=0`
      );
      if (!fetchAbortedRef.current) {
        setItems(Array.isArray(res.items) ? res.items : []);
        setHasMoreServer(res.hasMore === true);
      }
    } catch (err) {
      if (!fetchAbortedRef.current && !silent) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      if (!fetchAbortedRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [workspaceId]);

  const loadMoreFromServer = useCallback(async () => {
    if (!workspaceId || loadingMore || !hasMoreServer) return;
    setLoadingMore(true);
    try {
      const offset = items.length;
      const res = await apiClientFetch<{ items?: AssetItem[]; hasMore?: boolean }>(
        `/workspaces/${workspaceId}/asset-collection?limit=100&offset=${offset}`
      );
      const batch = Array.isArray(res.items) ? res.items : [];
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const merged = [...prev];
        for (const it of batch) {
          if (!seen.has(it.id)) {
            merged.push(it);
            seen.add(it.id);
          }
        }
        return merged;
      });
      setHasMoreServer(res.hasMore === true);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [workspaceId, loadingMore, hasMoreServer, items.length]);

  useEffect(() => {
    fetchItems();
    return () => {
      fetchAbortedRef.current = true;
    };
  }, [fetchItems]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    apiClientFetch<{ projects?: { id: string; name: string }[] }>(`/workspaces/${workspaceId}/projects`)
      .then((res) => {
        if (cancelled || !Array.isArray(res.projects)) return;
        setProjects(res.projects.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") fetchItems(true);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchItems]);

  useEffect(() => {
    if (!brandMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (brandMenuRef.current && !brandMenuRef.current.contains(e.target as Node)) {
        setBrandMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [brandMenuOpen]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (brandProjectId) {
        if (item.projectId) {
          if (item.projectId !== brandProjectId) return false;
        } else {
          const brandName = projects.find((p) => p.id === brandProjectId)?.name;
          if (!brandName || item.projectName !== brandName) return false;
        }
      }
      if (typeFilter === "image" && item.type !== "image") return false;
      if (typeFilter === "video" && item.type !== "video") return false;
      if (item.type === "image" && imageAspectFilter) {
        const ar = (item.metadata?.aspectRatio ?? "").trim();
        if (!ar || ar !== imageAspectFilter) return false;
      }
      if (item.type === "video") {
        if (videoAspectFilter) {
          const ar = (item.metadata?.aspectRatio ?? "").trim();
          if (!ar || ar !== videoAspectFilter) return false;
        }
        if (videoResolutionFilter) {
          const res = (item.metadata?.resolution ?? "").trim().toLowerCase();
          const filterRes = videoResolutionFilter.toLowerCase();
          if (!res || res !== filterRes) return false;
        }
        if (videoModelFilter) {
          const m = (item.metadata?.model ?? "").trim();
          if (!m || m !== videoModelFilter) return false;
        }
      }
      return true;
    });
  }, [
    items,
    brandProjectId,
    projects,
    typeFilter,
    imageAspectFilter,
    videoAspectFilter,
    videoResolutionFilter,
    videoModelFilter,
  ]);

  useEffect(() => {
    setVisibleRowBudget(6);
  }, [
    brandProjectId,
    typeFilter,
    imageAspectFilter,
    videoAspectFilter,
    videoResolutionFilter,
    videoModelFilter,
  ]);

  const displayedItems = useMemo(
    () => sliceItemsWithinRowBudget(filteredItems, visibleRowBudget),
    [filteredItems, visibleRowBudget]
  );
  const hasMoreGrid = displayedItems.length < filteredItems.length;

  async function handleRemove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await apiClientFetch(`/workspaces/${workspaceId}/asset-collection/${id}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (expandedItem?.id === id) setExpandedItem(null);
    } catch {
      // ignore
    }
  }

  async function downloadAsset(url: string, filename: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpandedItem(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const containerClass = embedded ? "" : "p-6 lg:p-10";
  const minHeightClass = embedded ? "min-h-[200px]" : "min-h-[50vh]";

  if (loading) {
    return (
      <div className={cn(containerClass, "flex items-center justify-center", minHeightClass)}>
        <p className="text-[#000000] dark:text-white">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClass}>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchItems()}
            className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
          >
            <RotateCw className="size-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  function handleRefresh() {
    setBrandProjectId(null);
    setTypeFilter("all");
    setImageAspectFilter("");
    setVideoAspectFilter("");
    setVideoResolutionFilter("");
    setVideoModelFilter("");
    setVisibleRowBudget(6);
    fetchItems();
  }

  const brandButtonLabel =
    brandProjectId != null
      ? (projects.find((p) => p.id === brandProjectId)?.name ?? "Brand")
      : "All brands";

  return (
    <div className={containerClass}>
      {/* Grid + filters */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Main content: grid */}
        <div className="flex-1 min-w-0">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-12 text-center">
            <Bookmark className="size-12 mx-auto text-[#000000]/50 dark:text-white/50 mb-4" />
            <p className="text-[#000000] dark:text-white">No bookmarked assets yet</p>
            <p className="text-sm text-[#000000] dark:text-white/80 mt-1">
              Click the bookmark icon on any generated image or video to save it here.
            </p>
          </div>
        ) : (
          <>
            {displayedItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center">
                <p className="text-[#000000] dark:text-white">No assets match the current filters</p>
              </div>
            ) : (
              <>
              <div
                className={cn(
                  "grid gap-3 sm:gap-4 grid-flow-dense",
                  "grid-cols-2 sm:grid-cols-3",
                  "grid-auto-rows-[minmax(150px,1fr)] sm:grid-auto-rows-[minmax(180px,1fr)]"
                )}
              >
                {displayedItems.map((item) => {
                  const { gridClass, aspectClass } = getBentoLayout(item);
                  return (
                  <div
                    key={item.id}
                    className={cn(
                      "group relative rounded-xl border border-border bg-card shadow-sm overflow-hidden cursor-pointer min-h-0 flex flex-col",
                      gridClass
                    )}
                    onClick={() => item.url && setExpandedItem(item)}
                  >
                    <div className={cn("w-full flex-1 min-h-0 flex items-center justify-center relative bg-secondary/20", aspectClass)}>
                      {item.type === "image" ? (
                        item.url ? (
                          <img
                            src={item.url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="size-12 text-muted-foreground/50" />
                        )
                      ) : item.url ? (
                        <>
                          <video
                            src={item.url}
                            className="absolute inset-0 w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <Play className="size-12 text-white drop-shadow-lg fill-white" />
                          </div>
                        </>
                      ) : (
                        <Video className="size-12 text-muted-foreground/50" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                        "bg-black/60 rounded-lg p-1"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.url && (
                        <button
                          type="button"
                          onClick={(e) =>
                            downloadAsset(
                              item.url!,
                              `blinkify-${item.type}-${item.id.slice(0, 8)}.${item.type === "video" ? "mp4" : "png"}`,
                              e
                            )
                          }
                          className="size-8 flex items-center justify-center rounded text-white hover:bg-white/20 transition-colors"
                          title="Download"
                        >
                          <Download className="size-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleRemove(item.id, e)}
                        className="size-8 flex items-center justify-center rounded text-white hover:bg-destructive/80 transition-colors"
                        title="Remove from collection"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
              {hasMoreGrid && (
                <div className="mt-6 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleRowBudget((r) => r + 6)}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    View More
                  </button>
                </div>
              )}
              {hasMoreServer && (
                <div className="mt-6 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => void loadMoreFromServer()}
                    disabled={loadingMore}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border bg-background text-[#000000] dark:text-white hover:bg-secondary/60 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : "Load older bookmarks"}
                  </button>
                </div>
              )}
            </>
          )}
          </>
        )}
        </div>

      {/* Right sidebar: filter panel (sticky like main sidebar on lg) */}
      <aside className="w-full lg:w-64 shrink-0 order-first lg:order-none lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-black/5 dark:border-border bg-white dark:bg-card shadow-sm overflow-hidden p-5 lg:p-6 space-y-4 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          <div className="relative w-full" ref={brandMenuRef}>
            <button
              type="button"
              onClick={() => setBrandMenuOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-medium text-[#000000] dark:text-white hover:bg-secondary/40 transition-colors"
            >
              <span className="truncate min-w-0">{brandButtonLabel}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground", brandMenuOpen && "rotate-180")} />
            </button>
            {brandMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setBrandProjectId(null);
                    setBrandMenuOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-xs font-medium hover:bg-secondary/60",
                    brandProjectId == null && "bg-secondary/40"
                  )}
                >
                  All brands
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setBrandProjectId(p.id);
                      setBrandMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs font-medium hover:bg-secondary/60 truncate",
                      brandProjectId === p.id && "bg-secondary/40"
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <LayoutGrid className="size-3.5 shrink-0 text-[#000000] dark:text-white" />
              <span className="text-xs font-normal text-[#000000] dark:text-white truncate">Filters</span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="size-8 shrink-0 flex items-center justify-center rounded-lg text-[#000000] hover:bg-secondary/60 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-default"
              title="Refresh & reset filters"
            >
              <RotateCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-normal text-[#000000] dark:text-white/70 mb-1.5">Type</p>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "image", "video"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                      typeFilter === t
                        ? "bg-primary text-white"
                        : "bg-secondary/60 text-[#000000] dark:text-white/80 hover:text-foreground"
                    )}
                  >
                    {t === "all" ? "All" : t === "image" ? "Images" : "Videos"}
                  </button>
                ))}
              </div>
            </div>
            {typeFilter !== "video" && (
              <div>
                <p className="text-xs font-normal text-[#000000] dark:text-white/70 mb-1.5">Image aspect ratio</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setImageAspectFilter("")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                      !imageAspectFilter ? "bg-primary text-white" : "bg-secondary/60 text-[#000000] dark:text-white/80 hover:text-foreground"
                    )}
                  >
                    Any
                  </button>
                  {IMAGE_ASPECT_RATIOS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setImageAspectFilter(r.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        imageAspectFilter === r.value
                          ? "bg-primary text-white"
                          : "bg-secondary/60 text-[#000000] dark:text-white/80 hover:text-foreground"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {typeFilter !== "image" && (
              <>
                <div>
                  <p className="text-xs font-normal text-[#000000] dark:text-white/70 mb-1.5">Video aspect ratio</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setVideoAspectFilter("")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        !videoAspectFilter ? "bg-primary text-white" : "bg-secondary/60 text-[#000000] dark:text-white/80 hover:text-foreground"
                      )}
                    >
                      Any
                    </button>
                    {VIDEO_ASPECT_RATIOS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setVideoAspectFilter(r.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                          videoAspectFilter === r.value
                            ? "bg-primary text-white"
                            : "bg-secondary/60 text-[#000000] dark:text-white/80 hover:text-foreground"
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-normal text-[#000000] dark:text-white/70 mb-1.5">Video resolution</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setVideoResolutionFilter("")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        !videoResolutionFilter ? "bg-primary text-white" : "bg-secondary/60 text-[#000000] dark:text-white/80 hover:text-foreground"
                      )}
                    >
                      Any
                    </button>
                    {VIDEO_RESOLUTIONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setVideoResolutionFilter(r.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                          videoResolutionFilter === r.value
                            ? "bg-primary text-white"
                            : "bg-secondary/60 text-[#000000] dark:text-white/80 hover:text-foreground"
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-normal text-[#000000] dark:text-white/70 mb-1.5">Video model</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setVideoModelFilter("")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        !videoModelFilter ? "bg-primary text-white" : "bg-secondary/60 text-[#000000] dark:text-white/80 hover:text-foreground"
                      )}
                    >
                      Any
                    </button>
                    {VIDEO_MODEL_FILTER_VALUES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setVideoModelFilter(r.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                          videoModelFilter === r.value
                            ? "bg-primary text-white"
                            : "bg-secondary/60 text-[#000000] dark:text-white/80 hover:text-foreground"
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
      </div>

      {/* Expanded modal: media + metadata panel */}
      {expandedItem && expandedItem.url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={() => setExpandedItem(null)}
        >
          <div
            className="relative flex flex-col lg:flex-row gap-4 lg:gap-6 max-w-6xl w-full max-h-[90vh] bg-background rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedItem(null)}
              className="absolute top-4 right-4 size-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white cursor-pointer z-10"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>

            <div className="flex-1 min-w-0 flex items-center justify-center p-6 pt-14 lg:pt-6">
              {expandedItem.type === "image" ? (
                <img
                  src={expandedItem.url}
                  alt=""
                  className="max-w-full max-h-[70vh] lg:max-h-[85vh] w-auto h-auto object-contain rounded-lg"
                />
              ) : (
                <video
                  src={expandedItem.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-[70vh] lg:max-h-[85vh] w-auto rounded-lg"
                />
              )}
            </div>

            <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-border p-4 overflow-y-auto">
              <p className="text-xs font-semibold text-[#000000] dark:text-white/80 uppercase tracking-wide mb-3">
                Metadata
              </p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-[#000000] dark:text-white/80 mb-0.5">Brand</p>
                  <p className="font-medium">{expandedItem.projectName}</p>
                </div>
                {expandedItem.prompt && (
                  <div>
                    <p className="text-xs text-[#000000] dark:text-white/80 mb-0.5">Prompt</p>
                    <p className="text-[#000000] dark:text-white/80 whitespace-pre-wrap break-words">
                      {expandedItem.prompt}
                    </p>
                  </div>
                )}
                {(expandedItem.metadata?.aspectRatio) && (
                  <div>
                    <p className="text-xs text-[#000000] dark:text-white/80 mb-0.5">Aspect ratio</p>
                    <p>{expandedItem.metadata.aspectRatio}</p>
                  </div>
                )}
                {expandedItem.type === "video" && videoModelLabel(expandedItem.metadata?.model) && (
                  <div>
                    <p className="text-xs text-[#000000] dark:text-white/80 mb-0.5">Model</p>
                    <p>{videoModelLabel(expandedItem.metadata?.model)}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={(e) =>
                    downloadAsset(
                      expandedItem!.url!,
                      `blinkify-${expandedItem!.type}-${expandedItem!.id.slice(0, 8)}.${expandedItem!.type === "video" ? "mp4" : "png"}`,
                      e
                    )
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Download className="size-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRemove(expandedItem!.id, e)}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

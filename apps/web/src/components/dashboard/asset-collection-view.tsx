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
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Filter options (match image/video generation tabs) ──────────────────── */

/* Match creative studio labels */
const IMAGE_ASPECT_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "4:5", label: "Instagram Feed (4:5)" },
  { value: "5:4", label: "Landscape Photo (5:4)" },
  { value: "3:4", label: "Portrait (3:4)" },
  { value: "4:3", label: "Presentation (4:3)" },
  { value: "2:3", label: "Tall Portrait (2:3)" },
  { value: "3:2", label: "Photo Print (3:2)" },
  { value: "9:16", label: "Story / Reel (9:16)" },
  { value: "16:9", label: "Landscape Ad (16:9)" },
  { value: "21:9", label: "Banner (21:9)" },
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

function videoModelLabel(raw: string | undefined): string | null {
  if (!raw) return null;
  return VIDEO_MODEL_LABELS[raw] ?? raw;
}

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface AssetItem {
  id: string;
  generationId?: string;
  videoGenerationId?: string;
  type: "image" | "video";
  url: string | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<AssetItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [imageAspectFilter, setImageAspectFilter] = useState<string>("");
  const [videoAspectFilter, setVideoAspectFilter] = useState<string>("");
  const [videoResolutionFilter, setVideoResolutionFilter] = useState<string>("");
  const [visibleRows, setVisibleRows] = useState(2);
  const fetchAbortedRef = useRef(false);

  const fetchItems = useCallback(async (silent = false) => {
    if (!workspaceId) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    fetchAbortedRef.current = false;
    try {
      const res = await apiClientFetch<{ items?: AssetItem[] }>(
        `/workspaces/${workspaceId}/asset-collection`
      );
      if (!fetchAbortedRef.current) {
        setItems(Array.isArray(res.items) ? res.items : []);
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

  useEffect(() => {
    fetchItems();
    return () => {
      fetchAbortedRef.current = true;
    };
  }, [fetchItems]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") fetchItems(true);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
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
      }
      return true;
    });
  }, [items, typeFilter, imageAspectFilter, videoAspectFilter, videoResolutionFilter]);

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
    setTypeFilter("all");
    setImageAspectFilter("");
    setVideoAspectFilter("");
    setVideoResolutionFilter("");
    setVisibleRows(2);
    fetchItems();
  }

  const cols = 3;
  const limit = embedded ? visibleRows * cols : undefined;
  const displayedItems = limit !== undefined ? filteredItems.slice(0, limit) : filteredItems;
  const hasMore = embedded && limit !== undefined && filteredItems.length > limit;

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
                  "grid gap-4",
                  "grid-cols-2 sm:grid-cols-3"
                )}
              >
                {displayedItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-xl border border-border bg-card shadow-sm overflow-hidden cursor-pointer"
                    onClick={() => item.url && setExpandedItem(item)}
                  >
                    <div className="aspect-square bg-secondary/30 flex items-center justify-center relative">
                      {item.type === "image" ? (
                        item.url ? (
                          <img
                            src={item.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="size-12 text-muted-foreground/50" />
                        )
                      ) : item.url ? (
                        <>
                          <video
                            src={item.url}
                            className="w-full h-full object-cover"
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
                ))}
              </div>
              {hasMore && (
                <div className="mt-4 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleRows((r) => r + 3)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    View More
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
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="size-3.5 text-[#000000] dark:text-white" />
              <span className="text-xs font-normal text-[#000000] dark:text-white">Filters</span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="size-8 flex items-center justify-center rounded-lg text-[#000000] hover:bg-secondary/60 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-default"
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

"use client";

import Link from "next/link";
import { ChevronDown, RotateCw, Settings } from "lucide-react";
import type { Project } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ProjectSwitcherBarProps {
  projects: Project[];
  selectedProject: Project;
  onSelectProject: (projectId: string) => void;
  label?: string;
  /** When provided, shows a refresh button (clears chat, keeps bookmarked assets). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Hide refresh when no messages (nothing to clear). */
  hasMessages?: boolean;
}

export function ProjectSwitcherBar({
  projects,
  selectedProject,
  onSelectProject,
  label = "Brand",
  onRefresh,
  refreshing = false,
  hasMessages = true,
}: ProjectSwitcherBarProps) {
  return (
    <div className="shrink-0 border-b border-border pl-4 pr-4 lg:pr-6 py-3 flex items-center gap-3">
      <div className="relative w-64 shrink-0">
        <span
          className="pointer-events-none absolute inset-y-0 left-3 right-9 flex items-center"
          aria-hidden
        >
          <span className="text-gradient-brand text-sm font-medium truncate block">
            {selectedProject.name}
          </span>
        </span>
        <select
          aria-label={`${label} selection`}
          value={selectedProject.id}
          onChange={(e) => onSelectProject(e.target.value)}
          className={cn(
            "w-full h-9 pr-9 pl-3 py-2 bg-transparent border border-border rounded-lg appearance-none",
            "cursor-pointer hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
            "text-transparent [color:transparent] [caret-color:transparent]"
          )}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground shrink-0"
          aria-hidden
        />
      </div>
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
        {selectedProject.description || "No description"}
      </span>
      {onRefresh && hasMessages && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors shrink-0 disabled:opacity-40 disabled:cursor-default"
          title="Clear chat (keeps bookmarked assets)"
        >
          <RotateCw className={cn("size-4", refreshing && "animate-spin")} />
        </button>
      )}
      <Link
        href="/brand"
        className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors shrink-0"
        title="Brand"
      >
        <Settings className="size-4" />
      </Link>
    </div>
  );
}

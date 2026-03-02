"use client";

import {
  Search,
  Undo2,
  Redo2,
  Layers,
  Lock,
  Copy,
  Trash2,
  HelpCircle,
  Download,
} from "lucide-react";
import { useStudio } from "./studio-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function StudioToolbar() {
  const {
    exportCanvas,
    contentPanelSearch,
    setContentPanelSearch,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedIds,
    selectedNode,
    removeSelected,
    duplicateSelected,
    toggleLockSelected,
  } = useStudio();

  const hasSelection = selectedIds.length > 0;
  const fillColor = selectedNode && "fill" in selectedNode ? selectedNode.fill : "#000000";

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 bg-white border-b border-border">
      <div className="flex items-center gap-2 min-w-[200px]">
        <Search className="size-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search..."
          value={contentPanelSearch}
          onChange={(e) => setContentPanelSearch(e.target.value)}
          className="h-9 bg-muted/50 border-0 focus-visible:ring-1"
        />
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"
          title="Undo"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"
          title="Redo"
        >
          <Redo2 className="size-4" />
        </button>
      </div>
      <div
        className={cn(
          "w-8 h-8 rounded border border-border shrink-0",
          !hasSelection && "opacity-50"
        )}
        style={{ backgroundColor: hasSelection ? fillColor : "transparent" }}
        title="Fill color"
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-muted text-sm"
          title="Position"
        >
          <Layers className="size-4" />
          <span>Position</span>
        </button>
        <button
          type="button"
          onClick={toggleLockSelected}
          disabled={!hasSelection}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"
          title="Lock"
        >
          <Lock className="size-4" />
        </button>
        <button
          type="button"
          onClick={duplicateSelected}
          disabled={!hasSelection}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"
          title="Duplicate"
        >
          <Copy className="size-4" />
        </button>
        <button
          type="button"
          onClick={removeSelected}
          disabled={!hasSelection}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 text-destructive hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
          title="Help"
        >
          <HelpCircle className="size-4" />
        </button>
      </div>
      <div className="ml-auto">
        <Button size="sm" className="gap-2" onClick={exportCanvas} title="Download">
          <Download className="size-4" />
          Download
        </Button>
      </div>
    </header>
  );
}

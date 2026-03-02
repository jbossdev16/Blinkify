"use client";

import { Minus, Plus } from "lucide-react";
import { useStudio } from "./studio-context";
import { Button } from "@/components/ui/button";

export function StudioBottomBar() {
  const { zoom, setZoom } = useStudio();
  const pct = Math.round(zoom * 100);

  return (
    <footer className="h-12 shrink-0 flex items-center justify-between px-4 bg-white border-t border-border">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          Pages
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
          title="Zoom out"
        >
          <Minus className="size-4" />
        </button>
        <span className="min-w-[3rem] text-center text-sm text-muted-foreground">{pct}%</span>
        <button
          type="button"
          onClick={() => setZoom(Math.min(2, zoom + 0.1))}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
          title="Zoom in"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div>
        <Button variant="default" size="sm">
          Open Sandbox
        </Button>
      </div>
    </footer>
  );
}

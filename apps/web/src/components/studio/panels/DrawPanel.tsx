"use client";

import { useStudio } from "../studio-context";
import { DRAW_PRESETS } from "./draw-data";

export function DrawPanel() {
  const { addNode } = useStudio();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <p className="text-sm text-muted-foreground p-4 pb-2 shrink-0">
        Draw tools (freehand coming soon). Add lines and arrows.
      </p>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {DRAW_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => addNode(preset.add())}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:border-blue-400 hover:bg-blue-50/50 text-sm"
            >
              <span className="text-base">{preset.icon}</span>
              <span className="truncate">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

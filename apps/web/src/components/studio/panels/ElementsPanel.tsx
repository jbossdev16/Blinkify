"use client";

import { useStudio } from "../studio-context";
import { ELEMENT_PRESETS } from "./elements-data";

export function ElementsPanel() {
  const { addNode } = useStudio();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <p className="text-sm text-muted-foreground p-4 pb-2 shrink-0">Shapes and elements.</p>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {ELEMENT_PRESETS.map(({ category, presets }) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {category}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => addNode(preset.add())}
                  className="flex flex-col items-center justify-center min-h-[56px] rounded-lg border border-border hover:border-blue-400 hover:bg-blue-50/50 transition-colors py-2"
                  title={preset.label}
                >
                  <span className="text-lg leading-none mb-0.5">{preset.icon}</span>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center px-0.5">
                    {preset.label.replace(/^(\w+)\s.*/, "$1")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

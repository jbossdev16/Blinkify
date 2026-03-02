"use client";

import type { TextNode } from "../types";
import { useStudio } from "../studio-context";
import { FONT_FAMILIES, TEXT_PRESETS } from "./text-data";

const cx = 540;
const cy = 540;

function makeText(
  content: string,
  fontSize: number,
  fontFamily: string,
  width: number,
  height: number,
  fill: string = "#000000"
): Omit<TextNode, "id"> {
  return {
    type: "text",
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    text: content,
    fontSize,
    fontFamily,
    fill,
  };
}

export function TextPanel() {
  const { addNode } = useStudio();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <p className="text-sm text-muted-foreground p-4 pb-2 shrink-0">Add text to your design.</p>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Presets
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {TEXT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addNode(preset.add())}
                className="text-left px-3 py-2 rounded-lg border border-border hover:border-blue-400 hover:bg-blue-50/50 text-sm truncate"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Quick add by font
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {FONT_FAMILIES.slice(0, 12).map((font) => (
              <button
                key={font}
                type="button"
                onClick={() =>
                  addNode(
                    makeText("Text", 24, font, 300, 40)
                  )
                }
                className="px-2 py-1.5 rounded border border-border hover:border-blue-400 hover:bg-blue-50/50 text-xs truncate max-w-[140px]"
                style={{ fontFamily: font }}
              >
                {font}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

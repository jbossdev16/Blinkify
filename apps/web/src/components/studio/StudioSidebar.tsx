"use client";

import {
  LayoutGrid,
  Type,
  Image as ImageIcon,
  Shapes,
  Pencil,
  CloudUpload,
  Undo2,
  Redo2,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudio } from "./studio-context";
import type { LeftPanelTab } from "./types";

const TABS: { id: LeftPanelTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "templates", label: "Templates", Icon: LayoutGrid },
  { id: "text", label: "Text", Icon: Type },
  { id: "photos", label: "Photos", Icon: ImageIcon },
  { id: "elements", label: "Elements", Icon: Shapes },
  { id: "draw", label: "Draw", Icon: Pencil },
  { id: "upload", label: "Upload", Icon: CloudUpload },
];

export function StudioSidebar() {
  const { leftPanelTab, setLeftPanelTab, undo, redo, canUndo, canRedo } = useStudio();

  return (
    <aside className="flex flex-col w-16 shrink-0 bg-white border-r border-border">
      <nav className="flex flex-col flex-1 py-2">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setLeftPanelTab(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-3 px-2 rounded-lg mx-1.5 transition-colors",
              leftPanelTab === id
                ? "bg-blue-100 text-blue-700"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            title={label}
          >
            <Icon className="size-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
      <div className="flex flex-col items-center gap-0.5 py-2 border-t border-border">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
          title="Undo"
        >
          <Undo2 className="size-5" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
          title="Redo"
        >
          <Redo2 className="size-5" />
        </button>
        <button
          type="button"
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          title="More options"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </div>
    </aside>
  );
}

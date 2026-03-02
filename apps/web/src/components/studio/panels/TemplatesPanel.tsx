"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useStudio } from "../studio-context";
import { TEMPLATES } from "./templates-data";

export function TemplatesPanel() {
  const {
    contentPanelSearch,
    setContentPanelSearch,
    templatesSameSizeOnly,
    setTemplatesSameSizeOnly,
    pageSize,
    applyTemplateNodes,
  } = useStudio();

  const filtered = TEMPLATES.filter((t) => {
    const matchSearch =
      !contentPanelSearch.trim() ||
      t.name.toLowerCase().includes(contentPanelSearch.toLowerCase());
    const matchSize = !templatesSameSizeOnly || (t.width === pageSize.width && t.height === pageSize.height);
    return matchSearch && matchSize;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={contentPanelSearch}
            onChange={(e) => setContentPanelSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="text-sm text-muted-foreground">Show templates with the same size</span>
          <button
            type="button"
            role="switch"
            aria-checked={templatesSameSizeOnly}
            onClick={() => setTemplatesSameSizeOnly(!templatesSameSizeOnly)}
            className={`
              relative w-11 h-6 rounded-full transition-colors
              ${templatesSameSizeOnly ? "bg-blue-600" : "bg-muted"}
            `}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                ${templatesSameSizeOnly ? "translate-x-5" : "translate-x-0"}
              `}
            />
          </button>
        </label>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => t.nodes && applyTemplateNodes(t.nodes)}
              className="rounded-lg border border-border overflow-hidden bg-muted/30 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-left"
            >
              <div className="aspect-square bg-muted relative">
                {t.thumbnail ? (
                  <img
                    src={t.thumbnail}
                    alt={t.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    {t.name}
                  </span>
                )}
              </div>
              <p className="p-1.5 text-xs font-medium truncate">{t.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

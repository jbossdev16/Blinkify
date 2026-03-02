"use client";

import { useStudio } from "./studio-context";
import { TemplatesPanel } from "./panels/TemplatesPanel";
import { TextPanel } from "./panels/TextPanel";
import { PhotosPanel } from "./panels/PhotosPanel";
import { ElementsPanel } from "./panels/ElementsPanel";
import { DrawPanel } from "./panels/DrawPanel";
import { UploadPanel } from "./panels/UploadPanel";

export function StudioContentPanel() {
  const { leftPanelTab } = useStudio();

  return (
    <aside className="w-80 shrink-0 bg-white border-r border-border flex flex-col overflow-hidden">
      {leftPanelTab === "templates" && <TemplatesPanel />}
      {leftPanelTab === "text" && <TextPanel />}
      {leftPanelTab === "photos" && <PhotosPanel />}
      {leftPanelTab === "elements" && <ElementsPanel />}
      {leftPanelTab === "draw" && <DrawPanel />}
      {leftPanelTab === "upload" && <UploadPanel />}
    </aside>
  );
}

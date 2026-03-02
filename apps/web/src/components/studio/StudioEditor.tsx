"use client";

import { StudioProvider } from "./studio-context";
import { StudioToolbar } from "./StudioToolbar";
import { StudioSidebar } from "./StudioSidebar";
import { StudioContentPanel } from "./StudioContentPanel";
import { StudioCanvas } from "./StudioCanvas";
import { StudioBottomBar } from "./StudioBottomBar";

function StudioEditorInner() {
  return (
    <div className="studio-editor flex flex-col h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-0px)]">
      <StudioToolbar />
      <div className="flex flex-1 min-h-0">
        <StudioSidebar />
        <StudioContentPanel />
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <StudioCanvas />
          </div>
          <StudioBottomBar />
        </div>
      </div>
    </div>
  );
}

export function StudioEditor() {
  return (
    <StudioProvider>
      <StudioEditorInner />
    </StudioProvider>
  );
}

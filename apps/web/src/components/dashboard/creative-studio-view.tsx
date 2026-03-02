"use client";

import { useMemo } from "react";
import type { Project } from "@/lib/api";
import { CreativeStudioChat } from "./creative-studio-chat";

interface CreativeStudioViewProps {
  workspaceId: string;
  projects: Project[];
}

export function CreativeStudioView({ workspaceId, projects }: CreativeStudioViewProps) {
  const defaultProject = useMemo(() => projects[0], [projects]);

  if (!defaultProject) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CreativeStudioChat
        project={defaultProject}
        workspaceId={workspaceId}
      />
    </div>
  );
}

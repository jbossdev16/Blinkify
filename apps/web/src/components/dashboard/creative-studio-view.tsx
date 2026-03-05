"use client";

import type { Project } from "@/lib/api";
import { CreativeStudioChat } from "./creative-studio-chat";

interface CreativeStudioViewProps {
  workspaceId: string;
  projects: Project[];
  plan: string;
}

export function CreativeStudioView({ workspaceId, projects, plan }: CreativeStudioViewProps) {
  if (!projects.length) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CreativeStudioChat
        project={projects[0]}
        allProjects={projects}
        workspaceId={workspaceId}
        plan={plan}
      />
    </div>
  );
}

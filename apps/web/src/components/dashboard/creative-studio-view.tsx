"use client";

import dynamic from "next/dynamic";
import type { Project } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

const CreativeStudioChat = dynamic(
  () => import("./creative-studio-chat").then((m) => ({ default: m.CreativeStudioChat })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center min-h-0 p-8">
        <Spinner size="lg" className="text-muted-foreground" />
      </div>
    ),
  }
);

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

"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useState } from "react";
import type { Project } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

const LAST_CREATIVE_STUDIO_PROJECT_KEY = (workspaceId: string) =>
  `blinkify:creativeStudio:lastProjectId:${workspaceId}`;

function pickInitialProject(workspaceId: string, projects: Project[]): Project {
  if (!projects.length) return projects[0]!;
  if (typeof window === "undefined") return projects[0]!;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("project")?.trim();
    if (fromUrl) {
      const found = projects.find((p) => p.id === fromUrl);
      if (found) return found;
    }
    const stored = localStorage.getItem(LAST_CREATIVE_STUDIO_PROJECT_KEY(workspaceId))?.trim();
    if (stored) {
      const found = projects.find((p) => p.id === stored);
      if (found) return found;
    }
  } catch {
    /* ignore */
  }
  return projects[0]!;
}

const CreativeStudioChat = dynamic(
  () =>
    typeof window !== "undefined"
      ? import("./creative-studio-chat").then((m) => ({ default: m.CreativeStudioChat }))
      : Promise.resolve({ default: () => null }),
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
  const [initialProject, setInitialProject] = useState<Project | null>(() =>
    projects.length ? projects[0]! : null
  );

  useLayoutEffect(() => {
    if (!projects.length) {
      setInitialProject(null);
      return;
    }
    setInitialProject((prev) => {
      const picked = pickInitialProject(workspaceId, projects);
      if (prev && prev.id === picked.id) return prev;
      return picked;
    });
  }, [workspaceId, projects]);

  if (!projects.length || !initialProject) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <CreativeStudioChat
        key={initialProject.id}
        project={initialProject}
        allProjects={projects}
        workspaceId={workspaceId}
        plan={plan}
      />
    </div>
  );
}

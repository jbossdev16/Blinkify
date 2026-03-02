import { StudioEditor } from "@/components/studio/StudioEditor";
import { STUDIO_EDITOR_ENABLED } from "@/components/studio/studio-config";
import { Paintbrush } from "lucide-react";

export default function StudioEditorPage() {
  if (STUDIO_EDITOR_ENABLED) {
    return <StudioEditor />;
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] lg:min-h-[100vh] p-6 text-center">
      <div className="rounded-2xl border border-border px-8 py-12 max-w-md">
        <Paintbrush className="mx-auto size-12 icon-gradient-brand mb-4" />
        <h1 className="text-2xl font-semibold text-foreground">Studio Editor</h1>
        <p className="mt-2 text-muted-foreground">Coming soon</p>
      </div>
    </div>
  );
}

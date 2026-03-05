import { Skeleton } from "@/components/ui/skeleton";

export default function CreativeStudioLoading() {
  return (
    <div className="flex flex-col h-screen min-h-0 animate-in fade-in duration-300">
      {/* Chat area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="w-full max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border bg-card p-3">
            <Skeleton className="h-20 w-full rounded-xl mb-3" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-7 w-16 rounded-lg" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
              <Skeleton className="size-9 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

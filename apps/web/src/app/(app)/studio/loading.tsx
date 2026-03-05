import { Skeleton } from "@/components/ui/skeleton";

export default function StudioLoading() {
  return (
    <div className="p-6 lg:p-10 animate-in fade-in duration-300">
      <div className="mb-8">
        <Skeleton className="h-9 w-36 mb-2" />
        <Skeleton className="h-5 w-56" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        {/* Right panel / preview */}
        <Skeleton className="aspect-square rounded-2xl" />
      </div>
    </div>
  );
}

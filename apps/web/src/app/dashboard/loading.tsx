import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-6 lg:p-10 animate-in fade-in duration-300">
      {/* Greeting */}
      <div className="mb-8">
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-48" />
      </div>

      {/* Top row: 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-3 w-24 mb-4" />
          <Skeleton className="h-28 w-28 rounded-full mx-auto" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-3 w-20 mb-4" />
          <Skeleton className="h-8 w-12 mb-1" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="grid grid-rows-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-16 mb-4 ml-auto" />
            <div className="flex items-center justify-between">
              <Skeleton className="size-10 rounded-lg" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-24 mb-4 ml-auto" />
            <div className="flex items-center justify-between">
              <Skeleton className="size-10 rounded-lg" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      </div>

      {/* Asset collection */}
      <div className="mb-8">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

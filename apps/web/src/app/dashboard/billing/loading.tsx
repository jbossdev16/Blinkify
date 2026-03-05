import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Cards row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-28 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex justify-between mt-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-8 w-28 mb-2" />
          <Skeleton className="h-10 w-full rounded-xl mt-4" />
        </div>
      </div>

      {/* Plan details */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <Skeleton className="h-6 w-36 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full max-w-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function BrandLoading() {
  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Logo + name row */}
      <div className="flex items-center gap-6 mb-8">
        <Skeleton className="size-20 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>

      {/* Color row */}
      <div className="mt-8">
        <Skeleton className="h-4 w-28 mb-3" />
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="size-10 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

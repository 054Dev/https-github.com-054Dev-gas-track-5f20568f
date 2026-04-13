import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  variant?: "dashboard" | "list" | "form" | "detail";
}

export function PageSkeleton({ variant = "list" }: PageSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-32 mt-4" />
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <Skeleton className="h-6 w-32" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Default: list variant
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <Skeleton className="h-10 w-full max-w-sm" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b last:border-b-0 flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

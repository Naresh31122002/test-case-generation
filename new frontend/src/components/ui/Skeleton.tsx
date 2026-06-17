/**
 * Skeleton primitives for route loading states.
 *
 * Server-component friendly (no "use client") so they render instantly inside
 * App Router `loading.tsx` boundaries — no white flash, no layout shift.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-100 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Matches the standard PageHeader (title + actions) so there's no shift. */
export function PageHeaderSkeleton() {
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-border">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-5 lg:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-40" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-[200px]" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A grid of card placeholders (board views). */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-border rounded-card p-5">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-5 w-1/2 mb-4" />
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-6 w-16 rounded" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
          <Skeleton className="h-1.5 w-full mb-4" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A vertical stack of list-row placeholders. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white border border-border rounded-card overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-4 py-3.5 ${
            i < rows - 1 ? "border-b border-border" : ""
          }`}
        >
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Full standard page skeleton: header + body card grid. Drop this into a
 * route's `loading.tsx` for an instant, shift-free placeholder.
 */
export function PageSkeleton({
  variant = "cards",
}: {
  variant?: "cards" | "list";
}) {
  return (
    <div className="flex flex-col h-full">
      <PageHeaderSkeleton />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-5 lg:px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-9 w-[280px]" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28 ml-auto" />
          </div>
          {variant === "cards" ? <CardGridSkeleton /> : <ListSkeleton />}
        </div>
      </div>
    </div>
  );
}

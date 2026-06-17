import { PageHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

/** Mirrors the story workspace layout (header + meta bar + secondary nav). */
export default function Loading() {
  return (
    <div className="flex flex-col h-full">
      <PageHeaderSkeleton />

      {/* Workspace meta header */}
      <div className="bg-white border-b border-border">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-5 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-32" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-14 flex-shrink-0 border-r border-border py-3 px-2 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-lg" />
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-6 space-y-4">
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="h-32 w-full rounded-card" />
            <Skeleton className="h-48 w-full rounded-card" />
          </div>
        </div>
      </div>
    </div>
  );
}

import { PageHeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

/** Mirrors the settings layout (header + 200px sub-nav + content column). */
export default function Loading() {
  return (
    <div className="flex flex-col h-full">
      <PageHeaderSkeleton />
      <div className="flex flex-1 overflow-hidden mx-auto w-full max-w-[1600px]">
        {/* Sub-nav */}
        <div className="w-[200px] flex-shrink-0 border-r border-border py-4 px-2 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 px-4 sm:px-5 lg:px-6 py-6">
          <div className="max-w-[640px] space-y-6">
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="h-40 w-full rounded-card" />
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
        </div>
      </div>
    </div>
  );
}

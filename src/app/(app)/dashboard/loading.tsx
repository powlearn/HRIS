import { Skeleton, SkeletonCards } from "@/components/ui/table";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3 w-80" />
      </div>
      <SkeletonCards count={4} />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 xl:col-span-2">
          <Skeleton className="mb-4 h-4 w-32" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="mb-3 h-4 w-28" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      </div>
    </div>
  );
}

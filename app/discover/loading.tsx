import { Skeleton } from "@/components/ui/foundations";

export default function DiscoverLoading() {
  return (
    <div
      className="page-container grid gap-8 py-10"
      aria-label="Loading live fan activity"
      aria-busy="true"
    >
      <div>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-12 max-w-md" />
        <Skeleton className="mt-3 h-5 max-w-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

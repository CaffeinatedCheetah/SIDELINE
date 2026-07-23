import { Skeleton } from "@/components/ui/foundations";
export default function Loading() {
  return (
    <div className="page-container grid gap-5 py-10" aria-label="Loading">
      <Skeleton className="h-14 w-2/3" />
      <Skeleton className="h-32" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

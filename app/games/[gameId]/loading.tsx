import { Skeleton } from "@/components/ui/foundations";

export default function GameRoomLoading() {
  return (
    <div
      className="page-container grid gap-6 py-8"
      aria-label="Loading Game Room"
      aria-busy="true"
    >
      <div className="border-border-subtle bg-surface-1 overflow-hidden rounded-2xl border p-5 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
        <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Skeleton className="ml-auto h-24 w-24 rounded-2xl" />
          <Skeleton className="h-16 w-28 rounded-xl" />
          <Skeleton className="h-24 w-24 rounded-2xl" />
        </div>
        <Skeleton className="mx-auto mt-7 h-5 w-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

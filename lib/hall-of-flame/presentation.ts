export const HALL_SORTS = [
  { key: "ranked", label: "Top ranked" },
  { key: "reacted", label: "Most reacted" },
  { key: "discussed", label: "Most discussed" },
  { key: "rising", label: "Newest rising" },
] as const;

export type HallSort = (typeof HALL_SORTS)[number]["key"];

type SortableHallEntry = {
  rank: number;
  take: {
    createdAt: Date;
    _count: { reactions: number; comments: number; replies: number };
  };
};

export function sortHallEntries<T extends SortableHallEntry>(
  entries: T[],
  sort: HallSort,
) {
  return [...entries].sort((left, right) => {
    if (sort === "reacted")
      return (
        right.take._count.reactions - left.take._count.reactions ||
        left.rank - right.rank
      );
    if (sort === "discussed")
      return (
        right.take._count.comments +
          right.take._count.replies -
          (left.take._count.comments + left.take._count.replies) ||
        left.rank - right.rank
      );
    if (sort === "rising")
      return (
        right.take.createdAt.getTime() - left.take.createdAt.getTime() ||
        left.rank - right.rank
      );
    return left.rank - right.rank;
  });
}

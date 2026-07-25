import type { Metadata } from "next";
import { CommunityCard } from "@/components/communities/community-card";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/foundations";
import { Input } from "@/components/ui/form-controls";
import { db } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

type CommunityListItem = Prisma.CommunityGetPayload<{
  include: { _count: { select: { members: true; takes: true } } };
}>;
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Communities",
  description:
    "Public spaces organized around teams, leagues, and the conversations fans care about.",
};
export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let communities: CommunityListItem[] = [];
  try {
    communities = (await db.community.findMany({
      where: {
        status: "ACTIVE",
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      include: { _count: { select: { members: true, takes: true } } },
    })) as typeof communities;
  } catch {}
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Find your crowd"
        title="Communities"
        description="Public spaces organized around teams, leagues, and the conversations fans care about."
      />
      <form className="mb-8 flex gap-3">
        <Input
          aria-label="Search communities"
          name="q"
          defaultValue={q}
          placeholder="Search communities"
        />
        <button className="bg-brand rounded-sm px-5 font-bold">Search</button>
      </form>
      {communities.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {communities.map((community) => (
            <CommunityCard
              key={community.id}
              slug={community.slug}
              name={community.name}
              description={community.description}
              members={community._count.members}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No communities found"
          description="Try a broader search."
        />
      )}
    </div>
  );
}

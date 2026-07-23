import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card } from "@/components/ui/foundations";
export function ProfileCard({
  handle,
  displayName,
  bio,
  fanScore,
  rank,
  following = false,
}: {
  handle: string;
  displayName: string;
  bio: string;
  fanScore: number;
  rank?: number;
  following?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Avatar name={displayName} size="lg" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/users/${handle}`}
            className="text-lg font-bold hover:underline"
          >
            {displayName}
          </Link>
          <p className="text-text-muted text-sm">@{handle}</p>
        </div>
        {rank && <Badge tone="live">#{rank}</Badge>}
      </div>
      <p className="text-text-secondary mt-3 line-clamp-2 text-sm">{bio}</p>
      <div className="border-border-subtle mt-4 flex items-center justify-between border-t pt-3">
        <span>
          <strong className="text-brand">{fanScore}</strong>{" "}
          <span className="text-text-secondary text-sm">Fan Score</span>
        </span>
        <Button variant={following ? "secondary" : "primary"} size="sm">
          {following ? "Following" : "Follow"}
        </Button>
      </div>
    </Card>
  );
}

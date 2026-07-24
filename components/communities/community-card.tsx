import { Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, Card } from "@/components/ui/foundations";
import { formatCount } from "@/lib/utils";
export function CommunityCard({
  slug,
  name,
  description,
  members,
  joined = false,
}: {
  slug: string;
  name: string;
  description: string;
  members: number;
  joined?: boolean;
}) {
  return (
    <Card className="hover:border-border-strong relative transition">
      <div className="flex gap-3">
        <Avatar name={name} size="lg" />
        <div>
          <Link
            href={`/communities/${slug}`}
            className="text-lg font-bold after:absolute after:inset-0"
          >
            {name}
          </Link>
          <p className="text-text-secondary mt-1 line-clamp-2 text-sm">
            {description}
          </p>
        </div>
      </div>
      <div className="border-border-subtle relative mt-4 flex items-center justify-between border-t pt-3">
        <span className="text-text-secondary flex items-center gap-2 text-sm">
          <Users aria-hidden className="size-4" />
          {formatCount(members)} members
        </span>
        <Button variant={joined ? "secondary" : "primary"} size="sm">
          {joined ? "Joined" : "Join"}
        </Button>
      </div>
    </Card>
  );
}

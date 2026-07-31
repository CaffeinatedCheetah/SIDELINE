"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/foundations";

export default function GameRoomError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="page-container py-10">
      <ErrorState
        title="Game Room unavailable"
        description="The game could not be loaded right now. Try again, or open the Games page and choose another game."
        retry={
          <div className="flex flex-wrap gap-3">
            <Button onClick={reset}>Try again</Button>
            <Link href="/games" className="text-brand font-bold hover:underline">
              View games
            </Link>
          </div>
        }
      />
    </div>
  );
}

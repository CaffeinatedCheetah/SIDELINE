import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/foundations";

export default function NotFound() {
  return (
    <div className="page-container grid flex-1 place-items-center py-14">
      <EmptyState
        title="Page not found"
        description="This link may be broken, or whatever you're looking for may have been removed."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/" className={buttonStyles()}>
              Back to home
            </Link>
            <Link href="/games" className={buttonStyles({ variant: "secondary" })}>
              Browse games
            </Link>
          </div>
        }
      />
    </div>
  );
}

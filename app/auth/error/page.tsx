import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/foundations";
export default function AuthErrorPage() {
  return (
    <div className="page-container grid flex-1 place-items-center py-14">
      <ErrorState
        title="We could not sign you in"
        description="The link may have expired or the provider may be unavailable."
        retry={
          <Link className={buttonStyles()} href="/auth/sign-in">
            Try again
          </Link>
        }
      />
    </div>
  );
}

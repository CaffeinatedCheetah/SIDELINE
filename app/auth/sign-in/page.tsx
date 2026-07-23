import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/foundations";
import { Field, Input } from "@/components/ui/form-controls";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const query = await searchParams;
  async function emailAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    try {
      await signIn(process.env.EMAIL_SERVER ? "nodemailer" : "development", {
        email,
        redirectTo: query.callbackUrl ?? "/arena",
      });
    } catch (error) {
      if (error instanceof AuthError) redirect("/auth/error");
      throw error;
    }
  }
  return (
    <div className="page-container grid flex-1 place-items-center py-14">
      <Card className="w-full max-w-md">
        <p className="text-brand text-xs font-bold tracking-widest uppercase">
          Welcome back
        </p>
        <h1 className="font-display mt-2 text-4xl font-black">Sign in</h1>
        <p className="text-text-secondary mt-2">
          Return to your games, communities, and fan identity.
        </p>
        {query.error && (
          <p role="alert" className="text-danger mt-4 text-sm">
            Sign-in failed. Check your details and try again.
          </p>
        )}
        <form action={emailAction} className="mt-6 grid gap-4">
          <Field
            label="Email"
            htmlFor="email"
            help={
              process.env.ENABLE_DEV_AUTH === "true"
                ? "Development: use demo@fantakes.local"
                : "We will email a secure sign-in link."
            }
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Button type="submit">Continue with email</Button>
        </form>
        {process.env.AUTH_GOOGLE_ID && (
          <form
            action={async () => {
              "use server";
              await signIn("google", {
                redirectTo: query.callbackUrl ?? "/arena",
              });
            }}
            className="mt-3"
          >
            <Button type="submit" variant="secondary" className="w-full">
              Continue with Google
            </Button>
          </form>
        )}
        <p className="text-text-secondary mt-6 text-center text-sm">
          New here?{" "}
          <Link
            className="text-brand font-bold hover:underline"
            href="/auth/sign-up"
          >
            Create a fan profile
          </Link>
        </p>
      </Card>
    </div>
  );
}

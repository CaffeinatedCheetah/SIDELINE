import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DebateComposer } from "@/components/actions/debate-composer";
import { Card } from "@/components/ui/foundations";
export default async function NewDebate() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in?callbackUrl=/debates/new");
  return (
    <div className="page-container max-w-3xl py-10">
      <h1 className="font-display text-4xl font-black">Start a debate</h1>
      <p className="text-text-secondary mt-2">
        Frame a clear sports question and offer meaningful positions.
      </p>
      <Card className="mt-8">
        <DebateComposer />
      </Card>
    </div>
  );
}

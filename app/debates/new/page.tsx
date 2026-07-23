import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/foundations";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
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
        <form action="/api/v1/debates" method="post" className="grid gap-4">
          <Field label="Question" htmlFor="title">
            <Input
              id="title"
              name="title"
              minLength={10}
              maxLength={140}
              required
            />
          </Field>
          <Field label="Context" htmlFor="prompt">
            <Textarea
              id="prompt"
              name="prompt"
              minLength={20}
              maxLength={2000}
              required
            />
          </Field>
          <Field label="Option one" htmlFor="option1">
            <Input id="option1" name="option1" required />
          </Field>
          <Field label="Option two" htmlFor="option2">
            <Input id="option2" name="option2" required />
          </Field>
          <Button type="submit">Publish debate</Button>
        </form>
      </Card>
    </div>
  );
}

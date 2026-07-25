import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/foundations";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/onboarding");
  const { error } = await searchParams;
  const [sports, teams] = await Promise.all([
    db.sport.findMany({ where: { active: true } }),
    db.team.findMany({ take: 20, include: { league: true } }),
  ]);
  async function complete(formData: FormData) {
    "use server";
    const current = await auth();
    if (!current?.user?.id) redirect("/auth/sign-in");
    const displayName = String(formData.get("displayName") ?? "").trim();
    const handle = String(formData.get("handle") ?? "")
      .trim()
      .toLowerCase();
    if (displayName.length < 2 || !/^[a-z0-9-]{3,30}$/.test(handle))
      redirect("/onboarding?error=details");
    const favoriteSports = formData.getAll("sports").map(String);
    const favoriteTeams = formData.getAll("teams").map(String);
    try {
      await db.user.update({
        where: { id: current.user.id },
        data: {
          displayName,
          handle,
          normalizedHandle: handle,
          onboardedAt: new Date(),
          profile: {
            upsert: {
              create: { favoriteSports, favoriteTeams },
              update: { favoriteSports, favoriteTeams },
            },
          },
          preferences: {
            upsert: {
              create: { onboardingStep: 5 },
              update: { onboardingStep: 5 },
            },
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        redirect("/onboarding?error=handle-taken");
      }
      throw err;
    }
    redirect("/arena");
  }
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeadingSimple />
      <Card>
        {error && (
          <p role="alert" className="text-danger mb-4 text-sm">
            {error === "handle-taken"
              ? "That fan handle is already taken. Try another."
              : "Please double-check your display name and fan handle."}
          </p>
        )}
        <form action={complete} className="grid gap-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" htmlFor="displayName">
              <Input
                id="displayName"
                name="displayName"
                required
                maxLength={50}
              />
            </Field>
            <Field
              label="Fan handle"
              htmlFor="handle"
              help="Lowercase letters, numbers, and hyphens."
            >
              <Input
                id="handle"
                name="handle"
                required
                pattern="[a-z0-9-]{3,30}"
              />
            </Field>
          </div>
          <fieldset>
            <legend className="font-bold">1. Favorite sports</legend>
            <div className="mt-2 grid sm:grid-cols-2">
              {sports.map((sport) => (
                <Checkbox
                  key={sport.id}
                  name="sports"
                  value={sport.id}
                  label={sport.name}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-bold">2. Favorite teams</legend>
            <div className="mt-2 grid sm:grid-cols-2">
              {teams.map((team) => (
                <Checkbox
                  key={team.id}
                  name="teams"
                  value={team.id}
                  label={`${team.name} · ${team.league.abbreviation}`}
                />
              ))}
            </div>
          </fieldset>
          <p className="text-text-secondary text-sm">
            3. Suggested public communities will appear in My Arena based on
            these selections. Avatar setup is optional and remains available in
            Settings.
          </p>
          <Button type="submit">Finish and open My Arena</Button>
        </form>
      </Card>
    </div>
  );
}
function PageHeadingSimple() {
  return (
    <header className="mb-8">
      <p className="text-brand text-xs font-bold tracking-widest uppercase">
        Build your fan identity
      </p>
      <h1 className="font-display mt-2 text-4xl font-black">
        Welcome to FanTakes
      </h1>
      <p className="text-text-secondary mt-2">
        Choose what you follow. You can change everything later.
      </p>
    </header>
  );
}

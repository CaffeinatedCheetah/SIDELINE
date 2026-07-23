import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/foundations";
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/form-controls";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/settings");
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { profile: true, preferences: true },
  });
  async function save(formData: FormData) {
    "use server";
    const current = await auth();
    if (!current?.user?.id) redirect("/auth/sign-in");
    const displayName = String(formData.get("displayName") ?? "").trim();
    const bio = String(formData.get("bio") ?? "").trim();
    const theme = String(formData.get("theme") ?? "dark");
    await db.user.update({
      where: { id: current.user.id },
      data: {
        displayName,
        profile: {
          upsert: {
            create: { bio, favoriteSports: [], favoriteTeams: [] },
            update: { bio },
          },
        },
        preferences: {
          upsert: {
            create: {
              theme,
              reducedMotion: formData.get("reducedMotion") === "on",
            },
            update: {
              theme,
              reducedMotion: formData.get("reducedMotion") === "on",
            },
          },
        },
      },
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="Your account"
        title="Settings"
        description="Control your profile, notifications, privacy, appearance, and account security."
      />
      <div className="grid gap-5">
        <Card>
          <form action={save} className="grid gap-4">
            <h2 className="font-display text-2xl font-black">
              Profile and appearance
            </h2>
            <Field label="Display name" htmlFor="displayName">
              <Input
                id="displayName"
                name="displayName"
                defaultValue={user.displayName}
                required
              />
            </Field>
            <Field label="Bio" htmlFor="bio">
              <Textarea
                id="bio"
                name="bio"
                maxLength={300}
                defaultValue={user.profile?.bio ?? ""}
              />
            </Field>
            <Field label="Appearance" htmlFor="theme">
              <Select
                id="theme"
                name="theme"
                defaultValue={user.preferences?.theme ?? "dark"}
              >
                <option value="dark">Dark</option>
                <option value="system">System</option>
                <option value="high-contrast">High contrast</option>
              </Select>
            </Field>
            <Checkbox
              name="reducedMotion"
              defaultChecked={user.preferences?.reducedMotion}
              label="Reduce motion"
            />
            <Button type="submit">Save settings</Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-display text-2xl font-black">
            Account and safety
          </h2>
          <ul className="text-text-secondary mt-4 grid gap-3">
            <li>Notification preferences</li>
            <li>Privacy controls</li>
            <li>Linked accounts</li>
            <li>Blocked and muted users</li>
            <li>Security and data export</li>
          </ul>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            className="mt-5"
          >
            <Button variant="secondary" type="submit">
              Log out
            </Button>
          </form>
          <Button className="mt-3" variant="danger" type="button">
            Delete account
          </Button>
        </Card>
      </div>
    </>
  );
}

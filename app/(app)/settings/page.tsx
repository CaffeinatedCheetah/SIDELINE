import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/components/actions/logout-button";
import { AccountDangerZone } from "@/components/profile/account-danger-zone";
import { DirtyForm } from "@/components/settings/dirty-form";
import { ProfileEditor } from "@/components/settings/profile-editor";
import { ManagedUserList } from "@/components/settings/managed-user-list";
import { SectionSelect } from "@/components/settings/section-select";
import { PageHeading } from "@/components/layout/page-heading";
import { Card } from "@/components/ui/foundations";
import { Checkbox, Field, Select } from "@/components/ui/form-controls";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { key: "profile", label: "Profile" },
  { key: "interests", label: "Teams & interests" },
  { key: "notifications", label: "Notifications" },
  { key: "privacy", label: "Privacy & safety" },
  { key: "accessibility", label: "Accessibility & data" },
  { key: "sessions", label: "Sessions" },
  { key: "account", label: "Account" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

type NotificationSettings = {
  replies: boolean;
  predictions: boolean;
  games: boolean;
  communities: boolean;
  follows: boolean;
};
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  replies: true,
  predictions: true,
  games: true,
  communities: true,
  follows: true,
};

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/settings");
  const { section: rawSection } = await searchParams;
  const section: SectionKey =
    SECTIONS.find((s) => s.key === rawSection)?.key ?? "profile";

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { profile: true, preferences: true },
  });
  const notificationSettings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...((user.preferences
      ?.notificationSettings as Partial<NotificationSettings>) ?? {}),
  };
  const privacySettings = (user.preferences?.privacySettings ?? {}) as {
    profileDiscoverable?: boolean;
    showActivity?: boolean;
  };

  async function saveProfile(formData: FormData) {
    "use server";
    const current = await auth();
    if (!current?.user?.id) redirect("/auth/sign-in");
    const displayName = String(formData.get("displayName") ?? "").trim();
    const handle = String(formData.get("handle") ?? "")
      .trim()
      .toLowerCase();
    const bio = String(formData.get("bio") ?? "").trim();
    const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
    if (
      displayName.length < 2 ||
      displayName.length > 50 ||
      bio.length > 300 ||
      !/^[a-z0-9-]{3,30}$/.test(handle)
    )
      redirect("/settings?section=profile&error=invalid");
    const existingHandle = await db.user.findFirst({
      where: {
        normalizedHandle: handle,
        id: { not: current.user.id },
      },
      select: { id: true },
    });
    if (existingHandle) redirect("/settings?section=profile&error=handle");
    try {
      await db.user.update({
        where: { id: current.user.id },
        data: {
          displayName,
          handle,
          normalizedHandle: handle,
          profile: {
            upsert: {
              create: {
                bio,
                avatarUrl: avatarUrl || undefined,
                favoriteSports: [],
                favoriteTeams: [],
              },
              update: { bio, avatarUrl: avatarUrl || null },
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        redirect("/settings?section=profile&error=handle");
      throw error;
    }
    redirect(`/u/${handle}`);
  }

  async function saveInterests(formData: FormData) {
    "use server";
    const current = await auth();
    if (!current?.user?.id) redirect("/auth/sign-in");
    const favoriteSports = formData.getAll("sports").map(String);
    const favoriteTeams = formData.getAll("teams").map(String);
    await db.user.update({
      where: { id: current.user.id },
      data: {
        profile: {
          upsert: {
            create: { favoriteSports, favoriteTeams },
            update: { favoriteSports, favoriteTeams },
          },
        },
      },
    });
    redirect("/settings?section=interests");
  }

  async function saveNotifications(formData: FormData) {
    "use server";
    const current = await auth();
    if (!current?.user?.id) redirect("/auth/sign-in");
    const next: NotificationSettings = {
      replies: formData.get("replies") === "on",
      predictions: formData.get("predictions") === "on",
      games: formData.get("games") === "on",
      communities: formData.get("communities") === "on",
      follows: formData.get("follows") === "on",
    };
    await db.user.update({
      where: { id: current.user.id },
      data: {
        preferences: {
          upsert: {
            create: { notificationSettings: next },
            update: { notificationSettings: next },
          },
        },
      },
    });
    redirect("/settings?section=notifications");
  }

  async function savePrivacy(formData: FormData) {
    "use server";
    const current = await auth();
    if (!current?.user?.id) redirect("/auth/sign-in");
    const next = {
      profileDiscoverable: formData.get("profileDiscoverable") === "on",
      showActivity: formData.get("showActivity") === "on",
    };
    await db.user.update({
      where: { id: current.user.id },
      data: {
        preferences: {
          upsert: {
            create: { privacySettings: next },
            update: { privacySettings: next },
          },
        },
      },
    });
    redirect("/settings?section=privacy");
  }

  async function saveAccessibility(formData: FormData) {
    "use server";
    const current = await auth();
    if (!current?.user?.id) redirect("/auth/sign-in");
    const theme = String(formData.get("theme") ?? "dark");
    const reducedMotion = formData.get("reducedMotion") === "on";
    const reducedData = formData.get("reducedData") === "on";
    await db.user.update({
      where: { id: current.user.id },
      data: {
        preferences: {
          upsert: {
            create: { theme, reducedMotion, reducedData },
            update: { theme, reducedMotion, reducedData },
          },
        },
      },
    });
    redirect("/settings?section=accessibility");
  }

  return (
    <>
      <PageHeading eyebrow="Your account" title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Settings sections">
          <SectionSelect sections={SECTIONS} active={section} />
          <ul className="hidden gap-1 lg:grid">
            {SECTIONS.map(({ key, label }) => (
              <li key={key}>
                <Link
                  href={`/settings?section=${key}`}
                  aria-current={section === key ? "page" : undefined}
                  className={`block min-h-11 rounded-sm px-3 py-2 text-sm font-bold ${
                    section === key
                      ? "bg-brand-surface text-brand-light"
                      : "text-text-secondary hover:bg-surface-3"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="max-w-[680px]">
          {section === "profile" && (
            <Card>
              <h2 className="font-display text-2xl font-black">Profile</h2>
              <ProfileEditor
                action={saveProfile}
                initial={{
                  displayName: user.displayName,
                  handle: user.handle,
                  bio: user.profile?.bio ?? "",
                  avatarUrl: user.profile?.avatarUrl ?? user.image ?? "",
                }}
              />
            </Card>
          )}

          {section === "interests" && (
            <Card>
              <h2 className="font-display text-2xl font-black">
                Teams & interests
              </h2>
              <InterestsForm
                action={saveInterests}
                favoriteSports={user.profile?.favoriteSports ?? []}
                favoriteTeams={user.profile?.favoriteTeams ?? []}
              />
            </Card>
          )}

          {section === "notifications" && (
            <Card>
              <h2 className="font-display text-2xl font-black">
                Notifications
              </h2>
              <p className="text-text-secondary mt-2 text-sm">
                Safety and account notices always send, regardless of these
                settings.
              </p>
              <DirtyForm action={saveNotifications}>
                <fieldset className="mt-4 grid gap-1">
                  <legend className="sr-only">Notification types</legend>
                  <Checkbox
                    name="replies"
                    label="Replies to your takes"
                    defaultChecked={notificationSettings.replies}
                  />
                  <Checkbox
                    name="predictions"
                    label="Prediction results"
                    defaultChecked={notificationSettings.predictions}
                  />
                  <Checkbox
                    name="games"
                    label="Games you follow"
                    defaultChecked={notificationSettings.games}
                  />
                  <Checkbox
                    name="communities"
                    label="Community activity"
                    defaultChecked={notificationSettings.communities}
                  />
                  <Checkbox
                    name="follows"
                    label="New followers"
                    defaultChecked={notificationSettings.follows}
                  />
                </fieldset>
              </DirtyForm>
            </Card>
          )}

          {section === "privacy" && (
            <div className="grid gap-5">
              <Card>
                <h2 className="font-display text-2xl font-black">Privacy</h2>
                <DirtyForm action={savePrivacy}>
                  <fieldset className="mt-4 grid gap-1">
                    <legend className="sr-only">Privacy</legend>
                    <Checkbox
                      name="profileDiscoverable"
                      label="Make my profile discoverable in search and indexable"
                      defaultChecked={
                        privacySettings.profileDiscoverable ?? true
                      }
                    />
                    <Checkbox
                      name="showActivity"
                      label="Show my activity on my profile"
                      defaultChecked={privacySettings.showActivity ?? true}
                    />
                  </fieldset>
                </DirtyForm>
              </Card>
              <Card>
                <h2 className="font-display text-2xl font-black">
                  Blocked accounts
                </h2>
                <div className="mt-4">
                  <BlockedList userId={user.id} />
                </div>
              </Card>
              <Card>
                <h2 className="font-display text-2xl font-black">
                  Muted accounts
                </h2>
                <div className="mt-4">
                  <MutedList userId={user.id} />
                </div>
              </Card>
            </div>
          )}

          {section === "accessibility" && (
            <Card>
              <h2 className="font-display text-2xl font-black">
                Accessibility & data
              </h2>
              <DirtyForm action={saveAccessibility}>
                <div className="mt-4 grid gap-4">
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
                    label="Reduce motion"
                    defaultChecked={user.preferences?.reducedMotion}
                  />
                  <Checkbox
                    name="reducedData"
                    label="Reduce data usage"
                    defaultChecked={user.preferences?.reducedData}
                  />
                </div>
              </DirtyForm>
            </Card>
          )}

          {section === "sessions" && (
            <Card>
              <h2 className="font-display text-2xl font-black">Sessions</h2>
              <p className="text-text-secondary mt-2 text-sm">
                Sign-in uses short-lived tokens rather than server-tracked
                sessions, so only this device&rsquo;s session can be shown or
                ended here -- there is no record of other signed-in devices to
                list or revoke individually yet.
              </p>
              <div className="mt-4">
                <LogoutButton>Sign out this device</LogoutButton>
              </div>
            </Card>
          )}

          {section === "account" && (
            <Card>
              <h2 className="font-display text-2xl font-black">Account</h2>
              <div className="mt-4">
                <LogoutButton />
              </div>
              <AccountDangerZone />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

async function InterestsForm({
  action,
  favoriteSports,
  favoriteTeams,
}: {
  action: (formData: FormData) => void;
  favoriteSports: string[];
  favoriteTeams: string[];
}) {
  const [sports, teams] = await Promise.all([
    db.sport.findMany({ where: { active: true } }),
    db.team.findMany({ include: { league: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <DirtyForm action={action}>
      <fieldset className="mt-4">
        <legend className="font-bold">Favorite sports</legend>
        <div className="mt-2 grid sm:grid-cols-2">
          {sports.map((sport) => (
            <Checkbox
              key={sport.id}
              name="sports"
              value={sport.id}
              label={sport.name}
              defaultChecked={favoriteSports.includes(sport.id)}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-5">
        <legend className="font-bold">Favorite teams</legend>
        <div className="mt-2 grid sm:grid-cols-2">
          {teams.map((team) => (
            <Checkbox
              key={team.id}
              name="teams"
              value={team.id}
              label={`${team.name} · ${team.league.abbreviation}`}
              defaultChecked={favoriteTeams.includes(team.id)}
            />
          ))}
        </div>
      </fieldset>
    </DirtyForm>
  );
}

async function BlockedList({ userId }: { userId: string }) {
  const blocks = await db.block.findMany({
    where: { blockerId: userId },
    include: {
      blocked: { select: { id: true, handle: true, displayName: true } },
    },
  });
  return (
    <ManagedUserList
      resource="blocks"
      users={blocks.map((b) => b.blocked)}
      emptyTitle="No blocked accounts"
      emptyDescription="Accounts you block appear here so you can unblock them anytime."
    />
  );
}

async function MutedList({ userId }: { userId: string }) {
  const mutes = await db.mute.findMany({
    where: { userId, targetType: "USER" },
  });
  const users = await db.user.findMany({
    where: { id: { in: mutes.map((m) => m.targetId) } },
    select: { id: true, handle: true, displayName: true },
  });
  return (
    <ManagedUserList
      resource="mutes"
      users={users}
      emptyTitle="No muted accounts"
      emptyDescription="Accounts you mute appear here so you can unmute them anytime."
    />
  );
}

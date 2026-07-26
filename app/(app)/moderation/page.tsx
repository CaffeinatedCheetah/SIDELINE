import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ReportActions } from "@/components/moderation/report-actions";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge, Card, EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

async function resolveTarget(targetType: string, targetId: string) {
  if (targetType === "TAKE") {
    const take = await db.take.findUnique({
      where: { id: targetId },
      select: {
        body: true,
        status: true,
        author: { select: { handle: true, displayName: true } },
      },
    });
    return take
      ? {
          preview: take.body,
          removed: take.status === "MODERATOR_REMOVED",
          authorHandle: take.author.handle,
          authorName: take.author.displayName,
        }
      : null;
  }
  if (targetType === "COMMENT") {
    const comment = await db.comment.findUnique({
      where: { id: targetId },
      select: {
        body: true,
        status: true,
        author: { select: { handle: true, displayName: true } },
      },
    });
    return comment
      ? {
          preview: comment.body,
          removed: comment.status === "MODERATOR_REMOVED",
          authorHandle: comment.author.handle,
          authorName: comment.author.displayName,
        }
      : null;
  }
  const user = await db.user.findUnique({
    where: { id: targetId },
    select: { handle: true, displayName: true, status: true, mutedUntil: true },
  });
  return user
    ? {
        preview: null,
        removed: false,
        authorHandle: user.handle,
        authorName: user.displayName,
        userStatus: user.status,
        mutedUntil: user.mutedUntil,
      }
    : null;
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/moderation");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  // Server-side gate -- the only real authorization boundary. Hiding the
  // nav link for regular users (Navbar/app-shell) isn't authorization on
  // its own; this redirect is what actually stops a USER-role visitor who
  // guesses the URL, and every mutation below is independently re-checked
  // by the API (moderation-actions/reports:dismiss both re-verify role).
  if (!user || user.role === "USER") redirect("/arena");

  const { reason: reasonFilter } = await searchParams;
  const [reports, reasons] = await Promise.all([
    db.report.findMany({
      where: {
        state: { in: ["OPEN", "IN_REVIEW"] },
        ...(reasonFilter ? { reason: reasonFilter } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: { reporter: { select: { handle: true } } },
    }),
    db.report.findMany({
      where: { state: { in: ["OPEN", "IN_REVIEW"] } },
      distinct: ["reason"],
      select: { reason: true },
    }),
  ]);

  const targets = await Promise.all(
    reports.map((report) => resolveTarget(report.targetType, report.targetId)),
  );
  const history = await Promise.all(
    reports.map((report) =>
      db.moderationAction.findMany({
        where: { targetType: report.targetType, targetId: report.targetId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ),
  );

  return (
    <>
      <PageHeading
        eyebrow="Internal safety"
        title="Moderation queue"
        description="Review reports in order and record every intervention in the append-only action log."
      />
      {reasons.length > 1 && (
        <nav aria-label="Report category" className="mb-6 flex flex-wrap gap-1">
          <Link
            href="/moderation"
            aria-current={!reasonFilter ? "page" : undefined}
            className={`min-h-9 rounded-sm px-3 py-1.5 text-sm font-bold ${
              !reasonFilter
                ? "bg-brand-surface text-brand-light"
                : "text-text-secondary hover:bg-surface-3"
            }`}
          >
            All
          </Link>
          {reasons.map(({ reason }) => (
            <Link
              key={reason}
              href={`/moderation?reason=${encodeURIComponent(reason)}`}
              aria-current={reasonFilter === reason ? "page" : undefined}
              className={`min-h-9 rounded-sm px-3 py-1.5 text-sm font-bold ${
                reasonFilter === reason
                  ? "bg-brand-surface text-brand-light"
                  : "text-text-secondary hover:bg-surface-3"
              }`}
            >
              {reason}
            </Link>
          ))}
        </nav>
      )}
      {reports.length ? (
        <div className="grid gap-4">
          {reports.map((report, index) => {
            const target = targets[index];
            const pastActions = history[index] ?? [];
            return (
              <Card key={report.id}>
                <div className="flex justify-between gap-4">
                  <div>
                    <strong>{report.reason}</strong>
                    <p className="text-text-muted text-sm">
                      {report.targetType} · Reported by @{report.reporter.handle}
                    </p>
                  </div>
                  <Badge tone={report.state === "OPEN" ? "warning" : "neutral"}>
                    {report.state}
                  </Badge>
                </div>
                {report.detail && (
                  <p className="text-text-secondary mt-2 text-sm">
                    {report.detail}
                  </p>
                )}
                <div className="border-border-subtle bg-surface-1 mt-3 rounded-md border p-3">
                  {!target ? (
                    <p className="text-text-muted text-sm">
                      The reported content no longer exists.
                    </p>
                  ) : (
                    <>
                      <Link
                        href={`/users/${target.authorHandle}`}
                        className="text-sm font-bold hover:underline"
                      >
                        {target.authorName}
                      </Link>
                      {target.preview ? (
                        <p className="mt-1 whitespace-pre-wrap">
                          {target.removed ? (
                            <span className="text-text-muted italic">
                              [Content removed] {target.preview}
                            </span>
                          ) : (
                            target.preview
                          )}
                        </p>
                      ) : (
                        <p className="text-text-muted mt-1 text-sm">
                          {target.userStatus === "SUSPENDED"
                            ? "Account currently suspended"
                            : target.mutedUntil && target.mutedUntil > new Date()
                              ? `Account muted until ${target.mutedUntil.toLocaleString()}`
                              : "No current restrictions"}
                        </p>
                      )}
                    </>
                  )}
                </div>
                {pastActions.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="text-text-secondary cursor-pointer">
                      {pastActions.length} prior action
                      {pastActions.length === 1 ? "" : "s"} against this target
                    </summary>
                    <ul className="text-text-muted mt-2 grid gap-1">
                      {pastActions.map((action) => (
                        <li key={action.id}>
                          {action.action.replaceAll("_", " ")} —{" "}
                          {action.createdAt.toLocaleDateString()}: {action.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {target && (
                  <div className="mt-4">
                    <ReportActions
                      reportId={report.id}
                      targetType={report.targetType as "TAKE" | "COMMENT" | "USER"}
                      targetId={report.targetId}
                      contentRemoved={target.removed}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="The queue is clear"
          description="New safety reports appear here."
        />
      )}
    </>
  );
}

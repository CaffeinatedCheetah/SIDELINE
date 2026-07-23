import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeading } from "@/components/layout/page-heading";
import { Card, EmptyState } from "@/components/ui/foundations";
import { db } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export default async function ModerationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/moderation");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role === "USER") redirect("/arena");
  const reports = await db.report.findMany({
    where: { state: { in: ["OPEN", "IN_REVIEW"] } },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { reporter: { select: { handle: true } } },
  });
  return (
    <>
      <PageHeading
        eyebrow="Internal safety"
        title="Moderation queue"
        description="Review reports in order and record every intervention in the append-only action log."
      />
      {reports.length ? (
        <div className="grid gap-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex justify-between">
                <strong>{report.reason}</strong>
                <span className="text-text-muted text-sm">{report.state}</span>
              </div>
              <p className="text-text-secondary mt-2 text-sm">
                {report.targetType} · {report.targetId}
              </p>
              <p className="mt-2">{report.detail}</p>
              <p className="text-text-muted mt-3 text-xs">
                Reported by @{report.reporter.handle}
              </p>
            </Card>
          ))}
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

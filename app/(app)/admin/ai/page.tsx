import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge, Card } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { getAiConfig } from "@/lib/ai/config";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function AiOperationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/admin/ai");
  const operator = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (operator?.role !== "ADMIN") redirect("/arena");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [counts, usage, feedback, recent] = await Promise.all([
    db.aiArtifact.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.aiArtifact.aggregate({
      where: { generatedAt: { gte: today } },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cachedTokens: true,
        estimatedCost: true,
        cacheHitCount: true,
      },
      _avg: { latencyMs: true },
      _count: { _all: true },
    }),
    db.aiArtifactFeedback.groupBy({
      by: ["value"],
      _count: { _all: true },
    }),
    db.aiArtifact.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        entityId: true,
        status: true,
        model: true,
        promptVersion: true,
        errorCode: true,
        latencyMs: true,
        updatedAt: true,
      },
    }),
  ]);
  const config = getAiConfig();

  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Admin · AI operations"
        title="SIDELINE AI"
        description="Sanitized generation health, usage, and feedback. Prompts, credentials, and private context are never shown."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={config.enabled ? "success" : "warning"}>
          AI {config.enabled ? "enabled" : "disabled"}
        </Badge>
        <Badge tone={config.gameRecapsEnabled ? "success" : "neutral"}>
          Game recaps {config.gameRecapsEnabled ? "enabled" : "disabled"}
        </Badge>
        <Badge tone="neutral">Model {config.summaryModel}</Badge>
        <Badge tone="neutral">Prompt game-recap-v1</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Generated today" value={usage._count._all} />
        <Metric
          label="Tokens today"
          value={(usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0)}
        />
        <Metric label="Cache hits" value={usage._sum.cacheHitCount ?? 0} />
        <Metric
          label="Average latency"
          value={`${Math.round(usage._avg.latencyMs ?? 0)} ms`}
        />
      </div>
      <Card className="mt-6">
        <h2 className="font-display text-xl font-black">Artifact status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {counts.map((entry) => (
            <Badge key={entry.status} tone="neutral">
              {entry.status}: {entry._count._all}
            </Badge>
          ))}
          {feedback.map((entry) => (
            <Badge key={entry.value} tone="neutral">
              {entry.value}: {entry._count._all}
            </Badge>
          ))}
        </div>
      </Card>
      <Card className="mt-6 overflow-x-auto">
        <h2 className="font-display text-xl font-black">Recent jobs</h2>
        <table className="mt-4 w-full min-w-[680px] text-left text-sm">
          <thead className="text-text-muted">
            <tr>
              <th className="pb-2">Artifact</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Model / prompt</th>
              <th className="pb-2">Failure</th>
              <th className="pb-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((artifact) => (
              <tr key={artifact.id} className="border-border-subtle border-t">
                <td className="py-3 font-mono text-xs">
                  {artifact.id.slice(0, 8)} · {artifact.entityId.slice(0, 8)}
                </td>
                <td className="py-3">{artifact.status}</td>
                <td className="py-3">
                  {artifact.model ?? "—"} / {artifact.promptVersion}
                </td>
                <td className="py-3">{artifact.errorCode ?? "—"}</td>
                <td className="py-3">
                  <LocalDateTime value={artifact.updatedAt.toISOString()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-text-muted text-xs font-bold tracking-wide uppercase">
        {label}
      </p>
      <p className="font-display mt-1 text-2xl font-black">{value}</p>
    </Card>
  );
}

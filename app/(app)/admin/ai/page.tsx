import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge, Card } from "@/components/ui/foundations";
import { LocalDateTime } from "@/components/ui/local-date-time";
import { getAiConfig } from "@/lib/ai/config";
import {
  buildPromptComparison,
  buildPromptVersionHistory,
  formatPromptArtifactLabel,
} from "@/lib/ai/prompt-history";
import { GAME_RECAP_PROMPT_VERSION } from "@/lib/ai/prompts/game-recap-v1";
import { db } from "@/lib/db/client";
import { AiArtifactType } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ left?: string; right?: string }>;

const artifactSelect = {
  id: true,
  entityId: true,
  status: true,
  promptVersion: true,
  generatedAt: true,
  updatedAt: true,
  model: true,
  inputTokens: true,
  outputTokens: true,
  cachedTokens: true,
  latencyMs: true,
  errorCode: true,
  errorMessage: true,
  content: true,
  sourceManifest: true,
} as const;

export default async function AiOperationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?callbackUrl=/admin/ai");
  const operator = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (operator?.role !== "ADMIN") redirect("/arena");
  const params = await searchParams;

  const config = getAiConfig();
  if (!config.gameRecapsEnabled) {
    return (
      <div className="page-container py-10">
        <PageHeading
          eyebrow="Admin · AI operations"
          title="SIDELINE AI"
          description="AI recap display and generation are dark. No AI artifact tables are queried in this rollout state."
        />
        <Card>
          <Badge tone="warning">AI disabled</Badge>
          <p className="text-text-secondary mt-3 text-sm">
            Enable the recap display flag only after the additive migration is
            verified in this environment. Non-AI SIDELINE features remain
            unaffected.
          </p>
        </Card>
      </div>
    );
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [counts, usage, feedback, historyArtifacts, recent] = await Promise.all([
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
      where: { type: AiArtifactType.GAME_RECAP },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: artifactSelect,
    }),
    db.aiArtifact.findMany({
      where: { type: AiArtifactType.GAME_RECAP },
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
      select: artifactSelect,
    }),
  ]);
  const promptHistory = buildPromptVersionHistory(historyArtifacts);
  const comparisonCandidates = historyArtifacts;
  const selectedLeft =
    comparisonCandidates.find((artifact) => artifact.id === params.left) ??
    comparisonCandidates[0] ??
    null;
  const selectedRight =
    comparisonCandidates.find((artifact) => artifact.id === params.right) ??
    comparisonCandidates.find((artifact) => artifact.id !== selectedLeft?.id) ??
    null;
  const comparison =
    selectedLeft && selectedRight
      ? buildPromptComparison(selectedLeft, selectedRight)
      : null;
  return (
    <div className="page-container py-10">
      <PageHeading
        eyebrow="Admin · AI operations"
        title="SIDELINE AI"
        description="Sanitized generation health, prompt history, and feedback. Prompts, credentials, and private context are never shown."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={config.enabled ? "success" : "warning"}>
          AI {config.enabled ? "enabled" : "disabled"}
        </Badge>
        <Badge tone={config.gameRecapsEnabled ? "success" : "neutral"}>
          Game recaps {config.gameRecapsEnabled ? "enabled" : "disabled"}
        </Badge>
        <Badge tone="neutral">Model {config.summaryModel}</Badge>
        <Badge tone="neutral">Prompt {GAME_RECAP_PROMPT_VERSION}</Badge>
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-black">
              Prompt version history
            </h2>
            <p className="text-text-secondary mt-1 text-sm">
              Compare stored recap generations before promoting a new prompt to
              production.
            </p>
          </div>
          <Badge tone="neutral">Read-only history</Badge>
        </div>
        {promptHistory.length ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {promptHistory.map((entry) => (
              <article
                key={entry.promptVersion}
                className="border-border-subtle bg-surface rounded-2xl border p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold">{entry.promptVersion}</h3>
                  <Badge
                    tone={
                      entry.promptVersion === GAME_RECAP_PROMPT_VERSION
                        ? "live"
                        : "neutral"
                    }
                  >
                    {entry.promptVersion === GAME_RECAP_PROMPT_VERSION
                      ? "Current"
                      : "Historical"}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-sm">
                  <Stat label="Artifacts" value={entry.count} />
                  <Stat
                    label="Ready / failed"
                    value={`${entry.readyCount} / ${entry.failedCount}`}
                  />
                  <Stat
                    label="Avg latency"
                    value={
                      entry.avgLatencyMs === null
                        ? "—"
                        : `${Math.round(entry.avgLatencyMs)} ms`
                    }
                  />
                  <Stat label="Total tokens" value={entry.totalTokens} />
                  <Stat
                    label="Latest"
                    value={
                      entry.latestAt ? (
                        <LocalDateTime value={entry.latestAt.toISOString()} />
                      ) : (
                        "—"
                      )
                    }
                  />
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-text-secondary mt-4 text-sm">
            No stored recap artifacts are available yet.
          </p>
        )}
      </Card>
      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-black">
              Prompt comparison
            </h2>
            <p className="text-text-secondary mt-1 text-sm">
              Select two stored artifacts to compare headline, summary,
              grounding, source references, token count, and latency.
            </p>
          </div>
          <Badge tone="neutral">Artifact diff</Badge>
        </div>
        <form className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]" method="get">
          <label className="grid gap-1 text-sm font-semibold">
            Baseline artifact
            <select
              name="left"
              defaultValue={selectedLeft?.id ?? ""}
              className="border-border-subtle bg-surface text-text h-11 rounded-full border px-4 text-sm outline-none focus:border-brand-primary"
            >
              {comparisonCandidates.map((artifact) => (
                <option key={artifact.id} value={artifact.id}>
                  {formatPromptArtifactLabel(artifact)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Candidate artifact
            <select
              name="right"
              defaultValue={selectedRight?.id ?? ""}
              className="border-border-subtle bg-surface text-text h-11 rounded-full border px-4 text-sm outline-none focus:border-brand-primary"
            >
              {comparisonCandidates.map((artifact) => (
                <option key={artifact.id} value={artifact.id}>
                  {formatPromptArtifactLabel(artifact)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="bg-brand-primary text-brand-on-primary focus-ring self-end h-11 rounded-full px-5 text-sm font-bold"
          >
            Compare
          </button>
        </form>
        {comparison ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <ComparisonArtifactCard title="Baseline" artifact={comparison.left} />
            <ComparisonArtifactCard
              title="Candidate"
              artifact={comparison.right}
            />
            <div className="xl:col-span-2">
              <table className="w-full text-left text-sm">
                <thead className="text-text-muted">
                  <tr>
                    <th className="pb-2 pr-3">Field</th>
                    <th className="pb-2 pr-3">Baseline</th>
                    <th className="pb-2 pr-3">Candidate</th>
                    <th className="pb-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.label} className="border-border-subtle border-t">
                      <td className="py-3 pr-3 font-semibold">{row.label}</td>
                      <td className="text-text-secondary py-3 pr-3">
                        {row.left}
                      </td>
                      <td className="text-text-secondary py-3 pr-3">
                        {row.right}
                      </td>
                      <td className="py-3">
                        <Badge tone={row.delta === "No change" ? "neutral" : "live"}>
                          {row.delta}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-text-secondary mt-4 text-sm">
            Compare at least two stored artifacts to inspect prompt changes.
          </p>
        )}
      </Card>
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

function Stat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-border-subtle py-1.5 last:border-b-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

function ComparisonArtifactCard({
  title,
  artifact,
}: {
  title: string;
  artifact: {
    promptVersion: string;
    status: string;
    generatedAt: Date | null;
    headline: string;
    dek: string;
    summary: string;
    grounding: string;
    sourceCount: number;
    momentCount: number;
    fanThemeCount: number;
    caveatCount: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    latencyMs: number | null;
    errorCode: string | null;
    errorMessage: string | null;
  };
}) {
  return (
    <article className="border-border-subtle bg-surface-2 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        <Badge tone="neutral">{artifact.promptVersion}</Badge>
      </div>
      <p className="text-text-muted mt-2 text-xs uppercase">
        {artifact.status}
      </p>
      <div className="mt-3 grid gap-2 text-sm">
        <div>
          <p className="text-text-muted text-xs font-bold uppercase">Headline</p>
          <p className="font-semibold">{artifact.headline}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs font-bold uppercase">Dek</p>
          <p className="text-text-secondary">{artifact.dek}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs font-bold uppercase">Summary</p>
          <p className="text-text-secondary leading-6">{artifact.summary}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs font-bold uppercase">Grounding</p>
          <p className="text-text-secondary leading-6">{artifact.grounding}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Sources" value={artifact.sourceCount} />
          <MiniMetric label="Moments" value={artifact.momentCount} />
          <MiniMetric label="Themes" value={artifact.fanThemeCount} />
          <MiniMetric label="Caveats" value={artifact.caveatCount} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Input" value={artifact.inputTokens} />
          <MiniMetric label="Output" value={artifact.outputTokens} />
          <MiniMetric label="Cached" value={artifact.cachedTokens} />
          <MiniMetric
            label="Latency"
            value={artifact.latencyMs === null ? "—" : `${artifact.latencyMs} ms`}
          />
        </div>
        <div>
          <p className="text-text-muted text-xs font-bold uppercase">Errors</p>
          <p className="text-text-secondary">
            {artifact.errorCode ? `${artifact.errorCode} · ` : ""}
            {artifact.errorMessage ?? "—"}
          </p>
        </div>
        {artifact.generatedAt ? (
          <p className="text-text-muted text-xs">
            Generated <LocalDateTime value={artifact.generatedAt.toISOString()} />
          </p>
        ) : null}
      </div>
    </article>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="bg-surface rounded-xl px-3 py-2">
      <p className="text-text-muted text-[11px] font-bold uppercase">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

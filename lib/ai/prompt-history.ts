import type { AiArtifactStatus } from "@prisma/client";

type PromptHistoryArtifactSnapshot = {
  id: string;
  entityId: string;
  promptVersion: string;
  status: AiArtifactStatus | string;
  generatedAt: Date | null;
  updatedAt: Date;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  content: unknown;
  sourceManifest: unknown;
};

export type PromptVersionHistoryEntry = {
  promptVersion: string;
  count: number;
  latestAt: Date | null;
  latestArtifactId: string | null;
  avgLatencyMs: number | null;
  totalTokens: number;
  readyCount: number;
  failedCount: number;
};

export type PromptComparisonRow = {
  label: string;
  left: string;
  right: string;
  delta: string;
};

export type PromptArtifactSummary = {
  id: string;
  entityId: string;
  promptVersion: string;
  status: AiArtifactStatus | string;
  generatedAt: Date | null;
  updatedAt: Date;
  model: string | null;
  headline: string;
  dek: string;
  summary: string;
  grounding: string;
  momentCount: number;
  fanThemeCount: number;
  caveatCount: number;
  sourceCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  latencyMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function truncate(value: string, max = 120) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function describeDelta(left: string, right: string) {
  return left === right ? "No change" : "Changed";
}

function describeNumberDelta(left: number | null, right: number | null) {
  const safeLeft = left ?? 0;
  const safeRight = right ?? 0;
  const delta = safeRight - safeLeft;
  if (delta === 0) return "No change";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatCount(delta)}`;
}

function summarizeGrounding(content: unknown, sourceManifest: unknown) {
  const recap = isRecord(content) ? content : {};
  const keyMoments = Array.isArray(recap.keyMoments) ? recap.keyMoments : [];
  const fanConversation = isRecord(recap.fanConversation)
    ? recap.fanConversation
    : null;
  const themes = Array.isArray(fanConversation?.themes)
    ? fanConversation?.themes
    : [];
  const caveats = Array.isArray(recap.caveats) ? recap.caveats : [];
  const sources = Array.isArray(sourceManifest) ? sourceManifest : [];
  const counts = sources.reduce<Record<string, number>>((acc, entry) => {
    if (!isRecord(entry)) return acc;
    const type = asString(entry.type, "UNKNOWN");
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});
  const sourceSummary = Object.entries(counts)
    .map(([type, count]) => `${type} ${count}`)
    .join(", ");
  return truncate(
    [
      `${keyMoments.length} moments`,
      themes.length ? `${themes.length} fan themes` : "no fan themes",
      caveats.length ? `${caveats.length} caveats` : "no caveats",
      sources.length ? `${sources.length} sources` : "no sources",
      sourceSummary ? `(${sourceSummary})` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    180,
  );
}

export function summarizePromptArtifact(
  artifact: PromptHistoryArtifactSnapshot,
): PromptArtifactSummary {
  const content = isRecord(artifact.content) ? artifact.content : {};
  const fanConversation = isRecord(content.fanConversation)
    ? content.fanConversation
    : null;
  const keyMoments = Array.isArray(content.keyMoments) ? content.keyMoments : [];
  const caveats = Array.isArray(content.caveats) ? content.caveats : [];
  const sources = Array.isArray(artifact.sourceManifest)
    ? artifact.sourceManifest
    : [];
  const inputTokens = asNumber(artifact.inputTokens);
  const outputTokens = asNumber(artifact.outputTokens);
  const cachedTokens = asNumber(artifact.cachedTokens);
  return {
    id: artifact.id,
    entityId: artifact.entityId,
    promptVersion: artifact.promptVersion,
    status: artifact.status,
    generatedAt: artifact.generatedAt,
    updatedAt: artifact.updatedAt,
    model: artifact.model,
    headline: truncate(asString(content.headline)),
    dek: truncate(asString(content.dek), 180),
    summary: truncate(asString(content.summary), 300),
    grounding: summarizeGrounding(artifact.content, artifact.sourceManifest),
    momentCount: keyMoments.length,
    fanThemeCount: Array.isArray(fanConversation?.themes)
      ? fanConversation.themes.length
      : 0,
    caveatCount: caveats.length,
    sourceCount: sources.length,
    inputTokens,
    outputTokens,
    cachedTokens,
    latencyMs: artifact.latencyMs,
    errorCode: artifact.errorCode,
    errorMessage: artifact.errorMessage,
  };
}

export function buildPromptVersionHistory(
  artifacts: PromptHistoryArtifactSnapshot[],
): PromptVersionHistoryEntry[] {
  const groups = new Map<
    string,
    {
      count: number;
      latestAt: Date | null;
      latestArtifactId: string | null;
      latencyTotal: number;
      latencyCount: number;
      tokenTotal: number;
      readyCount: number;
      failedCount: number;
    }
  >();
  for (const artifact of artifacts) {
    const group =
      groups.get(artifact.promptVersion) ??
      {
        count: 0,
        latestAt: null,
        latestArtifactId: null,
        latencyTotal: 0,
        latencyCount: 0,
        tokenTotal: 0,
        readyCount: 0,
        failedCount: 0,
      };
    const generatedAt = artifact.generatedAt ?? artifact.updatedAt;
    group.count += 1;
    group.tokenTotal +=
      asNumber(artifact.inputTokens) +
      asNumber(artifact.outputTokens) +
      asNumber(artifact.cachedTokens);
    if (artifact.latencyMs !== null) {
      group.latencyTotal += artifact.latencyMs;
      group.latencyCount += 1;
    }
    if (artifact.status === "READY") group.readyCount += 1;
    if (artifact.status === "FAILED") group.failedCount += 1;
    if (!group.latestAt || generatedAt > group.latestAt) {
      group.latestAt = generatedAt;
      group.latestArtifactId = artifact.id;
    }
    groups.set(artifact.promptVersion, group);
  }
  return [...groups.entries()]
    .map(([promptVersion, group]) => ({
      promptVersion,
      count: group.count,
      latestAt: group.latestAt,
      latestArtifactId: group.latestArtifactId,
      avgLatencyMs:
        group.latencyCount > 0 ? group.latencyTotal / group.latencyCount : null,
      totalTokens: group.tokenTotal,
      readyCount: group.readyCount,
      failedCount: group.failedCount,
    }))
    .sort((left, right) => {
      const leftAt = left.latestAt?.getTime() ?? 0;
      const rightAt = right.latestAt?.getTime() ?? 0;
      if (leftAt !== rightAt) return rightAt - leftAt;
      return left.promptVersion.localeCompare(right.promptVersion);
    });
}

export function buildPromptComparison(
  left: PromptHistoryArtifactSnapshot,
  right: PromptHistoryArtifactSnapshot,
) {
  const leftSummary = summarizePromptArtifact(left);
  const rightSummary = summarizePromptArtifact(right);
  return {
    left: leftSummary,
    right: rightSummary,
    rows: [
      {
        label: "Headline",
        left: leftSummary.headline,
        right: rightSummary.headline,
        delta: describeDelta(leftSummary.headline, rightSummary.headline),
      },
      {
        label: "Dek",
        left: leftSummary.dek,
        right: rightSummary.dek,
        delta: describeDelta(leftSummary.dek, rightSummary.dek),
      },
      {
        label: "Summary",
        left: leftSummary.summary,
        right: rightSummary.summary,
        delta: describeDelta(leftSummary.summary, rightSummary.summary),
      },
      {
        label: "Grounding",
        left: leftSummary.grounding,
        right: rightSummary.grounding,
        delta: describeDelta(leftSummary.grounding, rightSummary.grounding),
      },
      {
        label: "Token count",
        left: formatCount(
          leftSummary.inputTokens +
            leftSummary.outputTokens +
            leftSummary.cachedTokens,
        ),
        right: formatCount(
          rightSummary.inputTokens +
            rightSummary.outputTokens +
            rightSummary.cachedTokens,
        ),
        delta: describeNumberDelta(
          leftSummary.inputTokens +
            leftSummary.outputTokens +
            leftSummary.cachedTokens,
          rightSummary.inputTokens +
            rightSummary.outputTokens +
            rightSummary.cachedTokens,
        ),
      },
      {
        label: "Latency",
        left:
          leftSummary.latencyMs === null
            ? "—"
            : `${formatCount(leftSummary.latencyMs)} ms`,
        right:
          rightSummary.latencyMs === null
            ? "—"
            : `${formatCount(rightSummary.latencyMs)} ms`,
        delta: describeNumberDelta(
          leftSummary.latencyMs,
          rightSummary.latencyMs,
        ),
      },
      {
        label: "Source refs",
        left: formatCount(leftSummary.sourceCount),
        right: formatCount(rightSummary.sourceCount),
        delta: describeNumberDelta(leftSummary.sourceCount, rightSummary.sourceCount),
      },
      {
        label: "Key moments",
        left: formatCount(leftSummary.momentCount),
        right: formatCount(rightSummary.momentCount),
        delta: describeNumberDelta(leftSummary.momentCount, rightSummary.momentCount),
      },
    ],
  };
}

export function formatPromptArtifactLabel(
  artifact: PromptHistoryArtifactSnapshot,
) {
  const parts = [
    artifact.promptVersion,
    artifact.status,
    artifact.generatedAt?.toISOString() ?? artifact.updatedAt.toISOString(),
    artifact.entityId.slice(0, 8),
  ];
  return parts.join(" · ");
}

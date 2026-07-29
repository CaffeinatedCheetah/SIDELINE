type MetricName =
  | "provider_request"
  | "cache_hit"
  | "cache_miss"
  | "normalization_failure"
  | "materialization_failure"
  | "duplicate_prevented"
  | "contest_synchronized"
  | "lifecycle_refresh"
  | "moment_synchronized"
  | "moment_materialization_failure"
  | "stale_contest";

interface Metric {
  count: number;
  totalDurationMs: number;
  lastRecordedAt: string;
}

const metrics = new Map<string, Metric>();

export function recordSportsMetric(
  name: MetricName,
  {
    durationMs = 0,
    league = "all",
    count = 1,
    metadata,
  }: {
    durationMs?: number;
    league?: string;
    count?: number;
    metadata?: Record<string, string | number | boolean | undefined>;
  } = {},
) {
  const key = `${name}:${league}`;
  const current = metrics.get(key) ?? {
    count: 0,
    totalDurationMs: 0,
    lastRecordedAt: new Date(0).toISOString(),
  };
  const next = {
    count: current.count + count,
    totalDurationMs: current.totalDurationMs + durationMs,
    lastRecordedAt: new Date().toISOString(),
  };
  metrics.set(key, next);
  if (process.env.NODE_ENV !== "test") {
    console.info(
      JSON.stringify({
        event: `sports.${name}`,
        league,
        durationMs,
        count,
        ...metadata,
      }),
    );
  }
}

export function getSportsMetrics() {
  return [...metrics.entries()].map(([key, value]) => ({
    key,
    ...value,
    averageDurationMs: value.count
      ? Math.round(value.totalDurationMs / value.count)
      : 0,
  }));
}

export function resetSportsMetricsForTests() {
  metrics.clear();
}

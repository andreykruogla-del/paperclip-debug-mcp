import type { Incident, IncidentSeverity } from "./types.js";

type TrendBucket = {
  startTs: number;
  endTs: number;
  total: number;
  bySeverity: Record<IncidentSeverity, number>;
  bySource: Record<string, number>;
};

export type IncidentTrendResult = {
  fromTs: number;
  toTs: number;
  bucketMinutes: number;
  buckets: TrendBucket[];
  totals: {
    incidents: number;
    bySeverity: Record<IncidentSeverity, number>;
    bySource: Record<string, number>;
  };
};

function emptySeverityMap(): Record<IncidentSeverity, number> {
  return {
    info: 0,
    warning: 0,
    error: 0,
    critical: 0
  };
}

function ensureBucket(map: Map<number, TrendBucket>, startTs: number, bucketMinutes: number): TrendBucket {
  const existing = map.get(startTs);
  if (existing) return existing;
  const bucket: TrendBucket = {
    startTs,
    endTs: startTs + bucketMinutes * 60_000,
    total: 0,
    bySeverity: emptySeverityMap(),
    bySource: {}
  };
  map.set(startTs, bucket);
  return bucket;
}

export function buildIncidentTrends(
  incidents: Incident[],
  options?: { windowHours?: number; bucketMinutes?: number; nowTs?: number }
): IncidentTrendResult {
  const windowHours = Math.min(Math.max(options?.windowHours ?? 24, 1), 24 * 14);
  const bucketMinutes = Math.min(Math.max(options?.bucketMinutes ?? 60, 5), 24 * 60);
  const nowTs = options?.nowTs ?? Date.now();
  const fromTs = nowTs - windowHours * 60 * 60_000;

  const bucketMap = new Map<number, TrendBucket>();
  const totals = {
    incidents: 0,
    bySeverity: emptySeverityMap(),
    bySource: {} as Record<string, number>
  };

  for (const incident of incidents) {
    if (incident.timestamp < fromTs || incident.timestamp > nowTs) continue;
    const bucketStart = Math.floor(incident.timestamp / (bucketMinutes * 60_000)) * bucketMinutes * 60_000;
    const bucket = ensureBucket(bucketMap, bucketStart, bucketMinutes);
    bucket.total += 1;
    bucket.bySeverity[incident.severity] += 1;
    bucket.bySource[incident.source] = (bucket.bySource[incident.source] ?? 0) + 1;

    totals.incidents += 1;
    totals.bySeverity[incident.severity] += 1;
    totals.bySource[incident.source] = (totals.bySource[incident.source] ?? 0) + 1;
  }

  const buckets = [...bucketMap.values()].sort((a, b) => a.startTs - b.startTs);
  return {
    fromTs,
    toTs: nowTs,
    bucketMinutes,
    buckets,
    totals
  };
}

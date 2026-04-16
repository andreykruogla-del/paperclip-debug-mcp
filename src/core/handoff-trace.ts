import type { Incident, IncidentSeverity } from "./types.js";

export type HandoffStep = {
  timestamp: number;
  source: string;
  service: string;
  summary: string;
  severity: IncidentSeverity;
};

export type HandoffTrace = {
  runId: string;
  latestTimestamp: number;
  highestSeverity: IncidentSeverity;
  steps: HandoffStep[];
};

const severityRank: Record<IncidentSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3
};

function maxSeverity(values: IncidentSeverity[]): IncidentSeverity {
  if (values.length === 0) return "info";
  return values.sort((a, b) => severityRank[b] - severityRank[a])[0];
}

export function buildHandoffTraces(incidents: Incident[]): HandoffTrace[] {
  const grouped = new Map<string, Incident[]>();

  for (const incident of incidents) {
    if (!incident.relatedRunId) continue;
    const bucket = grouped.get(incident.relatedRunId) ?? [];
    bucket.push(incident);
    grouped.set(incident.relatedRunId, bucket);
  }

  return [...grouped.entries()]
    .map(([runId, bucket]) => {
      const steps = bucket
        .map((incident) => ({
          timestamp: incident.timestamp,
          source: incident.source,
          service: incident.service,
          summary: incident.summary,
          severity: incident.severity
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      return {
        runId,
        latestTimestamp: Math.max(...steps.map((step) => step.timestamp)),
        highestSeverity: maxSeverity(steps.map((step) => step.severity)),
        steps
      };
    })
    .sort((a, b) => b.latestTimestamp - a.latestTimestamp);
}

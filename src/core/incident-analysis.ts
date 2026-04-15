import { createHash } from "node:crypto";
import type { Incident } from "./types.js";

function normalizeText(value: string | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function computeFingerprint(incident: Incident): string {
  const base = [
    normalizeText(incident.runtime),
    normalizeText(incident.source),
    normalizeText(incident.service),
    normalizeText(incident.summary),
    normalizeText(incident.probableCause)
  ].join("|");
  return createHash("sha1").update(base).digest("hex");
}

export type IncidentCluster = {
  fingerprint: string;
  count: number;
  latestTimestamp: number;
  service: string;
  summary: string;
  probableCause?: string;
};

export function clusterIncidents(incidents: Incident[]): IncidentCluster[] {
  const grouped = new Map<string, Incident[]>();
  for (const incident of incidents) {
    const key = incident.fingerprint ?? computeFingerprint(incident);
    const bucket = grouped.get(key) ?? [];
    bucket.push(incident);
    grouped.set(key, bucket);
  }

  return [...grouped.entries()]
    .map(([fingerprint, bucket]) => {
      const latest = bucket.sort((a, b) => b.timestamp - a.timestamp)[0];
      return {
        fingerprint,
        count: bucket.length,
        latestTimestamp: latest.timestamp,
        service: latest.service,
        summary: latest.summary,
        probableCause: latest.probableCause
      };
    })
    .sort((a, b) => b.count - a.count || b.latestTimestamp - a.latestTimestamp);
}

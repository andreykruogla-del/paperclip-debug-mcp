import type { Incident, IncidentSeverity } from "./types.js";

export type PrioritizedIncident = Incident & {
  priorityScore: number;
  priorityBand: "low" | "medium" | "high" | "critical";
  reasons: string[];
};

const severityWeight: Record<IncidentSeverity, number> = {
  info: 1,
  warning: 3,
  error: 6,
  critical: 10
};

function inferBand(score: number): PrioritizedIncident["priorityBand"] {
  if (score >= 12) return "critical";
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function staleMinutes(now: number, timestamp: number): number {
  return Math.max(0, Math.floor((now - timestamp) / (1000 * 60)));
}

export function prioritizeIncident(incident: Incident, now = Date.now()): PrioritizedIncident {
  let score = severityWeight[incident.severity];
  const reasons: string[] = [`severity:${incident.severity}`];

  if (incident.relatedRunId) {
    score += 2;
    reasons.push("has_related_run");
  }

  if (incident.probableCause) {
    const cause = incident.probableCause.toLowerCase();
    if (cause.includes("authorization") || cause.includes("credential")) {
      score += 2;
      reasons.push("auth_related");
    }
    if (cause.includes("rate limit")) {
      score += 1;
      reasons.push("rate_limit");
    }
    if (cause.includes("upstream")) {
      score += 1;
      reasons.push("upstream_instability");
    }
  }

  const ageMin = staleMinutes(now, incident.timestamp);
  if (ageMin <= 15) {
    score += 2;
    reasons.push("fresh_incident");
  } else if (ageMin <= 60) {
    score += 1;
    reasons.push("recent_incident");
  } else if (ageMin > 360) {
    score -= 1;
    reasons.push("stale_incident");
  }

  return {
    ...incident,
    priorityScore: Math.max(1, score),
    priorityBand: inferBand(score),
    reasons
  };
}

export function prioritizeIncidents(incidents: Incident[], limit?: number): PrioritizedIncident[] {
  const prioritized = incidents
    .map((incident) => prioritizeIncident(incident))
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        b.timestamp - a.timestamp ||
        a.id.localeCompare(b.id)
    );

  return typeof limit === "number" ? prioritized.slice(0, limit) : prioritized;
}

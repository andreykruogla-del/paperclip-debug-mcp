type PriorityBand = "low" | "medium" | "high" | "critical";

type PrioritizedIncidentLike = {
  service: string;
  relatedRunId?: string;
  priorityBand: PriorityBand;
};

type DockerServiceLike = {
  id: string;
  name: string;
  problematic: boolean;
};

type CollectorStatusLike = {
  lastError?: string;
};

type IncidentPacketLike = {
  issue?: { issueId?: string; relatedRunId?: string };
  comments?: unknown[];
  run?: { runId?: string };
  runEvents?: unknown[];
  relatedIncidents: unknown[];
  clusters: unknown[];
};

export type TriageSignal = {
  signal: string;
  reason: string;
  value?: number | string;
};

function uniqueTools(tools: string[]): string[] {
  return [...new Set(tools)];
}

function topServicesFromIncidents(
  incidents: Array<{ service: string }>,
  limit = 2
): string[] {
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    const key = incident.service || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([service]) => service);
}

function topProblematicServices(
  services: DockerServiceLike[],
  limit = 2
): string[] {
  return services
    .filter((service) => service.problematic)
    .slice(0, limit)
    .map((service) => service.name || service.id);
}

export function buildPrioritizeTriageGuidance(
  incidents: PrioritizedIncidentLike[],
  minBand?: PriorityBand
): {
  summary: {
    requestedMinBand: PriorityBand | null;
    returnedIncidents: number;
    byBand: Record<PriorityBand, number>;
    hasRunLinkedIncidents: boolean;
  };
  topSignals: TriageSignal[];
  recommendedNextTools: string[];
} {
  const byBand: Record<PriorityBand, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  for (const incident of incidents) {
    byBand[incident.priorityBand] += 1;
  }

  const runLinkedCount = incidents.filter((incident) => Boolean(incident.relatedRunId)).length;
  const dominantServices = topServicesFromIncidents(incidents, 2);

  const topSignals: TriageSignal[] = [];
  if (byBand.critical > 0) {
    topSignals.push({
      signal: "critical_incidents_present",
      reason: "Critical-priority incidents are in the returned set.",
      value: byBand.critical
    });
  }
  if (byBand.high > 0) {
    topSignals.push({
      signal: "high_priority_pressure",
      reason: "High-priority incidents indicate active operational risk.",
      value: byBand.high
    });
  }
  if (runLinkedCount > 0) {
    topSignals.push({
      signal: "run_linked_incidents_detected",
      reason: "Some incidents are linked to runs and support run-level drilldown.",
      value: runLinkedCount
    });
  }
  if (dominantServices.length > 0) {
    topSignals.push({
      signal: "dominant_services",
      reason: "Returned incidents are concentrated in specific services.",
      value: dominantServices.join(", ")
    });
  }
  if (incidents.length === 0) {
    topSignals.push({
      signal: "no_incidents_after_filter",
      reason: "No incidents matched the current prioritization filter."
    });
  }

  const recommendedNextTools = uniqueTools(
    incidents.length === 0
      ? [
          "paperclipDebug.refresh_collectors",
          "paperclipDebug.system_snapshot",
          "paperclipDebug.list_collectors"
        ]
      : [
          "paperclipDebug.list_incident_clusters",
          "paperclipDebug.incident_trends",
          ...(byBand.critical > 0 || byBand.high > 0
            ? ["paperclipDebug.list_services", "paperclipDebug.get_service_logs"]
            : []),
          ...(runLinkedCount > 0
            ? ["paperclipDebug.trace_handoff", "paperclipDebug.get_run_events"]
            : []),
          "paperclipDebug.build_incident_packet"
        ]
  ).slice(0, 6);

  return {
    summary: {
      requestedMinBand: minBand ?? null,
      returnedIncidents: incidents.length,
      byBand,
      hasRunLinkedIncidents: runLinkedCount > 0
    },
    topSignals: topSignals.slice(0, 5),
    recommendedNextTools
  };
}

export function buildSystemSnapshotTriageGuidance(params: {
  collectors: CollectorStatusLike[];
  summary: {
    incidents: number;
    criticalOrHigh: number;
    services: number;
    problematicServices: number;
    runs: number;
    issues: number;
  };
  topIncidents: PrioritizedIncidentLike[];
  services: DockerServiceLike[];
  paperclipError?: string;
}): {
  topSignals: TriageSignal[];
  recommendedNextTools: string[];
} {
  const failingCollectors = params.collectors.filter((collector) => Boolean(collector.lastError));
  const problematicServiceNames = topProblematicServices(params.services, 2);
  const hasRunLinkedTopIncident = params.topIncidents.some((incident) => Boolean(incident.relatedRunId));

  const topSignals: TriageSignal[] = [];
  if (params.summary.criticalOrHigh > 0) {
    topSignals.push({
      signal: "critical_or_high_incidents_present",
      reason: "Snapshot contains high-risk incidents requiring immediate triage.",
      value: params.summary.criticalOrHigh
    });
  }
  if (params.summary.problematicServices > 0) {
    topSignals.push({
      signal: "problematic_services_detected",
      reason: "Docker service snapshot reports problematic containers/services.",
      value: problematicServiceNames.join(", ") || params.summary.problematicServices
    });
  }
  if (failingCollectors.length > 0) {
    topSignals.push({
      signal: "collector_failures_detected",
      reason: "Some collectors failed in the latest refresh cycle.",
      value: failingCollectors.length
    });
  }
  if (params.paperclipError) {
    topSignals.push({
      signal: "paperclip_api_unavailable_or_misconfigured",
      reason: "Paperclip-backed data could not be fully loaded.",
      value: params.paperclipError
    });
  }
  if (topSignals.length === 0) {
    topSignals.push({
      signal: "no_immediate_hotspot_detected",
      reason: "Snapshot does not currently show a dominant high-risk signal."
    });
  }

  const recommendedNextTools = uniqueTools([
    "paperclipDebug.prioritize_incidents",
    "paperclipDebug.list_incident_clusters",
    "paperclipDebug.incident_trends",
    ...(params.summary.problematicServices > 0
      ? ["paperclipDebug.list_services", "paperclipDebug.get_service_logs"]
      : []),
    ...(hasRunLinkedTopIncident
      ? ["paperclipDebug.trace_handoff", "paperclipDebug.get_run_events"]
      : []),
    ...(params.summary.issues > 0
      ? ["paperclipDebug.list_issues", "paperclipDebug.get_issue_comments"]
      : []),
    ...(params.paperclipError || failingCollectors.length > 0
      ? [
          "paperclipDebug.get_runtime_config",
          "paperclipDebug.list_collectors",
          "paperclipDebug.refresh_collectors"
        ]
      : [])
  ]).slice(0, 7);

  return {
    topSignals: topSignals.slice(0, 5),
    recommendedNextTools
  };
}

export function buildIncidentPacketGuidance(params: {
  packet: IncidentPacketLike;
}): {
  topSignals: TriageSignal[];
  recommendedNextTools: string[];
  packetReadiness: {
    state: "minimal" | "partial" | "ready";
    checks: {
      hasIssueContext: boolean;
      hasRunContext: boolean;
      hasComments: boolean;
      hasRunEvents: boolean;
      hasRelatedIncidents: boolean;
      hasClusters: boolean;
    };
  };
} {
  const hasIssueContext = Boolean(params.packet.issue?.issueId);
  const hasRunContext = Boolean(params.packet.run?.runId || params.packet.issue?.relatedRunId);
  const hasComments = (params.packet.comments?.length ?? 0) > 0;
  const hasRunEvents = (params.packet.runEvents?.length ?? 0) > 0;
  const hasRelatedIncidents = params.packet.relatedIncidents.length > 0;
  const hasClusters = params.packet.clusters.length > 0;

  const evidenceHits = [hasComments, hasRunEvents, hasRelatedIncidents, hasClusters].filter(Boolean)
    .length;
  const packetReadinessState: "minimal" | "partial" | "ready" =
    evidenceHits >= 3 ? "ready" : evidenceHits >= 1 ? "partial" : "minimal";

  const topSignals: TriageSignal[] = [];
  if (!hasIssueContext && !hasRunContext) {
    topSignals.push({
      signal: "missing_primary_context",
      reason: "Packet was built without a strong issue/run anchor."
    });
  }
  if (!hasComments && hasIssueContext) {
    topSignals.push({
      signal: "no_issue_comments",
      reason: "Issue context exists, but no comments were included."
    });
  }
  if (!hasRunEvents && hasRunContext) {
    topSignals.push({
      signal: "no_run_events",
      reason: "Run context exists, but no run events were included."
    });
  }
  if (!hasRelatedIncidents) {
    topSignals.push({
      signal: "no_related_incidents",
      reason: "No incidents were correlated to this packet context."
    });
  }
  if (hasRelatedIncidents) {
    topSignals.push({
      signal: "correlated_incidents_present",
      reason: "Packet includes incident evidence linked to the selected context.",
      value: params.packet.relatedIncidents.length
    });
  }
  if (hasClusters) {
    topSignals.push({
      signal: "incident_clusters_present",
      reason: "Packet includes clustered incident patterns for triage.",
      value: params.packet.clusters.length
    });
  }

  const recommendedNextTools = uniqueTools([
    ...(hasIssueContext && !hasComments ? ["paperclipDebug.get_issue_comments"] : []),
    ...(hasRunContext && !hasRunEvents ? ["paperclipDebug.get_run_events"] : []),
    ...(!hasIssueContext && !hasRunContext
      ? ["paperclipDebug.list_issues", "paperclipDebug.list_runs"]
      : []),
    ...(hasRelatedIncidents
      ? ["paperclipDebug.prioritize_incidents", "paperclipDebug.list_incident_clusters"]
      : ["paperclipDebug.refresh_collectors", "paperclipDebug.list_services"]),
    ...(hasRunContext ? ["paperclipDebug.trace_handoff"] : [])
  ]).slice(0, 7);

  return {
    topSignals: topSignals.slice(0, 6),
    recommendedNextTools,
    packetReadiness: {
      state: packetReadinessState,
      checks: {
        hasIssueContext,
        hasRunContext,
        hasComments,
        hasRunEvents,
        hasRelatedIncidents,
        hasClusters
      }
    }
  };
}


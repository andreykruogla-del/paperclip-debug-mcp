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

type RunEventLike = {
  timestamp: number;
  type: string;
  level?: string;
  error?: string;
  agentId?: string;
};

type HandoffStepLike = {
  service: string;
  severity: "info" | "warning" | "error" | "critical";
};

type HandoffTraceLike = {
  runId: string;
  latestTimestamp: number;
  highestSeverity: "info" | "warning" | "error" | "critical";
  steps: HandoffStepLike[];
};

type IssueLike = {
  issueId: string;
  status: string;
  priority?: string;
  assigneeAgentId?: string;
  assigneeAgentName?: string;
  relatedRunId?: string;
  updatedAt: number;
};

type IssueCommentLike = {
  commentId: string;
  issueId: string;
  body?: string;
  createdAt: number;
  authorId?: string;
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

function eventTypeBreakdown(events: RunEventLike[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = event.type || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function issueStatusBreakdown(issues: IssueLike[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    const key = issue.status || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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

export function buildRunEventsTriageGuidance(params: {
  runId: string;
  events: RunEventLike[];
}): {
  summary: {
    runId: string;
    returnedEvents: number;
    distinctEventTypes: number;
    distinctAgents: number;
    errorLikeEvents: number;
    firstTimestamp: number | null;
    lastTimestamp: number | null;
  };
  topSignals: TriageSignal[];
  recommendedNextTools: string[];
} {
  const eventTypeCounts = eventTypeBreakdown(params.events);
  const distinctAgents = new Set(
    params.events.map((event) => event.agentId).filter((agent): agent is string => Boolean(agent))
  ).size;
  const timestamps = params.events.map((event) => event.timestamp).sort((a, b) => a - b);

  const errorLikeEvents = params.events.filter((event) => {
    if (event.error) return true;
    const level = event.level?.toLowerCase();
    if (level === "error" || level === "critical") return true;
    const type = event.type.toLowerCase();
    return type.includes("error") || type.includes("fail");
  }).length;

  const topSignals: TriageSignal[] = [];
  if (params.events.length === 0) {
    topSignals.push({
      signal: "run_has_no_events",
      reason: "The run returned no events for the requested context."
    });
  }
  if (errorLikeEvents > 0) {
    topSignals.push({
      signal: "error_like_events_present",
      reason: "Run event stream contains error-like events.",
      value: errorLikeEvents
    });
  }
  if (distinctAgents > 1) {
    topSignals.push({
      signal: "multi_agent_activity",
      reason: "Run events include activity from multiple agents.",
      value: distinctAgents
    });
  }
  if (eventTypeCounts.length > 0) {
    topSignals.push({
      signal: "dominant_event_type",
      reason: "Most frequent event type can guide focused drilldown.",
      value: `${eventTypeCounts[0][0]} (${eventTypeCounts[0][1]})`
    });
  }

  const recommendedNextTools = uniqueTools(
    params.events.length === 0
      ? [
          "paperclipDebug.list_runs",
          "paperclipDebug.trace_handoff",
          "paperclipDebug.system_snapshot"
        ]
      : [
          "paperclipDebug.trace_handoff",
          "paperclipDebug.build_incident_packet",
          "paperclipDebug.prioritize_incidents",
          "paperclipDebug.list_incident_clusters",
          ...(errorLikeEvents > 0 ? ["paperclipDebug.get_service_logs"] : [])
        ]
  ).slice(0, 6);

  return {
    summary: {
      runId: params.runId,
      returnedEvents: params.events.length,
      distinctEventTypes: eventTypeCounts.length,
      distinctAgents,
      errorLikeEvents,
      firstTimestamp: timestamps.length > 0 ? timestamps[0] : null,
      lastTimestamp: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null
    },
    topSignals: topSignals.slice(0, 5),
    recommendedNextTools
  };
}

export function buildTraceHandoffTriageGuidance(params: {
  traces: HandoffTraceLike[];
  requestedRunId?: string;
}): {
  summary: {
    requestedRunId: string | null;
    returnedTraces: number;
    totalSteps: number;
    tracesWithCritical: number;
    maxStepsInTrace: number;
  };
  topSignals: TriageSignal[];
  recommendedNextTools: string[];
} {
  const totalSteps = params.traces.reduce((sum, trace) => sum + trace.steps.length, 0);
  const tracesWithCritical = params.traces.filter((trace) => trace.highestSeverity === "critical").length;
  const maxStepsInTrace = params.traces.reduce(
    (max, trace) => (trace.steps.length > max ? trace.steps.length : max),
    0
  );

  const topSignals: TriageSignal[] = [];
  if (params.traces.length === 0) {
    topSignals.push({
      signal: "no_handoff_traces",
      reason: "No run-linked incident handoff traces were found."
    });
  }
  if (tracesWithCritical > 0) {
    topSignals.push({
      signal: "critical_handoff_present",
      reason: "At least one trace includes critical severity signals.",
      value: tracesWithCritical
    });
  }
  if (maxStepsInTrace >= 5) {
    topSignals.push({
      signal: "long_handoff_chain_detected",
      reason: "A trace has many handoff steps and may need focused triage.",
      value: maxStepsInTrace
    });
  }
  if (params.traces.length > 0) {
    const firstTrace = params.traces[0];
    const distinctServices = new Set(firstTrace.steps.map((step) => step.service)).size;
    if (distinctServices > 1) {
      topSignals.push({
        signal: "cross_service_handoff",
        reason: "Top trace spans multiple services.",
        value: distinctServices
      });
    }
  }

  const recommendedNextTools = uniqueTools(
    params.traces.length === 0
      ? [
          "paperclipDebug.prioritize_incidents",
          "paperclipDebug.refresh_collectors",
          "paperclipDebug.system_snapshot"
        ]
      : [
          ...(params.requestedRunId ? ["paperclipDebug.get_run_events"] : ["paperclipDebug.list_runs"]),
          "paperclipDebug.build_incident_packet",
          "paperclipDebug.prioritize_incidents",
          "paperclipDebug.list_incident_clusters",
          ...(tracesWithCritical > 0 ? ["paperclipDebug.get_service_logs"] : [])
        ]
  ).slice(0, 6);

  return {
    summary: {
      requestedRunId: params.requestedRunId ?? null,
      returnedTraces: params.traces.length,
      totalSteps,
      tracesWithCritical,
      maxStepsInTrace
    },
    topSignals: topSignals.slice(0, 5),
    recommendedNextTools
  };
}

export function buildListIssuesTriageGuidance(params: {
  issues: IssueLike[];
  requestedStatus?: string;
}): {
  summary: {
    requestedStatus: string | null;
    returnedIssues: number;
    runLinkedIssues: number;
    assignedIssues: number;
    issuesWithPriorityTag: number;
    newestUpdatedAt: number | null;
    oldestUpdatedAt: number | null;
  };
  topSignals: TriageSignal[];
  recommendedNextTools: string[];
} {
  const runLinkedIssues = params.issues.filter((issue) => Boolean(issue.relatedRunId)).length;
  const assignedIssues = params.issues.filter(
    (issue) => Boolean(issue.assigneeAgentId) || Boolean(issue.assigneeAgentName)
  ).length;
  const issuesWithPriorityTag = params.issues.filter((issue) => Boolean(issue.priority)).length;
  const statusCounts = issueStatusBreakdown(params.issues);
  const timestamps = params.issues.map((issue) => issue.updatedAt).sort((a, b) => a - b);

  const topSignals: TriageSignal[] = [];
  if (params.issues.length === 0) {
    topSignals.push({
      signal: "no_issues_after_filter",
      reason: "No issues were returned for the requested issue filter."
    });
  }
  if (runLinkedIssues > 0) {
    topSignals.push({
      signal: "run_linked_issues_present",
      reason: "Some returned issues are linked to runs and support run-level drilldown.",
      value: runLinkedIssues
    });
  }
  if (params.issues.length > assignedIssues) {
    topSignals.push({
      signal: "unassigned_issues_present",
      reason: "Some returned issues do not have an assignee.",
      value: params.issues.length - assignedIssues
    });
  }
  if (statusCounts.length > 0) {
    topSignals.push({
      signal: "dominant_issue_status",
      reason: "Most frequent issue status in the returned set.",
      value: `${statusCounts[0][0]} (${statusCounts[0][1]})`
    });
  }

  const recommendedNextTools = uniqueTools(
    params.issues.length === 0
      ? [
          "paperclipDebug.system_snapshot",
          "paperclipDebug.list_runs",
          "paperclipDebug.refresh_collectors"
        ]
      : [
          "paperclipDebug.get_issue_comments",
          "paperclipDebug.build_incident_packet",
          "paperclipDebug.prioritize_incidents",
          "paperclipDebug.list_incident_clusters",
          ...(runLinkedIssues > 0 ? ["paperclipDebug.trace_handoff", "paperclipDebug.get_run_events"] : [])
        ]
  ).slice(0, 6);

  return {
    summary: {
      requestedStatus: params.requestedStatus ?? null,
      returnedIssues: params.issues.length,
      runLinkedIssues,
      assignedIssues,
      issuesWithPriorityTag,
      newestUpdatedAt: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null,
      oldestUpdatedAt: timestamps.length > 0 ? timestamps[0] : null
    },
    topSignals: topSignals.slice(0, 5),
    recommendedNextTools
  };
}

export function buildIssueCommentsTriageGuidance(params: {
  issueId: string;
  comments: IssueCommentLike[];
}): {
  summary: {
    issueId: string;
    returnedComments: number;
    uniqueAuthors: number;
    commentsWithBody: number;
    firstCommentAt: number | null;
    lastCommentAt: number | null;
  };
  topSignals: TriageSignal[];
  recommendedNextTools: string[];
} {
  const uniqueAuthors = new Set(
    params.comments.map((comment) => comment.authorId).filter((author): author is string => Boolean(author))
  ).size;
  const commentsWithBody = params.comments.filter((comment) => Boolean(comment.body)).length;
  const timestamps = params.comments.map((comment) => comment.createdAt).sort((a, b) => a - b);

  const topSignals: TriageSignal[] = [];
  if (params.comments.length === 0) {
    topSignals.push({
      signal: "no_issue_comments_found",
      reason: "No comments were returned for this issue."
    });
  }
  if (params.comments.length > 0) {
    topSignals.push({
      signal: "issue_thread_present",
      reason: "Issue has discussion history that can support packet handoff.",
      value: params.comments.length
    });
  }
  if (uniqueAuthors > 1) {
    topSignals.push({
      signal: "multi_author_thread",
      reason: "Comments come from multiple authors and may indicate cross-team handoff.",
      value: uniqueAuthors
    });
  }
  if (commentsWithBody < params.comments.length) {
    topSignals.push({
      signal: "comments_with_missing_body",
      reason: "Some comments have no body text after normalization/redaction.",
      value: params.comments.length - commentsWithBody
    });
  }

  const recommendedNextTools = uniqueTools(
    params.comments.length === 0
      ? [
          "paperclipDebug.list_issues",
          "paperclipDebug.build_incident_packet",
          "paperclipDebug.system_snapshot"
        ]
      : [
          "paperclipDebug.build_incident_packet",
          "paperclipDebug.prioritize_incidents",
          "paperclipDebug.list_incident_clusters",
          "paperclipDebug.trace_handoff",
          "paperclipDebug.get_run_events"
        ]
  ).slice(0, 6);

  return {
    summary: {
      issueId: params.issueId,
      returnedComments: params.comments.length,
      uniqueAuthors,
      commentsWithBody,
      firstCommentAt: timestamps.length > 0 ? timestamps[0] : null,
      lastCommentAt: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null
    },
    topSignals: topSignals.slice(0, 5),
    recommendedNextTools
  };
}


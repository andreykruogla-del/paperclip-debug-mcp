import { classifyPaperclipError, PaperclipApiClient, firstString, toTimestamp } from "./paperclip-client.js";
import { redactSensitiveText } from "../core/redaction.js";
import { getIssueComments, listIssues } from "./paperclip-issues.js";

export type PaperclipRunSummary = {
  runId: string;
  status: string;
  agentId?: string;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  eventCount?: number;
  sourcePath?: string;
};

export type PaperclipRunEvent = {
  id: string;
  runId: string;
  agentId?: string;
  timestamp: number;
  type: string;
  level?: string;
  message?: string;
  error?: string;
  tokens?: number;
  durationMs?: number;
  sourcePath?: string;
};

type RunShape = Record<string, unknown>;
type EventShape = Record<string, unknown>;
type RunsLookupOptions = {
  companyId?: string;
  projectId?: string;
};
type LinkedIssueRef = {
  issueId: string;
  title?: string;
  updatedAt?: number;
  assigneeAgentId?: string;
  assigneeAgentName?: string;
  priority?: string;
};

function pickRunId(run: RunShape): string | undefined {
  return (
    firstString(run.runId) ??
    firstString(run.id) ??
    firstString(run.run_id)
  );
}

function pickStatus(run: RunShape): string {
  return (
    firstString(run.status) ??
    firstString(run.state) ??
    "unknown"
  );
}

function pickTime(run: RunShape, keys: string[]): number {
  for (const key of keys) {
    const value = run[key];
    if (typeof value === "number") return toTimestamp(value);
    if (typeof value === "string") return toTimestamp(value);
  }
  return Date.now();
}

function pickError(run: RunShape): string | undefined {
  const direct = firstString(run.error) ?? firstString(run.lastError) ?? firstString(run.failureReason);
  if (direct) return direct;
  const result = run.result;
  if (result && typeof result === "object") {
    const rec = result as Record<string, unknown>;
    return firstString(rec.error) ?? firstString(rec.message);
  }
  return undefined;
}

function mapRun(run: RunShape, sourcePath: string): PaperclipRunSummary | null {
  const runId = pickRunId(run);
  if (!runId) return null;
  return {
    runId,
    status: pickStatus(run),
    agentId: firstString(run.agentId) ?? firstString(run.agent_id),
    startedAt: pickTime(run, ["startedAt", "started_at", "createdAt", "created_at", "timestamp"]),
    finishedAt: firstString(run.finishedAt) || typeof run.finishedAt === "number"
      ? pickTime(run, ["finishedAt", "finished_at"])
      : undefined,
    error: pickError(run),
    eventCount:
      typeof run.eventCount === "number"
        ? run.eventCount
        : typeof run.eventsCount === "number"
          ? run.eventsCount
          : undefined,
    sourcePath
  };
}

function mapEvent(runId: string, event: EventShape, sourcePath: string, idx: number): PaperclipRunEvent {
  const timestamp = toTimestamp(
    (event.timestamp as string | number | undefined) ??
      (event.createdAt as string | number | undefined) ??
      (event.time as string | number | undefined)
  );
  return {
    id:
      firstString(event.id) ??
      firstString(event.eventId) ??
      `${runId}-${timestamp}-${idx}`,
    runId,
    agentId: firstString(event.agentId) ?? firstString(event.agent_id),
    timestamp,
    type:
      firstString(event.normalizedType) ??
      firstString(event.type) ??
      firstString(event.eventType) ??
      "unknown",
    level: firstString(event.level),
    message: firstString(event.message) ?? firstString(event.summary),
    error: redactSensitiveText(firstString(event.error)),
    tokens:
      typeof event.tokens === "number"
        ? event.tokens
        : typeof event.tokenCount === "number"
          ? event.tokenCount
          : undefined,
    durationMs:
      typeof event.durationMs === "number"
        ? event.durationMs
        : typeof event.duration_ms === "number"
          ? event.duration_ms
          : undefined,
    sourcePath
  };
}

export async function listRuns(
  client: PaperclipApiClient,
  limit = 20,
  options?: RunsLookupOptions
): Promise<{ runs: PaperclipRunSummary[]; sourcePath: string }> {
  const companyId = firstString(options?.companyId);
  const endpoints = buildRunListEndpoints(limit, companyId);
  try {
    const { payload, path } = await client.getFirst(endpoints);
    const rows = client.extractArray<RunShape>(payload, ["runs", "items", "data", "results"]);
    const mapped = mapRuns(rows, path);
    if (mapped.length > 0 || !companyId) {
      return { runs: mapped, sourcePath: path };
    }
  } catch (error: unknown) {
    const normalized = classifyPaperclipError(error);
    if (normalized.category !== "endpoint_mismatch" || !companyId) {
      throw error;
    }
  }
  const fromAssociations = await listRunsFromIssueRunAssociations(
    client,
    limit,
    companyId,
    firstString(options?.projectId)
  );
  if (fromAssociations.runs.length > 0) {
    return fromAssociations;
  }
  return listRunsFromIssues(client, limit, companyId, firstString(options?.projectId));
}

export async function getRunEvents(
  client: PaperclipApiClient,
  runId: string,
  options?: RunsLookupOptions
): Promise<{ events: PaperclipRunEvent[]; sourcePath: string }> {
  const companyId = firstString(options?.companyId);
  const endpoints = buildRunEventEndpoints(runId, companyId);
  try {
    const { payload, path } = await client.getFirst(endpoints);
    const eventRows = client.extractArray<EventShape>(payload, ["events", "items", "data", "results"]);
    const events = eventRows
      .map((event, idx) => mapEvent(runId, event, path, idx))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (events.length > 0 || !companyId) {
      return { events, sourcePath: path };
    }
  } catch (error: unknown) {
    const normalized = classifyPaperclipError(error);
    if (normalized.category !== "endpoint_mismatch" || !companyId) {
      throw error;
    }
  }
  const fromAssociations = await getRunEventsFromIssueRunAssociations(
    client,
    runId,
    companyId,
    firstString(options?.projectId)
  );
  if (fromAssociations.events.length > 0) {
    return fromAssociations;
  }
  return getRunEventsFromIssues(client, runId, companyId, firstString(options?.projectId));
}

function buildRunListEndpoints(limit: number, companyId?: string): string[] {
  const endpoints = [
    `/api/heartbeat-runs?limit=${limit}`,
    `/api/heartbeat-runs?take=${limit}`,
    `/api/runs?limit=${limit}`,
    `/api/runs?take=${limit}`,
    `/api/run-logs?limit=${limit}`
  ];
  if (companyId) {
    const encodedCompanyId = encodeURIComponent(companyId);
    endpoints.push(
      `/api/companies/${encodedCompanyId}/heartbeat-runs?limit=${limit}`,
      `/api/companies/${encodedCompanyId}/heartbeat-runs?take=${limit}`,
      `/api/companies/${encodedCompanyId}/runs?limit=${limit}`,
      `/api/companies/${encodedCompanyId}/runs?take=${limit}`,
      `/api/companies/${encodedCompanyId}/run-logs?limit=${limit}`,
      `/api/companies/${encodedCompanyId}/run-logs?take=${limit}`
    );
  }
  return endpoints;
}

function buildRunEventEndpoints(runId: string, companyId?: string): string[] {
  const encodedRunId = encodeURIComponent(runId);
  const endpoints = [
    `/api/heartbeat-runs/${encodedRunId}/events`,
    `/api/heartbeat-runs/${encodedRunId}`,
    `/api/runs/${encodedRunId}/events`,
    `/api/run-logs/${encodedRunId}/events`,
    `/api/runs/${encodedRunId}`
  ];
  if (companyId) {
    const encodedCompanyId = encodeURIComponent(companyId);
    endpoints.push(
      `/api/companies/${encodedCompanyId}/heartbeat-runs/${encodedRunId}/events`,
      `/api/companies/${encodedCompanyId}/heartbeat-runs/${encodedRunId}`,
      `/api/companies/${encodedCompanyId}/runs/${encodedRunId}/events`,
      `/api/companies/${encodedCompanyId}/run-logs/${encodedRunId}/events`,
      `/api/companies/${encodedCompanyId}/runs/${encodedRunId}`
    );
  }
  return endpoints;
}

function mapRuns(rows: RunShape[], sourcePath: string): PaperclipRunSummary[] {
  return rows
    .map((row) => mapRun(row, sourcePath))
    .filter((row): row is PaperclipRunSummary => Boolean(row))
    .map((row) => ({
      ...row,
      error: redactSensitiveText(row.error)
    }))
    .sort((a, b) => b.startedAt - a.startedAt);
}

function mapLinkedIssueRef(issue: Record<string, unknown>): LinkedIssueRef | null {
  const issueId = firstString(issue.issueId) ?? firstString(issue.id);
  if (!issueId) return null;
  const assigneeAgent = issue.assigneeAgent && typeof issue.assigneeAgent === "object"
    ? (issue.assigneeAgent as Record<string, unknown>)
    : undefined;
  return {
    issueId,
    title: firstString(issue.title),
    updatedAt: toTimestamp(
      (issue.updatedAt as string | number | undefined) ??
        (issue.createdAt as string | number | undefined)
    ),
    assigneeAgentId: firstString(issue.assigneeAgentId),
    assigneeAgentName: firstString(assigneeAgent?.name),
    priority: firstString(issue.priority)
  };
}

async function fetchIssueRuns(
  client: PaperclipApiClient,
  issueId: string
): Promise<{ runs: RunShape[]; sourcePath: string }> {
  const path = `/api/issues/${encodeURIComponent(issueId)}/runs`;
  const payload = await client.get(path);
  return {
    runs: client.extractArray<RunShape>(payload, ["runs", "items", "data", "results"]),
    sourcePath: path
  };
}

async function listRunsFromIssueRunAssociations(
  client: PaperclipApiClient,
  limit: number,
  companyId: string,
  projectId?: string
): Promise<{ runs: PaperclipRunSummary[]; sourcePath: string }> {
  const issueLimit = Math.max(30, Math.min(200, limit * 5));
  const { issues, sourcePath } = await listIssues(client, companyId, projectId, issueLimit, undefined);
  const runById = new Map<string, PaperclipRunSummary>();
  let usedSourcePath = `${sourcePath}#derived_from_issue_runs_association`;
  let associationAvailable = false;

  for (const issue of issues) {
    try {
      const issueRunsResult = await fetchIssueRuns(client, issue.issueId);
      associationAvailable = true;
      usedSourcePath = `${issueRunsResult.sourcePath}#derived_from_issue_runs_association`;
      const mappedRuns = mapRuns(issueRunsResult.runs, issueRunsResult.sourcePath);
      for (const run of mappedRuns) {
        const existing = runById.get(run.runId);
        if (existing && existing.startedAt >= run.startedAt) {
          continue;
        }
        runById.set(run.runId, run);
      }
    } catch (error: unknown) {
      const normalized = classifyPaperclipError(error);
      if (normalized.category === "endpoint_mismatch") {
        break;
      }
      throw error;
    }
  }

  if (!associationAvailable) {
    return {
      runs: [],
      sourcePath: `${sourcePath}#issue_runs_association_unavailable`
    };
  }

  const runs = Array.from(runById.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit);
  return {
    runs,
    sourcePath: usedSourcePath
  };
}

async function listRunsFromIssues(
  client: PaperclipApiClient,
  limit: number,
  companyId: string,
  projectId?: string
): Promise<{ runs: PaperclipRunSummary[]; sourcePath: string }> {
  const issueLimit = Math.max(30, Math.min(200, limit * 5));
  const { issues, sourcePath } = await listIssues(client, companyId, projectId, issueLimit, undefined);
  const runById = new Map<string, PaperclipRunSummary>();

  for (const issue of issues) {
    const runId = firstString(issue.relatedRunId);
    if (!runId) continue;
    const existing = runById.get(runId);
    if (existing && existing.startedAt >= issue.updatedAt) {
      continue;
    }
    runById.set(runId, {
      runId,
      status: issue.status ?? "unknown",
      agentId: issue.assigneeAgentId ?? issue.assigneeAgentName,
      startedAt: issue.updatedAt,
      error: undefined,
      sourcePath: `${sourcePath}#derived_from_issues`
    });
  }

  const runs = Array.from(runById.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit);
  return {
    runs,
    sourcePath: `${sourcePath}#derived_from_issues`
  };
}

async function getRunEventsFromIssues(
  client: PaperclipApiClient,
  runId: string,
  companyId: string,
  projectId?: string
): Promise<{ events: PaperclipRunEvent[]; sourcePath: string }> {
  const { issues, sourcePath } = await listIssues(client, companyId, projectId, 200, undefined);
  const relatedIssues = issues.filter((issue) => issue.relatedRunId === runId);
  if (relatedIssues.length === 0) {
    return {
      events: [],
      sourcePath: `${sourcePath}#derived_from_issues`
    };
  }

  const events: PaperclipRunEvent[] = [];
  let primarySourcePath = `${sourcePath}#derived_from_issues`;

  for (const issue of relatedIssues) {
    events.push({
      id: `${issue.issueId}-issue-state`,
      runId,
      agentId: issue.assigneeAgentId ?? issue.assigneeAgentName,
      timestamp: issue.updatedAt,
      type: "issue_state",
      level: issue.priority,
      message: issue.title,
      sourcePath: `${sourcePath}#issue`
    });

    const commentsResult = await getIssueComments(client, issue.issueId);
    primarySourcePath = commentsResult.sourcePath;
    for (const comment of commentsResult.comments) {
      events.push({
        id: comment.commentId,
        runId,
        agentId: comment.authorId,
        timestamp: comment.createdAt,
        type: "issue_comment",
        message: comment.body,
        sourcePath: `${commentsResult.sourcePath}#derived_from_issue_comments`
      });
    }
  }

  events.sort((a, b) => a.timestamp - b.timestamp);
  return {
    events,
    sourcePath: `${primarySourcePath}#derived_from_issue_comments`
  };
}

async function resolveIssuesByRunAssociation(
  client: PaperclipApiClient,
  runId: string,
  companyId: string,
  projectId?: string
): Promise<{ issues: LinkedIssueRef[]; sourcePath: string }> {
  const encodedRunId = encodeURIComponent(runId);
  try {
    const path = `/api/heartbeat-runs/${encodedRunId}/issues`;
    const payload = await client.get(path);
    const rows = client.extractArray<Record<string, unknown>>(payload, ["issues", "items", "data", "results"]);
    const issues = rows
      .map((row) => mapLinkedIssueRef(row))
      .filter((row): row is LinkedIssueRef => Boolean(row));
    if (issues.length > 0) {
      return {
        issues,
        sourcePath: `${path}#derived_from_issue_runs_association`
      };
    }
  } catch (error: unknown) {
    const normalized = classifyPaperclipError(error);
    if (normalized.category !== "endpoint_mismatch") {
      throw error;
    }
  }

  const { issues, sourcePath } = await listIssues(client, companyId, projectId, 200, undefined);
  const linkedIssues: LinkedIssueRef[] = [];
  for (const issue of issues) {
    try {
      const issueRunsResult = await fetchIssueRuns(client, issue.issueId);
      const hasRun = issueRunsResult.runs.some((run) => pickRunId(run) === runId);
      if (!hasRun) continue;
      linkedIssues.push({
        issueId: issue.issueId,
        title: issue.title,
        updatedAt: issue.updatedAt,
        assigneeAgentId: issue.assigneeAgentId,
        assigneeAgentName: issue.assigneeAgentName,
        priority: issue.priority
      });
    } catch (error: unknown) {
      const normalized = classifyPaperclipError(error);
      if (normalized.category === "endpoint_mismatch") {
        break;
      }
      throw error;
    }
  }
  return {
    issues: linkedIssues,
    sourcePath: `${sourcePath}#derived_from_issue_runs_association`
  };
}

async function getRunEventsFromIssueRunAssociations(
  client: PaperclipApiClient,
  runId: string,
  companyId: string,
  projectId?: string
): Promise<{ events: PaperclipRunEvent[]; sourcePath: string }> {
  const relatedIssuesResult = await resolveIssuesByRunAssociation(client, runId, companyId, projectId);
  if (relatedIssuesResult.issues.length === 0) {
    return {
      events: [],
      sourcePath: relatedIssuesResult.sourcePath
    };
  }

  const events: PaperclipRunEvent[] = [];
  let primarySourcePath = relatedIssuesResult.sourcePath;
  for (const issue of relatedIssuesResult.issues) {
    events.push({
      id: `${issue.issueId}-issue-state`,
      runId,
      agentId: issue.assigneeAgentId ?? issue.assigneeAgentName,
      timestamp: issue.updatedAt ?? Date.now(),
      type: "issue_state",
      level: issue.priority,
      message: issue.title,
      sourcePath: `${relatedIssuesResult.sourcePath}#issue`
    });
    const commentsResult = await getIssueComments(client, issue.issueId);
    primarySourcePath = commentsResult.sourcePath;
    for (const comment of commentsResult.comments) {
      events.push({
        id: comment.commentId,
        runId,
        agentId: comment.authorId,
        timestamp: comment.createdAt,
        type: "issue_comment",
        message: comment.body,
        sourcePath: `${commentsResult.sourcePath}#derived_from_issue_comments`
      });
    }
  }

  events.sort((a, b) => a.timestamp - b.timestamp);
  return {
    events,
    sourcePath: `${primarySourcePath}#derived_from_issue_runs_association`
  };
}

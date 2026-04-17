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
  const endpoints = [
    `/api/runs?limit=${limit}`,
    `/api/runs?take=${limit}`,
    `/api/run-logs?limit=${limit}`
  ];
  if (companyId) {
    endpoints.push(
      `/api/companies/${encodeURIComponent(companyId)}/runs?limit=${limit}`,
      `/api/companies/${encodeURIComponent(companyId)}/runs?take=${limit}`,
      `/api/companies/${encodeURIComponent(companyId)}/run-logs?limit=${limit}`,
      `/api/companies/${encodeURIComponent(companyId)}/run-logs?take=${limit}`
    );
  }
  try {
    const { payload, path } = await client.getFirst(endpoints);
    const rows = client.extractArray<RunShape>(payload, ["runs", "items", "data", "results"]);
    const mapped = rows
      .map((row) => mapRun(row, path))
      .filter((row): row is PaperclipRunSummary => Boolean(row))
      .map((row) => ({
        ...row,
        error: redactSensitiveText(row.error)
      }))
      .sort((a, b) => b.startedAt - a.startedAt);
    return { runs: mapped, sourcePath: path };
  } catch (error: unknown) {
    const normalized = classifyPaperclipError(error);
    if (normalized.category !== "endpoint_mismatch" || !companyId) {
      throw error;
    }
    return listRunsFromIssues(client, limit, companyId, firstString(options?.projectId));
  }
}

export async function getRunEvents(
  client: PaperclipApiClient,
  runId: string,
  options?: RunsLookupOptions
): Promise<{ events: PaperclipRunEvent[]; sourcePath: string }> {
  const companyId = firstString(options?.companyId);
  const encoded = encodeURIComponent(runId);
  const endpoints = [
    `/api/runs/${encoded}/events`,
    `/api/run-logs/${encoded}/events`,
    `/api/runs/${encoded}`
  ];
  if (companyId) {
    endpoints.push(
      `/api/companies/${encodeURIComponent(companyId)}/runs/${encoded}/events`,
      `/api/companies/${encodeURIComponent(companyId)}/run-logs/${encoded}/events`,
      `/api/companies/${encodeURIComponent(companyId)}/runs/${encoded}`
    );
  }
  try {
    const { payload, path } = await client.getFirst(endpoints);
    const eventRows = client.extractArray<EventShape>(payload, ["events", "items", "data", "results"]);
    const events = eventRows
      .map((event, idx) => mapEvent(runId, event, path, idx))
      .sort((a, b) => a.timestamp - b.timestamp);
    return { events, sourcePath: path };
  } catch (error: unknown) {
    const normalized = classifyPaperclipError(error);
    if (normalized.category !== "endpoint_mismatch" || !companyId) {
      throw error;
    }
    return getRunEventsFromIssues(client, runId, companyId, firstString(options?.projectId));
  }
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

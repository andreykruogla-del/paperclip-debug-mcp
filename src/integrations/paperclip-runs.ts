import { PaperclipApiClient, firstString, toTimestamp } from "./paperclip-client.js";

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
    error: firstString(event.error),
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
  limit = 20
): Promise<{ runs: PaperclipRunSummary[]; sourcePath: string }> {
  const endpoints = [
    `/api/runs?limit=${limit}`,
    `/api/runs?take=${limit}`,
    `/api/run-logs?limit=${limit}`
  ];
  const { payload, path } = await client.getFirst(endpoints);
  const rows = client.extractArray<RunShape>(payload, ["runs", "items", "data", "results"]);
  const mapped = rows
    .map((row) => mapRun(row, path))
    .filter((row): row is PaperclipRunSummary => Boolean(row))
    .sort((a, b) => b.startedAt - a.startedAt);
  return { runs: mapped, sourcePath: path };
}

export async function getRunEvents(
  client: PaperclipApiClient,
  runId: string
): Promise<{ events: PaperclipRunEvent[]; sourcePath: string }> {
  const encoded = encodeURIComponent(runId);
  const endpoints = [
    `/api/runs/${encoded}/events`,
    `/api/run-logs/${encoded}/events`,
    `/api/runs/${encoded}`
  ];
  const { payload, path } = await client.getFirst(endpoints);
  const eventRows = client.extractArray<EventShape>(payload, ["events", "items", "data", "results"]);

  const events = eventRows
    .map((event, idx) => mapEvent(runId, event, path, idx))
    .sort((a, b) => a.timestamp - b.timestamp);

  return { events, sourcePath: path };
}

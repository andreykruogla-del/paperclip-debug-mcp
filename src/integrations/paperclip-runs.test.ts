import { afterEach, describe, expect, it, vi } from "vitest";

import { PaperclipApiClient } from "./paperclip-client.js";
import { getRunEvents, listRuns } from "./paperclip-runs.js";

const COMPANY_ID = "4cb18376-e911-41f4-a531-ba33c940265f";

function createClient(): PaperclipApiClient {
  return new PaperclipApiClient({
    baseUrl: "https://paperclip.example.com",
    token: "token"
  });
}

describe("paperclip-runs source selection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses heartbeat run routes as primary list source", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
      const pathWithQuery = `${url.pathname}${url.search}`;
      if (pathWithQuery.startsWith("/api/heartbeat-runs")) {
        return new Response(
          JSON.stringify({
            runs: [
              {
                id: "run-native-1",
                status: "succeeded",
                startedAt: "2026-04-10T10:00:00.000Z"
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("unexpected path", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await listRuns(createClient(), 5, { companyId: COMPANY_ID });

    expect(result.sourcePath).toContain("/api/heartbeat-runs");
    expect(result.runs.map((run) => run.runId)).toEqual(["run-native-1"]);
    expect(
      fetchSpy.mock.calls.some((call) =>
        String(call[0]).includes(`/api/companies/${COMPANY_ID}/issues`)
      )
    ).toBe(false);
  });

  it("uses issue-to-runs association before issue-derived fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
        const pathWithQuery = `${url.pathname}${url.search}`;

        if (
          pathWithQuery.startsWith("/api/heartbeat-runs") ||
          pathWithQuery.startsWith("/api/runs") ||
          pathWithQuery.startsWith("/api/run-logs") ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/heartbeat-runs`) ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/runs`) ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/run-logs`)
        ) {
          return new Response("not found", { status: 404 });
        }

        if (pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/issues`)) {
          return new Response(
            JSON.stringify({
              issues: [
                {
                  id: "issue-1",
                  title: "Issue 1",
                  status: "in_progress",
                  updatedAt: "2026-04-10T10:00:00.000Z"
                }
              ]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (pathWithQuery.startsWith("/api/issues/issue-1/runs")) {
          return new Response(
            JSON.stringify({
              runs: [
                {
                  id: "run-assoc-1",
                  status: "running",
                  startedAt: "2026-04-10T10:05:00.000Z"
                }
              ]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("unexpected path", { status: 500 });
      })
    );

    const result = await listRuns(createClient(), 5, { companyId: COMPANY_ID });
    expect(result.sourcePath).toContain("/api/issues/issue-1/runs");
    expect(result.sourcePath).toContain("#derived_from_issue_runs_association");
    expect(result.runs.map((run) => run.runId)).toEqual(["run-assoc-1"]);
  });

  it("keeps issue-derived fallback as last resort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
        const pathWithQuery = `${url.pathname}${url.search}`;

        if (
          pathWithQuery.startsWith("/api/heartbeat-runs") ||
          pathWithQuery.startsWith("/api/runs") ||
          pathWithQuery.startsWith("/api/run-logs") ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/heartbeat-runs`) ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/runs`) ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/run-logs`) ||
          pathWithQuery.startsWith("/api/issues/issue-exec/runs")
        ) {
          return new Response("not found", { status: 404 });
        }

        if (pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/issues`)) {
          return new Response(
            JSON.stringify({
              issues: [
                {
                  id: "issue-exec",
                  title: "Issue exec linkage",
                  status: "in_progress",
                  executionRunId: "run-exec-1",
                  updatedAt: "2026-04-10T10:00:00.000Z",
                  assigneeAgentId: "agent-1"
                }
              ]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("unexpected path", { status: 500 });
      })
    );

    const result = await listRuns(createClient(), 5, { companyId: COMPANY_ID });
    expect(result.sourcePath).toContain(`/api/companies/${COMPANY_ID}/issues`);
    expect(result.sourcePath).toContain("#derived_from_issues");
    expect(result.runs.map((run) => run.runId)).toEqual(["run-exec-1"]);
  });

  it("uses heartbeat run events as primary source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
        const pathWithQuery = `${url.pathname}${url.search}`;

        if (pathWithQuery.startsWith("/api/heartbeat-runs/run-123/events")) {
          return new Response(
            JSON.stringify({
              events: [
                {
                  id: "evt-1",
                  type: "run.started",
                  timestamp: "2026-04-10T10:00:00.000Z"
                },
                {
                  id: "evt-2",
                  type: "run.succeeded",
                  timestamp: "2026-04-10T10:01:00.000Z"
                }
              ]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("unexpected path", { status: 500 });
      })
    );

    const result = await getRunEvents(createClient(), "run-123", {
      companyId: COMPANY_ID
    });

    expect(result.sourcePath).toContain("/api/heartbeat-runs/run-123/events");
    expect(result.events.map((event) => event.type)).toEqual(["run.started", "run.succeeded"]);
  });

  it("uses issue association fallback for run events before issue-derived fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
        const pathWithQuery = `${url.pathname}${url.search}`;

        if (pathWithQuery.startsWith("/api/heartbeat-runs/run-123/issues")) {
          return new Response(
            JSON.stringify({
              issues: [
                {
                  id: "issue-1",
                  title: "Issue 1",
                  status: "in_progress",
                  updatedAt: "2026-04-10T10:00:00.000Z",
                  assigneeAgentId: "agent-1"
                }
              ]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (
          pathWithQuery.startsWith("/api/heartbeat-runs/run-123/events") ||
          pathWithQuery === "/api/heartbeat-runs/run-123" ||
          pathWithQuery.startsWith("/api/runs/run-123") ||
          pathWithQuery.startsWith("/api/run-logs/run-123") ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/heartbeat-runs/run-123`) ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/runs/run-123`) ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/run-logs/run-123`)
        ) {
          return new Response("not found", { status: 404 });
        }

        if (pathWithQuery.startsWith("/api/issues/issue-1/comments")) {
          return new Response(
            JSON.stringify({
              comments: [
                {
                  id: "comment-1",
                  body: "Checking run behavior",
                  createdAt: "2026-04-10T10:05:00.000Z",
                  authorId: "agent-1"
                }
              ]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("unexpected path", { status: 500 });
      })
    );

    const result = await getRunEvents(createClient(), "run-123", {
      companyId: COMPANY_ID
    });
    expect(result.sourcePath).toContain("#derived_from_issue_runs_association");
    expect(result.events.some((event) => event.type === "issue_state")).toBe(true);
    expect(result.events.some((event) => event.type === "issue_comment")).toBe(true);
  });

  it("keeps endpoint mismatch when no fallback context is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 }))
    );

    await expect(listRuns(createClient(), 3)).rejects.toMatchObject({
      category: "endpoint_mismatch"
    });
  });
});

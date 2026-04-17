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

describe("paperclip-runs compatibility fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to company issues when dedicated run routes are unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
        const pathWithQuery = `${url.pathname}${url.search}`;

        if (
          pathWithQuery.startsWith("/api/runs") ||
          pathWithQuery.startsWith("/api/run-logs") ||
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
                  runId: "run-123",
                  updatedAt: "2026-04-10T10:00:00.000Z",
                  assigneeAgentId: "agent-1"
                },
                {
                  id: "issue-2",
                  title: "Issue 2",
                  status: "blocked",
                  runId: "run-456",
                  updatedAt: "2026-04-10T09:00:00.000Z",
                  assigneeAgentId: "agent-2"
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
    expect(result.runs.map((run) => run.runId)).toEqual(["run-123", "run-456"]);
  });

  it("falls back to issue comments for run events when run event routes are unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
        const pathWithQuery = `${url.pathname}${url.search}`;

        if (
          pathWithQuery.startsWith("/api/runs/run-123") ||
          pathWithQuery.startsWith("/api/run-logs/run-123") ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/runs/run-123`) ||
          pathWithQuery.startsWith(`/api/companies/${COMPANY_ID}/run-logs/run-123`)
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
                  runId: "run-123",
                  updatedAt: "2026-04-10T10:00:00.000Z",
                  assigneeAgentId: "agent-1"
                }
              ]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
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
    expect(result.sourcePath).toContain("/api/issues/issue-1/comments");
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

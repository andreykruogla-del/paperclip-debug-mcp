import { afterEach, describe, expect, it, vi } from "vitest";

import { SentryClient } from "./sentry-client.js";

describe("SentryClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns not configured when missing auth data", async () => {
    const client = new SentryClient({});
    const health = await client.checkHealth();
    expect(health.configured).toBe(false);
    expect(health.reachable).toBe(false);
  });

  it("parses unresolved issues from sentry response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "1", title: "API timeout", level: "error" },
          { id: "2", title: "Warning", level: "warning" }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new SentryClient({
      orgSlug: "simfi",
      projectSlug: "paperclip",
      authToken: "token"
    });
    const health = await client.checkHealth();
    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(true);
    expect(health.unresolvedIssues).toBe(2);
    expect(health.highSeverityIssues).toBe(1);
  });
});

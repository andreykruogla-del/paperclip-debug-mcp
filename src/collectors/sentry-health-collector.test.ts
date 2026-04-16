import { afterEach, describe, expect, it, vi } from "vitest";

import { SentryHealthCollector } from "./sentry-health-collector.js";

describe("SentryHealthCollector", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates incident when sentry unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("forbidden", { status: 403 }))
    );
    const collector = new SentryHealthCollector({
      enabled: true,
      orgSlug: "simfi",
      projectSlug: "paperclip",
      authToken: "token"
    });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0]?.severity).toBe("error");
  });

  it("creates warning for unresolved high-severity issues", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify([{ title: "Outage", level: "error" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    const collector = new SentryHealthCollector({
      enabled: true,
      orgSlug: "simfi",
      projectSlug: "paperclip",
      authToken: "token"
    });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0]?.severity).toBe("warning");
  });
});

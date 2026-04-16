import { afterEach, describe, expect, it, vi } from "vitest";

import { CaddyHealthCollector } from "./caddy-health-collector.js";

describe("CaddyHealthCollector", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates critical incident when caddy health is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      })
    );
    const collector = new CaddyHealthCollector({
      enabled: true,
      healthUrl: "https://paperclip.example.com/healthz"
    });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0]?.severity).toBe("critical");
  });

  it("returns empty when collector disabled", async () => {
    const collector = new CaddyHealthCollector({
      enabled: false,
      healthUrl: "https://paperclip.example.com/healthz"
    });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(0);
  });
});

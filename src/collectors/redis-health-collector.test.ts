import { afterEach, describe, expect, it, vi } from "vitest";

import { RedisHealthCollector } from "./redis-health-collector.js";

describe("RedisHealthCollector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates error incident when redis unreachable", async () => {
    const mod = await import("../integrations/redis-client.js");
    vi.spyOn(mod.RedisClient.prototype, "checkHealth").mockResolvedValue({
      configured: true,
      reachable: false,
      urlConfigured: true,
      error: "auth failed"
    });
    const collector = new RedisHealthCollector({ enabled: true, url: "redis://localhost:6379/0" });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0]?.severity).toBe("error");
  });

  it("creates incidents for evictions and rejected connections", async () => {
    const mod = await import("../integrations/redis-client.js");
    vi.spyOn(mod.RedisClient.prototype, "checkHealth").mockResolvedValue({
      configured: true,
      reachable: true,
      urlConfigured: true,
      evictedKeys: 10,
      rejectedConnections: 3
    });
    const collector = new RedisHealthCollector({ enabled: true, url: "redis://localhost:6379/0" });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(2);
    expect(incidents.some((incident) => incident.id.includes("redis-evictions"))).toBe(true);
    expect(incidents.some((incident) => incident.id.includes("redis-rejected-connections"))).toBe(true);
  });
});

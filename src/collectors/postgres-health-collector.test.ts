import { afterEach, describe, expect, it, vi } from "vitest";

import { PostgresHealthCollector } from "./postgres-health-collector.js";

describe("PostgresHealthCollector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates critical incident when postgres unreachable", async () => {
    const mod = await import("../integrations/postgres-client.js");
    vi.spyOn(mod.PostgresClient.prototype, "checkHealth").mockResolvedValue({
      configured: true,
      reachable: false,
      hasReplicationLag: false,
      connectionStringConfigured: true,
      error: "auth failed"
    });
    const collector = new PostgresHealthCollector({
      enabled: true,
      connectionString: "postgres://user:pass@localhost:5432/db"
    });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0]?.severity).toBe("critical");
  });

  it("creates incidents for blocked queries and replication lag", async () => {
    const mod = await import("../integrations/postgres-client.js");
    vi.spyOn(mod.PostgresClient.prototype, "checkHealth").mockResolvedValue({
      configured: true,
      reachable: true,
      hasReplicationLag: true,
      connectionStringConfigured: true,
      blockedQueries: 2,
      longRunningQueries: 1,
      replicationLagSeconds: 90
    });
    const collector = new PostgresHealthCollector({
      enabled: true,
      connectionString: "postgres://user:pass@localhost:5432/db"
    });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(3);
    expect(incidents.some((incident) => incident.id.includes("postgres-blocked"))).toBe(true);
    expect(incidents.some((incident) => incident.id.includes("postgres-replication-lag"))).toBe(true);
  });
});

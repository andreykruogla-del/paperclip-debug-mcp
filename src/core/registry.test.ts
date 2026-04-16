import { describe, expect, it } from "vitest";

import type { IncidentCollector } from "./collector-interface.js";
import { CollectorRegistry } from "./registry.js";
import type { Incident } from "./types.js";

function makeIncident(id: string, ts: number): Incident {
  return {
    id,
    runtime: "paperclip",
    source: "paperclip-api",
    service: "coder",
    severity: "error",
    timestamp: ts,
    summary: "Agent run failed"
  };
}

function makeCollector(
  id: string,
  enabled: boolean,
  collectIncidents: () => Promise<Incident[]>
): IncidentCollector {
  return {
    id,
    kind: "external",
    enabled,
    collectIncidents
  };
}

describe("CollectorRegistry", () => {
  it("returns detailed refresh results with incident counts", async () => {
    const registry = new CollectorRegistry();
    registry.register(makeCollector("ok", true, async () => [makeIncident("a", 2), makeIncident("b", 1)]));
    registry.register(makeCollector("disabled", false, async () => [makeIncident("x", 1)]));

    const refreshed = await registry.refreshCollectors();
    const ok = refreshed.find((item) => item.id === "ok");
    const disabled = refreshed.find((item) => item.id === "disabled");

    expect(ok?.incidentCount).toBe(2);
    expect(ok?.lastError).toBeUndefined();
    expect(disabled?.incidentCount).toBe(0);
    expect(disabled?.lastRunAt).toBeUndefined();
  });

  it("captures collector errors and keeps aggregation alive", async () => {
    const registry = new CollectorRegistry();
    registry.register(
      makeCollector("broken", true, async () => {
        throw new Error("collector failed");
      })
    );
    registry.register(makeCollector("ok", true, async () => [makeIncident("new", 20), makeIncident("old", 10)]));

    const incidents = await registry.collectAllIncidents();
    expect(incidents.length).toBe(2);
    expect(incidents[0]?.timestamp).toBeGreaterThan(incidents[1]?.timestamp ?? 0);
    expect(incidents[0]?.fingerprint).toBeTypeOf("string");

    const statuses = registry.listStatuses();
    const broken = statuses.find((status) => status.id === "broken");
    expect(broken?.lastError).toBe("collector failed");
  });
});

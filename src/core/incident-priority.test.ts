import { describe, expect, it } from "vitest";

import type { Incident } from "./types.js";
import { prioritizeIncident, prioritizeIncidents } from "./incident-priority.js";

function baseIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "inc-1",
    source: "paperclip-api",
    service: "coder",
    severity: "warning",
    timestamp: Date.now(),
    summary: "Test incident",
    ...overrides
  };
}

describe("incident priority", () => {
  it("assigns higher score to critical incidents", () => {
    const low = prioritizeIncident(baseIncident({ severity: "info" }));
    const high = prioritizeIncident(baseIncident({ id: "inc-2", severity: "critical" }));
    expect(high.priorityScore).toBeGreaterThan(low.priorityScore);
    expect(high.priorityBand).toBe("critical");
  });

  it("boosts incidents with related run and auth cause", () => {
    const boosted = prioritizeIncident(
      baseIncident({
        severity: "error",
        relatedRunId: "run-1",
        probableCause: "Authorization/credentials issue"
      })
    );
    expect(boosted.priorityScore).toBeGreaterThanOrEqual(10);
    expect(boosted.reasons).toContain("has_related_run");
    expect(boosted.reasons).toContain("auth_related");
  });

  it("sorts incidents by score then recency", () => {
    const now = Date.now();
    const list = prioritizeIncidents([
      baseIncident({ id: "a", severity: "warning", timestamp: now - 1_000 }),
      baseIncident({ id: "b", severity: "critical", timestamp: now - 60_000 }),
      baseIncident({ id: "c", severity: "error", timestamp: now - 100 })
    ]);
    expect(list[0]?.id).toBe("b");
    expect(list[1]?.id).toBe("c");
  });
});

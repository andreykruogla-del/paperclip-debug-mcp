import { describe, expect, it } from "vitest";

import { buildIncidentTrends } from "./incident-trends.js";
import type { Incident } from "./types.js";

function incident(
  id: string,
  timestamp: number,
  severity: Incident["severity"],
  source: string
): Incident {
  return {
    id,
    source,
    service: "svc",
    severity,
    timestamp,
    summary: "test"
  };
}

describe("buildIncidentTrends", () => {
  it("builds buckets and totals for selected window", () => {
    const nowTs = Date.UTC(2026, 3, 16, 12, 0, 0);
    const incidents: Incident[] = [
      incident("a", nowTs - 50 * 60_000, "error", "paperclip-api"),
      incident("b", nowTs - 45 * 60_000, "error", "paperclip-api"),
      incident("c", nowTs - 10 * 60_000, "critical", "docker-cli"),
      incident("d", nowTs - 26 * 60 * 60_000, "warning", "filesystem-log")
    ];
    const trends = buildIncidentTrends(incidents, { nowTs, windowHours: 2, bucketMinutes: 30 });

    expect(trends.totals.incidents).toBe(3);
    expect(trends.totals.bySeverity.error).toBe(2);
    expect(trends.totals.bySeverity.critical).toBe(1);
    expect(trends.totals.bySource["paperclip-api"]).toBe(2);
    expect(trends.buckets.length).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import { clusterIncidents, computeFingerprint } from "./incident-analysis.js";
import type { Incident } from "./types.js";

function makeIncident(id: string, summary: string, ts: number): Incident {
  return {
    id,
    runtime: "paperclip",
    source: "paperclip-api",
    service: "coder",
    severity: "error",
    timestamp: ts,
    summary,
    probableCause: "Timeout while calling dependency"
  };
}

describe("incident analysis", () => {
  it("computes stable fingerprints for same semantic incident", () => {
    const a = makeIncident("1", "Run failed", 1);
    const b = makeIncident("2", "Run failed", 2);
    expect(computeFingerprint(a)).toBe(computeFingerprint(b));
  });

  it("clusters incidents by fingerprint and count", () => {
    const now = Date.now();
    const incidents: Incident[] = [
      makeIncident("1", "Run failed", now - 1000),
      makeIncident("2", "Run failed", now - 800),
      makeIncident("3", "Provider down", now - 500)
    ];
    const clusters = clusterIncidents(incidents);
    expect(clusters.length).toBe(2);
    expect(clusters[0]?.count).toBe(2);
  });
});

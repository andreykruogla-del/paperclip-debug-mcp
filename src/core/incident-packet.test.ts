import { describe, expect, it } from "vitest";

import { buildIncidentPacket } from "./incident-packet.js";
import type { Incident } from "./types.js";

describe("buildIncidentPacket", () => {
  it("collects incidents by related run id", () => {
    const incidents: Incident[] = [
      {
        id: "i1",
        source: "paperclip-api",
        service: "coder",
        severity: "error",
        timestamp: Date.now(),
        summary: "Run failed",
        relatedRunId: "run-1"
      },
      {
        id: "i2",
        source: "docker-cli",
        service: "paperclip-api",
        severity: "warning",
        timestamp: Date.now() - 5000,
        summary: "Transient issue",
        relatedRunId: "run-2"
      }
    ];

    const packet = buildIncidentPacket({
      run: {
        runId: "run-1",
        status: "failed",
        startedAt: Date.now() - 10000
      },
      allIncidents: incidents
    });

    expect(packet.relatedIncidents.length).toBe(1);
    expect(packet.relatedIncidents[0]?.id).toBe("i1");
    expect(packet.clusters.length).toBe(1);
  });
});

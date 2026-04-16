import { describe, expect, it } from "vitest";

import {
  buildRunEventsTriageGuidance,
  buildTraceHandoffTriageGuidance
} from "./triage-guidance.js";

describe("triage guidance", () => {
  it("builds run event guidance with summary and next tools", () => {
    const guidance = buildRunEventsTriageGuidance({
      runId: "run-123",
      events: [
        {
          timestamp: 1_700_000_000_000,
          type: "step.started",
          agentId: "agent-a"
        },
        {
          timestamp: 1_700_000_000_500,
          type: "step.failed",
          level: "error",
          error: "timeout",
          agentId: "agent-b"
        }
      ]
    });

    expect(guidance.summary.runId).toBe("run-123");
    expect(guidance.summary.returnedEvents).toBe(2);
    expect(guidance.summary.errorLikeEvents).toBe(1);
    expect(guidance.topSignals.some((signal) => signal.signal === "error_like_events_present")).toBe(true);
    expect(guidance.recommendedNextTools).toContain("paperclipDebug.trace_handoff");
  });

  it("builds fallback run event guidance for empty events", () => {
    const guidance = buildRunEventsTriageGuidance({
      runId: "run-empty",
      events: []
    });

    expect(guidance.summary.returnedEvents).toBe(0);
    expect(guidance.topSignals[0]?.signal).toBe("run_has_no_events");
    expect(guidance.recommendedNextTools).toContain("paperclipDebug.list_runs");
  });

  it("builds handoff guidance with summary and critical signal", () => {
    const guidance = buildTraceHandoffTriageGuidance({
      requestedRunId: "run-1",
      traces: [
        {
          runId: "run-1",
          latestTimestamp: 1_700_000_001_000,
          highestSeverity: "critical",
          steps: [
            { service: "api", severity: "error" },
            { service: "worker", severity: "critical" }
          ]
        }
      ]
    });

    expect(guidance.summary.requestedRunId).toBe("run-1");
    expect(guidance.summary.returnedTraces).toBe(1);
    expect(guidance.summary.tracesWithCritical).toBe(1);
    expect(guidance.topSignals.some((signal) => signal.signal === "critical_handoff_present")).toBe(true);
    expect(guidance.recommendedNextTools).toContain("paperclipDebug.get_run_events");
  });

  it("builds fallback handoff guidance when traces are missing", () => {
    const guidance = buildTraceHandoffTriageGuidance({
      traces: []
    });

    expect(guidance.summary.returnedTraces).toBe(0);
    expect(guidance.topSignals[0]?.signal).toBe("no_handoff_traces");
    expect(guidance.recommendedNextTools).toContain("paperclipDebug.refresh_collectors");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildIncidentPacketGuidance,
  buildIssueCommentsTriageGuidance,
  buildListIssuesTriageGuidance,
  buildPrioritizeTriageGuidance,
  buildRunEventsTriageGuidance,
  buildSystemSnapshotTriageGuidance,
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

  it("builds prioritize guidance with advisory correlation hints", () => {
    const guidance = buildPrioritizeTriageGuidance([
      {
        service: "api",
        priorityBand: "critical",
        relatedRunId: "run-1"
      },
      {
        service: "api",
        priorityBand: "high",
        relatedRunId: "run-2"
      },
      {
        service: "worker",
        priorityBand: "medium"
      }
    ]);

    expect(guidance.correlationHints.dominantLane).toBe("mixed");
    expect(guidance.correlationHints.dominantServices).toContain("api");
    expect(guidance.correlationHints.runLinkedIncidentRatio).toBeGreaterThan(0.6);
  });

  it("builds system snapshot guidance with dependency lane hints", () => {
    const guidance = buildSystemSnapshotTriageGuidance({
      collectors: [{ lastError: "timeout" }],
      summary: {
        incidents: 5,
        criticalOrHigh: 2,
        services: 2,
        problematicServices: 0,
        runs: 0,
        issues: 0
      },
      topIncidents: [],
      services: [],
      paperclipError: "Paperclip API unavailable"
    });

    expect(guidance.correlationHints.dominantLane).toBe("dependency");
    expect(guidance.correlationHints.dependencySignals.failingCollectors).toBe(1);
    expect(guidance.correlationHints.dependencySignals.paperclipUnavailableOrMisconfigured).toBe(true);
  });

  it("builds packet guidance with cross-source correlation hints", () => {
    const guidance = buildIncidentPacketGuidance({
      packet: {
        issue: { issueId: "issue-1", relatedRunId: "run-1" },
        comments: [{ id: 1 }],
        run: { runId: "run-1" },
        runEvents: [{ id: 1 }],
        relatedIncidents: [
          { service: "api" },
          { service: "api" },
          { service: "worker" }
        ],
        clusters: [{ id: "c1" }]
      }
    });

    expect(guidance.correlationHints.dominantLane).toBe("mixed");
    expect(guidance.correlationHints.dominantServices).toContain("api");
    expect(guidance.correlationHints.crossSourceEvidenceCount).toBe(4);
  });

  it("builds issue list guidance with run-linked signal", () => {
    const guidance = buildListIssuesTriageGuidance({
      requestedStatus: "open",
      issues: [
        {
          issueId: "issue-1",
          status: "open",
          priority: "high",
          assigneeAgentId: "agent-1",
          relatedRunId: "run-1",
          updatedAt: 1_700_000_000_000
        },
        {
          issueId: "issue-2",
          status: "open",
          updatedAt: 1_700_000_000_100
        }
      ]
    });

    expect(guidance.summary.requestedStatus).toBe("open");
    expect(guidance.summary.returnedIssues).toBe(2);
    expect(guidance.summary.runLinkedIssues).toBe(1);
    expect(guidance.topSignals.some((signal) => signal.signal === "run_linked_issues_present")).toBe(true);
    expect(guidance.recommendedNextTools).toContain("paperclipDebug.get_issue_comments");
  });

  it("builds fallback issue list guidance when issues are missing", () => {
    const guidance = buildListIssuesTriageGuidance({
      issues: []
    });

    expect(guidance.summary.returnedIssues).toBe(0);
    expect(guidance.topSignals[0]?.signal).toBe("no_issues_after_filter");
    expect(guidance.recommendedNextTools).toContain("paperclipDebug.system_snapshot");
  });

  it("builds issue comment guidance with thread signals", () => {
    const guidance = buildIssueCommentsTriageGuidance({
      issueId: "issue-1",
      comments: [
        {
          commentId: "c-1",
          issueId: "issue-1",
          body: "first",
          createdAt: 1_700_000_000_000,
          authorId: "author-a"
        },
        {
          commentId: "c-2",
          issueId: "issue-1",
          createdAt: 1_700_000_000_100,
          authorId: "author-b"
        }
      ]
    });

    expect(guidance.summary.issueId).toBe("issue-1");
    expect(guidance.summary.returnedComments).toBe(2);
    expect(guidance.summary.uniqueAuthors).toBe(2);
    expect(guidance.topSignals.some((signal) => signal.signal === "multi_author_thread")).toBe(true);
    expect(guidance.recommendedNextTools).toContain("paperclipDebug.build_incident_packet");
  });

  it("builds fallback issue comment guidance when comments are missing", () => {
    const guidance = buildIssueCommentsTriageGuidance({
      issueId: "issue-empty",
      comments: []
    });

    expect(guidance.summary.returnedComments).toBe(0);
    expect(guidance.topSignals[0]?.signal).toBe("no_issue_comments_found");
    expect(guidance.recommendedNextTools).toContain("paperclipDebug.list_issues");
  });
});

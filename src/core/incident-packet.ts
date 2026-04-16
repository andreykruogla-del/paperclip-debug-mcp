import type { Incident } from "./types.js";
import { clusterIncidents } from "./incident-analysis.js";
import type { PaperclipIssueComment, PaperclipIssueSummary } from "../integrations/paperclip-issues.js";
import type { PaperclipRunEvent, PaperclipRunSummary } from "../integrations/paperclip-runs.js";

export type IncidentPacket = {
  packetId: string;
  generatedAt: number;
  issue?: PaperclipIssueSummary;
  comments?: PaperclipIssueComment[];
  run?: PaperclipRunSummary;
  runEvents?: PaperclipRunEvent[];
  relatedIncidents: Incident[];
  clusters: ReturnType<typeof clusterIncidents>;
};

export function buildIncidentPacket(params: {
  issue?: PaperclipIssueSummary;
  comments?: PaperclipIssueComment[];
  run?: PaperclipRunSummary;
  runEvents?: PaperclipRunEvent[];
  allIncidents: Incident[];
}): IncidentPacket {
  const { issue, comments, run, runEvents, allIncidents } = params;
  const runId = issue?.relatedRunId ?? run?.runId;
  const relatedIncidents = runId
    ? allIncidents.filter((incident) => incident.relatedRunId === runId)
    : issue
      ? allIncidents.filter((incident) => incident.summary.toLowerCase().includes(issue.title.toLowerCase()))
      : allIncidents.slice(0, 50);

  const packetId = [
    "packet",
    issue?.issueId ?? "no-issue",
    runId ?? "no-run",
    String(Date.now())
  ].join("-");

  return {
    packetId,
    generatedAt: Date.now(),
    issue,
    comments,
    run,
    runEvents,
    relatedIncidents,
    clusters: clusterIncidents(relatedIncidents)
  };
}

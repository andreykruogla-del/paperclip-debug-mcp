import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident } from "../core/types.js";

export class PaperclipSampleCollector implements IncidentCollector {
  public readonly id = "paperclip-main";
  public readonly kind = "paperclip" as const;
  public readonly enabled = true;

  public async collectIncidents(): Promise<Incident[]> {
    return [
      {
        id: "inc-paperclip-001",
        runtime: "paperclip",
        source: "paperclip",
        service: "agent-runtime",
        severity: "error",
        timestamp: Date.now(),
        summary: "Run failed with authorization timeout",
        probableCause: "LLM provider authentication expired",
        relatedRunId: "sample-run-001",
        rawExcerpt: "turn.error: Authorization timeout, please restart the process."
      }
    ];
  }
}

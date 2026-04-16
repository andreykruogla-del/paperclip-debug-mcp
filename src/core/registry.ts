import type { IncidentCollector } from "./collector-interface.js";
import type { CollectorStatus, Incident } from "./types.js";
import { computeFingerprint } from "./incident-analysis.js";

export class CollectorRegistry {
  private readonly collectors: IncidentCollector[] = [];
  private readonly statuses = new Map<string, CollectorStatus>();

  public register(collector: IncidentCollector): void {
    this.collectors.push(collector);
    this.statuses.set(collector.id, {
      id: collector.id,
      kind: collector.kind,
      enabled: collector.enabled
    });
  }

  public listStatuses(): CollectorStatus[] {
    return [...this.statuses.values()];
  }

  public async collectAllIncidents(): Promise<Incident[]> {
    const chunks = await Promise.all(this.collectors.map((collector) => this.collectOne(collector)));
    return chunks
      .flat()
      .map((incident) => ({
        ...incident,
        fingerprint: incident.fingerprint ?? computeFingerprint(incident)
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private async collectOne(collector: IncidentCollector): Promise<Incident[]> {
    if (!collector.enabled) {
      return [];
    }

    try {
      const incidents = await collector.collectIncidents();
      this.statuses.set(collector.id, {
        id: collector.id,
        kind: collector.kind,
        enabled: collector.enabled,
        lastRunAt: Date.now()
      });
      return incidents;
    } catch (error: unknown) {
      this.statuses.set(collector.id, {
        id: collector.id,
        kind: collector.kind,
        enabled: collector.enabled,
        lastRunAt: Date.now(),
        lastError: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
}

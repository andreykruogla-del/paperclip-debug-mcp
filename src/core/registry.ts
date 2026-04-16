import type { IncidentCollector } from "./collector-interface.js";
import type { CollectorRefreshResult, CollectorStatus, Incident } from "./types.js";
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
    const results = await this.refreshCollectors();
    const chunks = results.map((result) => result.incidents);
    return chunks
      .flat()
      .map((incident) => ({
        ...incident,
        fingerprint: incident.fingerprint ?? computeFingerprint(incident)
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public async refreshCollectors(): Promise<(CollectorRefreshResult & { incidents: Incident[] })[]> {
    const results = await Promise.all(this.collectors.map((collector) => this.collectOne(collector)));
    return results
      .map((result) => ({
        ...result,
        incidents: result.incidents.map((incident) => ({
          ...incident,
          fingerprint: incident.fingerprint ?? computeFingerprint(incident)
        }))
      }))
      .sort((a, b) => (b.lastRunAt ?? 0) - (a.lastRunAt ?? 0));
  }

  private async collectOne(
    collector: IncidentCollector
  ): Promise<CollectorRefreshResult & { incidents: Incident[] }> {
    if (!collector.enabled) {
      return {
        id: collector.id,
        kind: collector.kind,
        enabled: collector.enabled,
        incidentCount: 0,
        incidents: []
      };
    }

    const lastRunAt = Date.now();
    try {
      const incidents = await collector.collectIncidents();
      this.statuses.set(collector.id, {
        id: collector.id,
        kind: collector.kind,
        enabled: collector.enabled,
        lastRunAt
      });
      return {
        id: collector.id,
        kind: collector.kind,
        enabled: collector.enabled,
        incidentCount: incidents.length,
        lastRunAt,
        incidents
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.statuses.set(collector.id, {
        id: collector.id,
        kind: collector.kind,
        enabled: collector.enabled,
        lastRunAt,
        lastError: message
      });
      return {
        id: collector.id,
        kind: collector.kind,
        enabled: collector.enabled,
        incidentCount: 0,
        lastRunAt,
        lastError: message,
        incidents: []
      };
    }
  }
}

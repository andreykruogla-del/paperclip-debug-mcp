import type { IncidentCollector } from "./collector-interface.js";
import type { CollectorStatus, Incident } from "./types.js";

export class CollectorRegistry {
  private readonly collectors: IncidentCollector[] = [];

  public register(collector: IncidentCollector): void {
    this.collectors.push(collector);
  }

  public listStatuses(): CollectorStatus[] {
    return this.collectors.map((collector) => ({
      id: collector.id,
      kind: collector.kind,
      enabled: collector.enabled
    }));
  }

  public async collectAllIncidents(): Promise<Incident[]> {
    const chunks = await Promise.all(
      this.collectors
        .filter((collector) => collector.enabled)
        .map(async (collector) => collector.collectIncidents())
    );
    return chunks.flat().sort((a, b) => b.timestamp - a.timestamp);
  }
}

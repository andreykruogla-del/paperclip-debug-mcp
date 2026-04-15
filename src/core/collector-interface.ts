import type { CollectorKind, Incident } from "./types.js";

export interface IncidentCollector {
  id: string;
  kind: CollectorKind;
  enabled: boolean;
  collectIncidents(): Promise<Incident[]>;
}

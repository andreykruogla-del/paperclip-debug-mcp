export type CollectorKind = "paperclip" | "docker_service" | "external";

export type IncidentSeverity = "info" | "warning" | "error" | "critical";

export type Incident = {
  id: string;
  runtime?: string;
  source: string;
  service: string;
  severity: IncidentSeverity;
  timestamp: number;
  summary: string;
  probableCause?: string;
  relatedRunId?: string;
  fingerprint?: string;
  rawExcerpt?: string;
};

export type CollectorStatus = {
  id: string;
  kind: CollectorKind;
  enabled: boolean;
  lastRunAt?: number;
  lastError?: string;
};

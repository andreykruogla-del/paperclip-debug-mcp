import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident } from "../core/types.js";
import { redactSensitiveText } from "../core/redaction.js";
import { PostgresClient } from "../integrations/postgres-client.js";

type PostgresCollectorOptions = {
  enabled?: boolean;
  connectionString?: string;
};

export class PostgresHealthCollector implements IncidentCollector {
  public readonly id = "postgres-health";
  public readonly kind = "external" as const;
  public readonly enabled: boolean;
  private readonly client: PostgresClient;

  public constructor(options?: PostgresCollectorOptions) {
    this.client = new PostgresClient({ connectionString: options?.connectionString });
    const enabledByConfig = options?.enabled ?? (process.env.POSTGRES_COLLECTOR_ENABLED ?? "false").toLowerCase() !== "false";
    this.enabled = enabledByConfig && this.client.isEnabled();
  }

  public async collectIncidents(): Promise<Incident[]> {
    if (!this.enabled) return [];
    const health = await this.client.checkHealth();
    const ts = Date.now();
    const incidents: Incident[] = [];

    if (!health.reachable) {
      incidents.push({
        id: `postgres-unreachable-${ts}`,
        runtime: "postgres",
        source: "postgres-health",
        service: "postgres",
        severity: "critical",
        timestamp: ts,
        summary: "PostgreSQL is unreachable",
        probableCause: "Connection/auth/network issue",
        rawExcerpt: redactSensitiveText(health.error)
      });
      return incidents;
    }

    if ((health.blockedQueries ?? 0) > 0) {
      incidents.push({
        id: `postgres-blocked-${ts}`,
        runtime: "postgres",
        source: "postgres-health",
        service: "postgres",
        severity: (health.blockedQueries ?? 0) >= 5 ? "error" : "warning",
        timestamp: ts,
        summary: `${health.blockedQueries} blocked queries detected`,
        probableCause: "Lock contention in database workload",
        rawExcerpt: `blocked=${health.blockedQueries}`
      });
    }

    if ((health.longRunningQueries ?? 0) > 0) {
      incidents.push({
        id: `postgres-long-running-${ts}`,
        runtime: "postgres",
        source: "postgres-health",
        service: "postgres",
        severity: "warning",
        timestamp: ts,
        summary: `${health.longRunningQueries} long-running queries detected`,
        probableCause: "Slow queries or heavy transactions",
        rawExcerpt: `long_running=${health.longRunningQueries}`
      });
    }

    if ((health.replicationLagSeconds ?? 0) > 30) {
      incidents.push({
        id: `postgres-replication-lag-${ts}`,
        runtime: "postgres",
        source: "postgres-health",
        service: "postgres",
        severity: (health.replicationLagSeconds ?? 0) >= 120 ? "error" : "warning",
        timestamp: ts,
        summary: `Replication lag ${health.replicationLagSeconds}s`,
        probableCause: "Replica catch-up delay",
        rawExcerpt: `replication_lag_seconds=${health.replicationLagSeconds}`
      });
    }

    return incidents;
  }
}

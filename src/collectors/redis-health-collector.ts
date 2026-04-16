import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident } from "../core/types.js";
import { redactSensitiveText } from "../core/redaction.js";
import { RedisClient } from "../integrations/redis-client.js";

type RedisCollectorOptions = {
  enabled?: boolean;
  url?: string;
};

export class RedisHealthCollector implements IncidentCollector {
  public readonly id = "redis-health";
  public readonly kind = "external" as const;
  public readonly enabled: boolean;
  private readonly client: RedisClient;

  public constructor(options?: RedisCollectorOptions) {
    this.client = new RedisClient({ url: options?.url });
    const enabledByConfig = options?.enabled ?? (process.env.REDIS_COLLECTOR_ENABLED ?? "false").toLowerCase() !== "false";
    this.enabled = enabledByConfig && this.client.isEnabled();
  }

  public async collectIncidents(): Promise<Incident[]> {
    if (!this.enabled) return [];
    const health = await this.client.checkHealth();
    const ts = Date.now();
    const incidents: Incident[] = [];

    if (!health.reachable) {
      incidents.push({
        id: `redis-unreachable-${ts}`,
        runtime: "redis",
        source: "redis-health",
        service: "redis",
        severity: "error",
        timestamp: ts,
        summary: "Redis is unreachable",
        probableCause: "Connection/auth/network issue",
        rawExcerpt: redactSensitiveText(health.error)
      });
      return incidents;
    }

    if ((health.evictedKeys ?? 0) > 0) {
      incidents.push({
        id: `redis-evictions-${ts}`,
        runtime: "redis",
        source: "redis-health",
        service: "redis",
        severity: (health.evictedKeys ?? 0) >= 100 ? "error" : "warning",
        timestamp: ts,
        summary: `Redis reports ${health.evictedKeys} evicted keys`,
        probableCause: "Memory pressure or maxmemory policy saturation",
        rawExcerpt: `evicted_keys=${health.evictedKeys}`
      });
    }

    if ((health.rejectedConnections ?? 0) > 0) {
      incidents.push({
        id: `redis-rejected-connections-${ts}`,
        runtime: "redis",
        source: "redis-health",
        service: "redis",
        severity: "warning",
        timestamp: ts,
        summary: `Redis has ${health.rejectedConnections} rejected connections`,
        probableCause: "Connection pool pressure or maxclients limits",
        rawExcerpt: `rejected_connections=${health.rejectedConnections}`
      });
    }

    return incidents;
  }
}

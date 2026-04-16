import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident } from "../core/types.js";
import { redactSensitiveText } from "../core/redaction.js";
import { SentryClient } from "../integrations/sentry-client.js";

type SentryCollectorOptions = {
  enabled?: boolean;
  baseUrl?: string;
  orgSlug?: string;
  projectSlug?: string;
  authToken?: string;
};

export class SentryHealthCollector implements IncidentCollector {
  public readonly id = "sentry-health";
  public readonly kind = "external" as const;
  public readonly enabled: boolean;
  private readonly client: SentryClient;

  public constructor(options?: SentryCollectorOptions) {
    this.client = new SentryClient({
      baseUrl: options?.baseUrl,
      orgSlug: options?.orgSlug,
      projectSlug: options?.projectSlug,
      authToken: options?.authToken
    });
    const enabledByConfig = options?.enabled ?? (process.env.SENTRY_COLLECTOR_ENABLED ?? "false").toLowerCase() !== "false";
    this.enabled = enabledByConfig && this.client.isEnabled();
  }

  public async collectIncidents(): Promise<Incident[]> {
    if (!this.enabled) return [];
    const health = await this.client.checkHealth(20);
    const ts = Date.now();
    const incidents: Incident[] = [];

    if (!health.reachable) {
      incidents.push({
        id: `sentry-unreachable-${ts}`,
        runtime: "sentry",
        source: "sentry-health",
        service: "sentry",
        severity: "error",
        timestamp: ts,
        summary: "Sentry API is unreachable or unauthorized",
        probableCause: "Sentry token/scope issue or network/API outage",
        rawExcerpt: redactSensitiveText(health.error)
      });
      return incidents;
    }

    if ((health.highSeverityIssues ?? 0) > 0) {
      incidents.push({
        id: `sentry-high-severity-${ts}`,
        runtime: "sentry",
        source: "sentry-health",
        service: "sentry",
        severity: (health.highSeverityIssues ?? 0) >= 10 ? "critical" : "warning",
        timestamp: ts,
        summary: `Sentry reports ${health.highSeverityIssues} unresolved high-severity issues`,
        probableCause: "Active production failures",
        rawExcerpt: redactSensitiveText(health.latestIssueTitle)
      });
    }

    return incidents;
  }
}

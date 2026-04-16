import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident } from "../core/types.js";
import { redactSensitiveText } from "../core/redaction.js";
import { CaddyClient } from "../integrations/caddy-client.js";

type CaddyCollectorOptions = {
  enabled?: boolean;
  healthUrl?: string;
  logPath?: string;
  logTailLines?: number;
};

export class CaddyHealthCollector implements IncidentCollector {
  public readonly id = "caddy-health";
  public readonly kind = "external" as const;
  public readonly enabled: boolean;
  private readonly client: CaddyClient;

  public constructor(options?: CaddyCollectorOptions) {
    this.client = new CaddyClient({
      healthUrl: options?.healthUrl,
      logPath: options?.logPath,
      logTailLines: options?.logTailLines
    });
    const enabledByConfig = options?.enabled ?? (process.env.CADDY_COLLECTOR_ENABLED ?? "false").toLowerCase() !== "false";
    this.enabled = enabledByConfig && this.client.isEnabled();
  }

  public async collectIncidents(): Promise<Incident[]> {
    if (!this.enabled) return [];
    const health = await this.client.checkHealth();
    const ts = Date.now();
    const incidents: Incident[] = [];

    if (health.healthUrl && !health.reachable) {
      incidents.push({
        id: `caddy-unreachable-${ts}`,
        runtime: "caddy",
        source: "caddy-health",
        service: "caddy",
        severity: "critical",
        timestamp: ts,
        summary: "Caddy health endpoint is unavailable",
        probableCause: "Reverse proxy outage, network issue, or upstream failure",
        rawExcerpt: redactSensitiveText(health.error)
      });
    } else if ((health.statusCode ?? 200) >= 500) {
      incidents.push({
        id: `caddy-5xx-${ts}`,
        runtime: "caddy",
        source: "caddy-health",
        service: "caddy",
        severity: "error",
        timestamp: ts,
        summary: `Caddy health endpoint returned ${health.statusCode}`,
        probableCause: "Upstream instability or reverse proxy misconfiguration",
        rawExcerpt: redactSensitiveText(health.error)
      });
    }

    if ((health.logErrorCount ?? 0) >= 1) {
      incidents.push({
        id: `caddy-log-errors-${ts}`,
        runtime: "caddy",
        source: "caddy-health",
        service: "caddy",
        severity: (health.logErrorCount ?? 0) >= 10 ? "error" : "warning",
        timestamp: ts,
        summary: `Caddy logs contain ${health.logErrorCount} recent error-like lines`,
        probableCause: "Recurring upstream/proxy/tls issues in reverse proxy layer",
        rawExcerpt: redactSensitiveText(health.lastErrorLine)
      });
    }

    if (health.logReadError) {
      incidents.push({
        id: `caddy-log-read-${ts}`,
        runtime: "caddy",
        source: "caddy-health",
        service: "caddy",
        severity: "warning",
        timestamp: ts,
        summary: "Caddy log file configured but cannot be read",
        probableCause: "Path or permission problem",
        rawExcerpt: redactSensitiveText(health.logReadError)
      });
    }

    return incidents;
  }
}

import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident } from "../core/types.js";
import { redactSensitiveText } from "../core/redaction.js";
import { WordPressClient } from "../integrations/wordpress-client.js";

type WordPressCollectorOptions = {
  enabled?: boolean;
  baseUrl?: string;
  username?: string;
  appPassword?: string;
};

export class WordPressHealthCollector implements IncidentCollector {
  public readonly id = "wordpress-health";
  public readonly kind = "wordpress" as const;
  public readonly enabled: boolean;

  private readonly client: WordPressClient;

  public constructor(options?: WordPressCollectorOptions) {
    this.client = new WordPressClient({
      baseUrl: options?.baseUrl,
      username: options?.username,
      appPassword: options?.appPassword
    });
    const enabledByConfig = options?.enabled ?? (process.env.WORDPRESS_COLLECTOR_ENABLED ?? "false").toLowerCase() !== "false";
    this.enabled = enabledByConfig && this.client.isEnabled();
  }

  public async collectIncidents(): Promise<Incident[]> {
    if (!this.enabled) return [];

    const health = await this.client.checkHealth();
    const timestamp = Date.now();
    const incidents: Incident[] = [];

    if (!health.reachable) {
      incidents.push({
        id: `wordpress-unreachable-${timestamp}`,
        runtime: "wordpress",
        source: "wordpress-health",
        service: "wordpress",
        severity: "critical",
        timestamp,
        summary: "WordPress endpoint is unreachable or wp-json failed",
        probableCause: "WordPress host/network or reverse proxy issue",
        rawExcerpt: redactSensitiveText(health.restError)
      });
      return incidents;
    }

    if (!health.restApiAvailable) {
      incidents.push({
        id: `wordpress-rest-${timestamp}`,
        runtime: "wordpress",
        source: "wordpress-health",
        service: "wordpress",
        severity: "error",
        timestamp,
        summary: "WordPress REST API is unavailable",
        probableCause: "REST route blocked or WordPress API disabled",
        rawExcerpt: redactSensitiveText(health.restError)
      });
    }

    if (health.xmlrpcEnabled) {
      incidents.push({
        id: `wordpress-xmlrpc-${timestamp}`,
        runtime: "wordpress",
        source: "wordpress-health",
        service: "wordpress",
        severity: "warning",
        timestamp,
        summary: "WordPress XML-RPC endpoint is enabled",
        probableCause: "Extra attack surface enabled",
        rawExcerpt: redactSensitiveText(health.xmlrpcError ?? "xmlrpc.php responded")
      });
    }

    if (health.authChecked && health.authOk === false) {
      incidents.push({
        id: `wordpress-auth-${timestamp}`,
        runtime: "wordpress",
        source: "wordpress-health",
        service: "wordpress",
        severity: "error",
        timestamp,
        summary: "WordPress application password auth check failed",
        probableCause: "Invalid credentials or auth plugin configuration",
        rawExcerpt: redactSensitiveText(health.authError)
      });
    }

    return incidents;
  }
}

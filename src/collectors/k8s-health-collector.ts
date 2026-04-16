import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident } from "../core/types.js";
import { redactSensitiveText } from "../core/redaction.js";
import { K8sClient } from "../integrations/k8s-client.js";

type K8sCollectorOptions = {
  enabled?: boolean;
  namespace?: string;
};

export class K8sHealthCollector implements IncidentCollector {
  public readonly id = "k8s-health";
  public readonly kind = "external" as const;
  public readonly enabled: boolean;
  private readonly client: K8sClient;

  public constructor(options?: K8sCollectorOptions) {
    this.client = new K8sClient({ namespace: options?.namespace });
    const enabledByConfig = options?.enabled ?? (process.env.K8S_COLLECTOR_ENABLED ?? "false").toLowerCase() !== "false";
    this.enabled = enabledByConfig && this.client.isEnabled();
  }

  public async collectIncidents(): Promise<Incident[]> {
    if (!this.enabled) return [];
    const health = await this.client.checkHealth();
    const ts = Date.now();
    const incidents: Incident[] = [];

    if (!health.reachable) {
      incidents.push({
        id: `k8s-unreachable-${ts}`,
        runtime: "kubernetes",
        source: "k8s-health",
        service: "k8s",
        severity: "error",
        timestamp: ts,
        summary: `Kubernetes namespace ${health.namespace} is unreachable`,
        probableCause: "kubectl context/permissions/cluster connectivity issue",
        rawExcerpt: redactSensitiveText(health.error)
      });
      return incidents;
    }

    if ((health.problematicPodCount ?? 0) > 0) {
      const top = health.problematicPods?.[0];
      incidents.push({
        id: `k8s-problematic-pods-${ts}`,
        runtime: "kubernetes",
        source: "k8s-health",
        service: `k8s:${health.namespace}`,
        severity: (health.problematicPodCount ?? 0) >= 5 ? "critical" : "warning",
        timestamp: ts,
        summary: `${health.problematicPodCount} problematic pods in namespace ${health.namespace}`,
        probableCause: "CrashLoopBackOff, not-ready pods, or unhealthy workload rollout",
        rawExcerpt: redactSensitiveText(top ? `${top.name} phase=${top.phase} reason=${top.reason ?? "unknown"}` : undefined)
      });
    }

    return incidents;
  }
}

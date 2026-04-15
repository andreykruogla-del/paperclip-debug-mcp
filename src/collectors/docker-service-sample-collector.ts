import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident } from "../core/types.js";

export class DockerServiceSampleCollector implements IncidentCollector {
  public readonly id = "docker-services";
  public readonly kind = "docker_service" as const;
  public readonly enabled = true;

  public async collectIncidents(): Promise<Incident[]> {
    return [
      {
        id: "inc-docker-001",
        source: "docker",
        service: "mail-case-api",
        severity: "warning",
        timestamp: Date.now(),
        summary: "Service recovered after transient 503",
        probableCause: "Upstream dependency timeout burst",
        rawExcerpt: "HTTP 503 for 2 checks, then healthy."
      }
    ];
  }
}

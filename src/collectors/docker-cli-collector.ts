import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident, IncidentSeverity } from "../core/types.js";
import { listDockerServices } from "../integrations/docker-services.js";

const execFileAsync = promisify(execFile);

function now(): number {
  return Date.now();
}

function normalizeSeverity(status: string): IncidentSeverity {
  const value = status.toLowerCase();
  if (value.includes("exited") || value.includes("dead")) return "critical";
  if (value.includes("unhealthy") || value.includes("restart")) return "error";
  return "warning";
}

function probableCauseFromLog(logExcerpt: string): string | undefined {
  if (!logExcerpt) return undefined;
  if (/429|rate limit/i.test(logExcerpt)) return "Provider rate limit";
  if (/401|403|unauthor/i.test(logExcerpt)) return "Authorization problem";
  if (/timeout|timed out/i.test(logExcerpt)) return "Timeout in dependency chain";
  if (/refused|econnrefused/i.test(logExcerpt)) return "Connection refused to dependency";
  if (/503|504|bad gateway/i.test(logExcerpt)) return "Upstream unavailable";
  return undefined;
}

async function runDocker(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("docker", args, { timeout: 8000, windowsHide: true, maxBuffer: 1024 * 1024 });
  return stdout ?? "";
}

export class DockerCliCollector implements IncidentCollector {
  public readonly id = "docker-cli";
  public readonly kind = "docker_service" as const;
  public readonly enabled: boolean;
  private readonly maxLogLines: number;

  public constructor(maxLogLines = 40) {
    this.maxLogLines = maxLogLines;
    const disabledByEnv = (process.env.DOCKER_COLLECTOR_ENABLED ?? "true").toLowerCase() === "false";
    this.enabled = !disabledByEnv;
  }

  public async collectIncidents(): Promise<Incident[]> {
    if (!this.enabled) return [];

    const services = await listDockerServices();
    const problematic = services.filter((service) => service.problematic);
    const incidents = await Promise.all(
      problematic.map(async (service) =>
        this.toIncident(service.id, service.name, service.status)
      )
    );
    return incidents.filter((incident): incident is Incident => Boolean(incident));
  }

  private async toIncident(containerId: string, name: string, status: string): Promise<Incident | null> {
    if (!containerId || !name) return null;
    const logExcerpt = await this.fetchLogs(containerId);
    return {
      id: `docker-${containerId}`,
      runtime: "docker",
      source: "docker-cli",
      service: name,
      severity: normalizeSeverity(status),
      timestamp: now(),
      summary: `Container ${name} in problematic state: ${status}`,
      probableCause: probableCauseFromLog(logExcerpt),
      rawExcerpt: logExcerpt
    };
  }

  private async fetchLogs(containerId: string): Promise<string> {
    try {
      const output = await runDocker(["logs", "--tail", String(this.maxLogLines), containerId]);
      const lines = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return lines.slice(-6).join("\n").slice(0, 2000);
    } catch (error: unknown) {
      return `Cannot read docker logs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

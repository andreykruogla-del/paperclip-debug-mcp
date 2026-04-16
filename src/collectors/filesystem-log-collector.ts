import { stat, readFile } from "node:fs/promises";
import { basename } from "node:path";

import type { IncidentCollector } from "../core/collector-interface.js";
import { redactSensitiveText } from "../core/redaction.js";
import type { Incident, IncidentSeverity } from "../core/types.js";

type FileCollectorOptions = {
  enabled?: boolean;
  paths?: string[];
  maxLines?: number;
  includePattern?: string;
};

function parsePaths(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function severityFromLine(line: string): IncidentSeverity {
  if (/fatal|panic|critical|out of memory|oom/i.test(line)) return "critical";
  if (/error|exception|failed|unauthor|forbidden|refused/i.test(line)) return "error";
  return "warning";
}

function causeFromLine(line: string): string | undefined {
  if (/429|rate limit/i.test(line)) return "Provider rate limit";
  if (/401|403|unauthor/i.test(line)) return "Authorization problem";
  if (/timeout|timed out/i.test(line)) return "Timeout in dependency chain";
  if (/refused|econnrefused/i.test(line)) return "Connection refused to dependency";
  if (/503|504|bad gateway/i.test(line)) return "Upstream unavailable";
  return undefined;
}

export class FileSystemLogCollector implements IncidentCollector {
  public readonly id = "filesystem-log";
  public readonly kind = "external" as const;
  public readonly enabled: boolean;
  private readonly paths: string[];
  private readonly maxLines: number;
  private readonly includeRegex: RegExp;

  public constructor(options?: FileCollectorOptions) {
    const envEnabled = (process.env.FILE_COLLECTOR_ENABLED ?? "false").toLowerCase() !== "false";
    this.enabled = options?.enabled ?? envEnabled;
    this.paths = options?.paths ?? parsePaths(process.env.FILE_COLLECTOR_PATHS);
    this.maxLines = Math.min(options?.maxLines ?? Number.parseInt(process.env.FILE_COLLECTOR_MAX_LINES ?? "300", 10), 5000);
    const pattern = options?.includePattern?.trim() || process.env.FILE_COLLECTOR_INCLUDE_PATTERN?.trim() || "error|exception|failed|timeout|refused|unauthor";
    this.includeRegex = new RegExp(pattern, "i");
  }

  public async collectIncidents(): Promise<Incident[]> {
    if (!this.enabled || this.paths.length === 0) return [];
    const incidents: Incident[] = [];
    for (const path of this.paths) {
      incidents.push(...(await this.collectFromPath(path)));
    }
    return incidents.sort((a, b) => b.timestamp - a.timestamp);
  }

  private async collectFromPath(path: string): Promise<Incident[]> {
    let stats;
    try {
      stats = await stat(path);
    } catch {
      return [];
    }
    if (!stats.isFile()) return [];

    const body = await readFile(path, "utf-8");
    const lines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(-this.maxLines);
    const service = basename(path).replace(/\.(log|txt|out)$/i, "");

    const incidents: Incident[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line || !this.includeRegex.test(line)) continue;
      const lineNo = i + 1;
      const lineTimestamp = Math.max(0, Math.floor(stats.mtimeMs) - (lines.length - lineNo));
      incidents.push({
        id: `file-${service}-${lineNo}-${stats.mtimeMs}`,
        runtime: "host",
        source: "filesystem-log",
        service,
        severity: severityFromLine(line),
        timestamp: lineTimestamp,
        summary: `Matched "${this.includeRegex.source}" in ${service} log`,
        probableCause: causeFromLine(line),
        rawExcerpt: redactSensitiveText(line)
      });
    }
    return incidents;
  }
}

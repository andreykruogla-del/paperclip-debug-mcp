import { readFile, stat } from "node:fs/promises";

import { redactSensitiveText } from "../core/redaction.js";

export type CaddyHealthResult = {
  configured: boolean;
  healthUrl?: string;
  reachable: boolean;
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
  logPath?: string;
  logErrorCount?: number;
  lastErrorLine?: string;
  logReadError?: string;
};

type CaddyClientOptions = {
  healthUrl?: string;
  logPath?: string;
  logTailLines?: number;
};

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

export class CaddyClient {
  private readonly healthUrl: string;
  private readonly logPath: string;
  private readonly logTailLines: number;

  public constructor(options?: CaddyClientOptions) {
    this.healthUrl = trim(options?.healthUrl ?? process.env.CADDY_HEALTH_URL);
    this.logPath = trim(options?.logPath ?? process.env.CADDY_LOG_PATH);
    this.logTailLines = Math.min(
      Math.max(Number.parseInt(trim(String(options?.logTailLines ?? process.env.CADDY_LOG_TAIL_LINES ?? "200")), 10) || 200, 20),
      5000
    );
  }

  public isEnabled(): boolean {
    return this.healthUrl.length > 0 || this.logPath.length > 0;
  }

  public async checkHealth(): Promise<CaddyHealthResult> {
    const result: CaddyHealthResult = {
      configured: this.isEnabled(),
      healthUrl: this.healthUrl || undefined,
      logPath: this.logPath || undefined,
      reachable: false
    };
    if (!this.isEnabled()) return result;

    if (this.healthUrl) {
      const started = Date.now();
      try {
        const response = await fetch(this.healthUrl, { method: "GET" });
        result.reachable = response.ok;
        result.statusCode = response.status;
        result.responseTimeMs = Date.now() - started;
        if (!response.ok) {
          const body = await response.text();
          result.error = redactSensitiveText(`HTTP ${response.status}: ${body.slice(0, 180)}`);
        }
      } catch (error: unknown) {
        result.reachable = false;
        result.responseTimeMs = Date.now() - started;
        result.error = redactSensitiveText(error instanceof Error ? error.message : String(error));
      }
    }

    if (this.logPath) {
      try {
        const stats = await stat(this.logPath);
        if (stats.isFile()) {
          const content = await readFile(this.logPath, "utf-8");
          const lines = content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .slice(-this.logTailLines);
          const bad = lines.filter((line) =>
            /(error|failed|tls|certificate|bad gateway|upstream|502|503|504|timeout|refused)/i.test(line)
          );
          result.logErrorCount = bad.length;
          result.lastErrorLine = bad.length > 0 ? redactSensitiveText(bad[bad.length - 1]) : undefined;
        }
      } catch (error: unknown) {
        result.logReadError = redactSensitiveText(error instanceof Error ? error.message : String(error));
      }
    }

    return result;
  }
}

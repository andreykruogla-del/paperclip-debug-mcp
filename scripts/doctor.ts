import "dotenv/config";

import { CaddyHealthCollector } from "../src/collectors/caddy-health-collector.js";
import { DockerCliCollector } from "../src/collectors/docker-cli-collector.js";
import { FileSystemLogCollector } from "../src/collectors/filesystem-log-collector.js";
import { K8sHealthCollector } from "../src/collectors/k8s-health-collector.js";
import { PaperclipApiCollector } from "../src/collectors/paperclip-api-collector.js";
import { PostgresHealthCollector } from "../src/collectors/postgres-health-collector.js";
import { RedisHealthCollector } from "../src/collectors/redis-health-collector.js";
import { SentryHealthCollector } from "../src/collectors/sentry-health-collector.js";
import { WordPressHealthCollector } from "../src/collectors/wordpress-health-collector.js";
import { prioritizeIncidents } from "../src/core/incident-priority.js";
import { CollectorRegistry } from "../src/core/registry.js";
import { readRuntimeConfig } from "../src/core/runtime-config.js";
import { classifyPaperclipError, PaperclipApiClient } from "../src/integrations/paperclip-client.js";
import { listIssues } from "../src/integrations/paperclip-issues.js";
import { listRuns } from "../src/integrations/paperclip-runs.js";

type PaperclipPreflightStatus = "ok" | "degraded" | "not_configured";
type PaperclipCheckStatus = "ok" | "error" | "skipped";

type PaperclipPreflightCheck = {
  status: PaperclipCheckStatus;
  sourcePath?: string;
  count?: number;
  errorCategory?: string;
  httpStatus?: number;
  remediation?: string;
};

type PaperclipIssuePreflightCheck = PaperclipPreflightCheck & {
  reason?: string;
};

async function runPaperclipPreflight(): Promise<{
  status: PaperclipPreflightStatus;
  configured: boolean;
  missing: string[];
  checks: {
    runs: PaperclipPreflightCheck;
    issues: PaperclipIssuePreflightCheck;
  };
}> {
  const baseUrl = process.env.PAPERCLIP_BASE_URL?.trim();
  const token = process.env.PAPERCLIP_TOKEN?.trim();
  const companyId = process.env.PAPERCLIP_COMPANY_ID?.trim();
  const projectId = process.env.PAPERCLIP_PROJECT_ID?.trim();

  const missing: string[] = [];
  if (!baseUrl) missing.push("PAPERCLIP_BASE_URL");
  if (!token) missing.push("PAPERCLIP_TOKEN");

  const preflight: {
    status: PaperclipPreflightStatus;
    configured: boolean;
    missing: string[];
    checks: {
      runs: PaperclipPreflightCheck;
      issues: PaperclipIssuePreflightCheck;
    };
  } = {
    status: "not_configured" as PaperclipPreflightStatus,
    configured: missing.length === 0,
    missing,
    checks: {
      runs: {
        status: "skipped",
        remediation: "Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN to validate run endpoints."
      },
      issues: {
        status: "skipped",
        reason: "PAPERCLIP_COMPANY_ID is not set",
        remediation:
          "Set PAPERCLIP_COMPANY_ID (and optional PAPERCLIP_PROJECT_ID) to validate issue endpoints."
      }
    }
  };

  if (missing.length > 0) {
    return preflight;
  }

  const client = new PaperclipApiClient({ baseUrl, token });
  let hasError = false;

  try {
    const { runs, sourcePath } = await listRuns(client, 5);
    preflight.checks.runs = {
      status: "ok",
      sourcePath,
      count: runs.length
    };
  } catch (error: unknown) {
    hasError = true;
    const normalized = classifyPaperclipError(error);
    const remediation =
      normalized.category === "auth_failure"
        ? "Verify PAPERCLIP_TOKEN is valid for this Paperclip deployment."
        : normalized.category === "endpoint_mismatch"
          ? "Verify PAPERCLIP_BASE_URL matches the deployment API routes used by this repository."
          : "Verify Paperclip API connectivity and retry validation.";
    preflight.checks.runs = {
      status: "error",
      errorCategory: normalized.category,
      httpStatus: normalized.status,
      remediation
    };
  }

  if (companyId) {
    try {
      const { issues, sourcePath } = await listIssues(client, companyId, projectId, 5, undefined);
      preflight.checks.issues = {
        status: "ok",
        sourcePath,
        count: issues.length
      };
    } catch (error: unknown) {
      hasError = true;
      const normalized = classifyPaperclipError(error);
      const remediation =
        normalized.category === "auth_failure"
          ? "Verify PAPERCLIP_TOKEN and PAPERCLIP_COMPANY_ID permissions for issue access."
          : normalized.category === "endpoint_mismatch"
            ? "Verify issue endpoint compatibility for this deployment base URL/company path."
            : "Verify Paperclip issue endpoint connectivity and retry validation.";
      preflight.checks.issues = {
        status: "error",
        errorCategory: normalized.category,
        httpStatus: normalized.status,
        remediation
      };
    }
  }

  preflight.status = hasError ? "degraded" : "ok";
  return preflight;
}

async function main(): Promise<void> {
  const runtimeConfig = readRuntimeConfig();
  const registry = new CollectorRegistry();
  registry.register(
    new PaperclipApiCollector({
      enabled: runtimeConfig.enablePaperclipCollector,
      maxIssues: runtimeConfig.paperclipMaxIssues
    })
  );
  registry.register(new DockerCliCollector(40, runtimeConfig.enableDockerCollector));
  registry.register(new CaddyHealthCollector({ enabled: runtimeConfig.enableCaddyCollector }));
  registry.register(new SentryHealthCollector({ enabled: runtimeConfig.enableSentryCollector }));
  registry.register(new K8sHealthCollector({ enabled: runtimeConfig.enableK8sCollector }));
  registry.register(new PostgresHealthCollector({ enabled: runtimeConfig.enablePostgresCollector }));
  registry.register(new RedisHealthCollector({ enabled: runtimeConfig.enableRedisCollector }));
  registry.register(
    new FileSystemLogCollector({
      enabled: runtimeConfig.enableFileCollector,
      maxLines: runtimeConfig.fileCollectorMaxLines,
      includePattern: runtimeConfig.fileCollectorPattern
    })
  );
  registry.register(new WordPressHealthCollector({ enabled: runtimeConfig.enableWordpressCollector }));

  const refreshed = await registry.refreshCollectors();
  const incidents = refreshed.flatMap((item) => item.incidents);
  const prioritized = prioritizeIncidents(incidents, 20);
  const paperclipPreflight = await runPaperclipPreflight();

  const output = {
    at: new Date().toISOString(),
    runtimeConfig,
    paperclipPreflight,
    collectors: refreshed.map(({ incidents: _incidents, ...meta }) => meta),
    summary: {
      incidents: incidents.length,
      highOrCritical: prioritized.filter((item) => item.priorityBand === "high" || item.priorityBand === "critical").length
    },
    topIncidents: prioritized.slice(0, 5)
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

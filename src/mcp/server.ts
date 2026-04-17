import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { CaddyHealthCollector } from "../collectors/caddy-health-collector.js";
import { DockerCliCollector } from "../collectors/docker-cli-collector.js";
import { FileSystemLogCollector } from "../collectors/filesystem-log-collector.js";
import { K8sHealthCollector } from "../collectors/k8s-health-collector.js";
import { PaperclipApiCollector } from "../collectors/paperclip-api-collector.js";
import { PostgresHealthCollector } from "../collectors/postgres-health-collector.js";
import { RedisHealthCollector } from "../collectors/redis-health-collector.js";
import { SentryHealthCollector } from "../collectors/sentry-health-collector.js";
import { WordPressHealthCollector } from "../collectors/wordpress-health-collector.js";
import { CollectorRegistry } from "../core/registry.js";
import { clusterIncidents } from "../core/incident-analysis.js";
import { buildIncidentTrends } from "../core/incident-trends.js";
import { buildHandoffTraces } from "../core/handoff-trace.js";
import { buildIncidentPacket } from "../core/incident-packet.js";
import { prioritizeIncidents } from "../core/incident-priority.js";
import { readRuntimeConfig } from "../core/runtime-config.js";
import {
  buildIncidentPacketGuidance,
  buildIssueCommentsTriageGuidance,
  buildListIssuesTriageGuidance,
  buildPrioritizeTriageGuidance,
  buildRunEventsTriageGuidance,
  buildSystemSnapshotTriageGuidance,
  buildTraceHandoffTriageGuidance
} from "../core/triage-guidance.js";
import {
  classifyPaperclipError,
  PaperclipApiClient,
  firstString
} from "../integrations/paperclip-client.js";
import { getRunEvents, listRuns } from "../integrations/paperclip-runs.js";
import { getDockerServiceLogs, listDockerServices } from "../integrations/docker-services.js";
import { getIssueComments, listIssues } from "../integrations/paperclip-issues.js";
import { CaddyClient } from "../integrations/caddy-client.js";
import { K8sClient } from "../integrations/k8s-client.js";
import { PostgresClient } from "../integrations/postgres-client.js";
import { RedisClient } from "../integrations/redis-client.js";
import { SentryClient } from "../integrations/sentry-client.js";
import { WordPressClient } from "../integrations/wordpress-client.js";

type AdapterUnavailablePayload = {
  configured: false;
  reachable: false;
  error: string;
  remediation: string;
};

type PaperclipToolErrorPayload = {
  error: string;
  errorType:
    | "paperclip_not_configured"
    | "paperclip_auth_failure"
    | "paperclip_endpoint_mismatch"
    | "paperclip_http_error"
    | "paperclip_connectivity_failure"
    | "paperclip_request_failure"
    | "paperclip_missing_company_id";
  source: "paperclip-api";
  operation: string;
  httpStatus?: number;
  path?: string;
  attemptedPaths?: string[];
  remediation: string;
};

function asToolResponse<TPayload extends Record<string, unknown>>(payload: TPayload): {
  structuredContent: TPayload;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    structuredContent: payload,
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
  };
}

function adapterNotConfigured(error: string, remediation: string): AdapterUnavailablePayload {
  return {
    configured: false,
    reachable: false,
    error,
    remediation
  };
}

function adapterUnavailableOnError(params: {
  configured?: boolean;
  remediation: string;
  error: unknown;
}): {
  configured: boolean;
  reachable: false;
  error: string;
  remediation: string;
} {
  const message = params.error instanceof Error ? params.error.message : String(params.error);
  return {
    configured: params.configured ?? true,
    reachable: false,
    error: message,
    remediation: params.remediation
  };
}

function paperclipNotConfiguredPayload(operation: string): PaperclipToolErrorPayload {
  return {
    error: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN.",
    errorType: "paperclip_not_configured",
    source: "paperclip-api",
    operation,
    remediation: "Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN, then retry."
  };
}

function paperclipMissingCompanyIdPayload(operation: string): PaperclipToolErrorPayload {
  return {
    error: "PAPERCLIP_COMPANY_ID is required for list_issues.",
    errorType: "paperclip_missing_company_id",
    source: "paperclip-api",
    operation,
    remediation: "Set PAPERCLIP_COMPANY_ID (and optional PAPERCLIP_PROJECT_ID), then retry."
  };
}

function paperclipFailurePayload(operation: string, error: unknown): PaperclipToolErrorPayload {
  const normalized = classifyPaperclipError(error);
  const remediation =
    normalized.category === "auth_failure"
      ? "Verify PAPERCLIP_TOKEN validity and deployment permissions."
      : normalized.category === "endpoint_mismatch"
        ? "Verify PAPERCLIP_BASE_URL and endpoint compatibility for this deployment."
        : normalized.category === "connectivity_failure"
          ? "Verify Paperclip API reachability/network path and retry."
          : "Verify Paperclip deployment availability and retry.";

  const errorType: PaperclipToolErrorPayload["errorType"] =
    normalized.category === "auth_failure"
      ? "paperclip_auth_failure"
      : normalized.category === "endpoint_mismatch"
        ? "paperclip_endpoint_mismatch"
        : normalized.category === "http_error"
          ? "paperclip_http_error"
          : normalized.category === "connectivity_failure"
            ? "paperclip_connectivity_failure"
            : "paperclip_request_failure";

  return {
    error: normalized.message,
    errorType,
    source: "paperclip-api",
    operation,
    httpStatus: normalized.status,
    path: normalized.path,
    attemptedPaths: normalized.attemptedPaths,
    remediation
  };
}

export function createMcpServer(): McpServer {
  const runtimeConfig = readRuntimeConfig();
  const registry = new CollectorRegistry();
  registry.register(
    new PaperclipApiCollector({
      enabled: runtimeConfig.enablePaperclipCollector,
      maxIssues: runtimeConfig.paperclipMaxIssues
    })
  );
  registry.register(new DockerCliCollector(40, runtimeConfig.enableDockerCollector));
  registry.register(
    new CaddyHealthCollector({
      enabled: runtimeConfig.enableCaddyCollector
    })
  );
  registry.register(
    new SentryHealthCollector({
      enabled: runtimeConfig.enableSentryCollector
    })
  );
  registry.register(
    new K8sHealthCollector({
      enabled: runtimeConfig.enableK8sCollector
    })
  );
  registry.register(
    new PostgresHealthCollector({
      enabled: runtimeConfig.enablePostgresCollector
    })
  );
  registry.register(
    new RedisHealthCollector({
      enabled: runtimeConfig.enableRedisCollector
    })
  );
  registry.register(
    new FileSystemLogCollector({
      enabled: runtimeConfig.enableFileCollector,
      maxLines: runtimeConfig.fileCollectorMaxLines,
      includePattern: runtimeConfig.fileCollectorPattern
    })
  );
  registry.register(
    new WordPressHealthCollector({
      enabled: runtimeConfig.enableWordpressCollector
    })
  );
  const paperclipClient = new PaperclipApiClient();
  const caddyClient = new CaddyClient();
  const k8sClient = new K8sClient();
  const postgresClient = new PostgresClient();
  const redisClient = new RedisClient();
  const sentryClient = new SentryClient();
  const wordpressClient = new WordPressClient();
  const paperclipCompanyId = firstString(process.env.PAPERCLIP_COMPANY_ID);
  const paperclipProjectId = firstString(process.env.PAPERCLIP_PROJECT_ID);

  const server = new McpServer(
    {
      name: "paperclip-debug-mcp",
      version: "0.1.0"
    },
    {
      instructions:
        "Paperclip Debug MCP exposes normalized incidents and collector health. " +
        "Use list_collectors first, then list_incidents."
    }
  );

  server.registerTool(
    "paperclipDebug.get_runtime_config",
    {
      title: "Get runtime config",
      description: "Returns sanitized runtime config and capability flags.",
      inputSchema: {}
    },
    async () => ({
      structuredContent: runtimeConfig,
      content: [{ type: "text", text: JSON.stringify(runtimeConfig, null, 2) }]
    })
  );

  server.registerTool(
    "paperclipDebug.list_collectors",
    {
      title: "List collectors",
      description: "Returns enabled collectors and their kinds.",
      inputSchema: {}
    },
    async () => {
      const collectors = registry.listStatuses();
      return {
        structuredContent: { collectors },
        content: [{ type: "text", text: JSON.stringify({ collectors }, null, 2) }]
      };
    }
  );

  server.registerTool(
    "paperclipDebug.caddy_health",
    {
      title: "Caddy health check",
      description: "Runs Caddy endpoint and optional log-file checks.",
      inputSchema: {}
    },
    async () => {
      if (!caddyClient.isEnabled()) {
        return asToolResponse(
          adapterNotConfigured(
            "Caddy is not configured. Set CADDY_HEALTH_URL or CADDY_LOG_PATH.",
            "Set CADDY_HEALTH_URL or CADDY_LOG_PATH, then rerun paperclipDebug.caddy_health."
          )
        );
      }
      try {
        const payload = await caddyClient.checkHealth();
        return asToolResponse(payload);
      } catch (error: unknown) {
        return asToolResponse(
          adapterUnavailableOnError({
            configured: true,
            error,
            remediation:
              "Verify Caddy endpoint/log accessibility and retry paperclipDebug.caddy_health."
          })
        );
      }
    }
  );

  server.registerTool(
    "paperclipDebug.k8s_health",
    {
      title: "Kubernetes health check",
      description: "Runs kubectl-based namespace diagnostics for problematic pods.",
      inputSchema: {}
    },
    async () => {
      if (!runtimeConfig.enableK8sCollector && !runtimeConfig.hasK8sNamespace) {
        return asToolResponse(
          adapterNotConfigured(
            "Kubernetes is not configured. Set K8S_COLLECTOR_ENABLED=true and K8S_NAMESPACE.",
            "Set K8S_COLLECTOR_ENABLED=true and K8S_NAMESPACE, then rerun paperclipDebug.k8s_health."
          )
        );
      }
      try {
        const payload = await k8sClient.checkHealth();
        return asToolResponse(payload);
      } catch (error: unknown) {
        return asToolResponse(
          adapterUnavailableOnError({
            configured: true,
            error,
            remediation:
              "Verify kubectl access to the target namespace and retry paperclipDebug.k8s_health."
          })
        );
      }
    }
  );

  server.registerTool(
    "paperclipDebug.postgres_health",
    {
      title: "PostgreSQL health check",
      description: "Runs read-only PostgreSQL diagnostics for locks/long-running queries/replication lag.",
      inputSchema: {}
    },
    async () => {
      if (!postgresClient.isEnabled()) {
        return asToolResponse(
          adapterNotConfigured(
            "PostgreSQL is not configured. Set POSTGRES_COLLECTOR_ENABLED=true and POSTGRES_URL.",
            "Set POSTGRES_COLLECTOR_ENABLED=true and POSTGRES_URL, then rerun paperclipDebug.postgres_health."
          )
        );
      }
      try {
        const payload = await postgresClient.checkHealth();
        return asToolResponse(payload);
      } catch (error: unknown) {
        return asToolResponse(
          adapterUnavailableOnError({
            configured: true,
            error,
            remediation:
              "Verify PostgreSQL connectivity/credentials and retry paperclipDebug.postgres_health."
          })
        );
      }
    }
  );

  server.registerTool(
    "paperclipDebug.redis_health",
    {
      title: "Redis health check",
      description: "Runs read-only Redis diagnostics for latency/memory/eviction signals.",
      inputSchema: {}
    },
    async () => {
      if (!redisClient.isEnabled()) {
        return asToolResponse(
          adapterNotConfigured(
            "Redis is not configured. Set REDIS_COLLECTOR_ENABLED=true and REDIS_URL.",
            "Set REDIS_COLLECTOR_ENABLED=true and REDIS_URL, then rerun paperclipDebug.redis_health."
          )
        );
      }
      try {
        const payload = await redisClient.checkHealth();
        return asToolResponse(payload);
      } catch (error: unknown) {
        return asToolResponse(
          adapterUnavailableOnError({
            configured: true,
            error,
            remediation:
              "Verify Redis connectivity/credentials and retry paperclipDebug.redis_health."
          })
        );
      }
    }
  );

  server.registerTool(
    "paperclipDebug.sentry_health",
    {
      title: "Sentry health check",
      description: "Runs Sentry unresolved issue diagnostic check.",
      inputSchema: {}
    },
    async () => {
      if (!sentryClient.isEnabled()) {
        return asToolResponse(
          adapterNotConfigured(
            "Sentry is not configured. Set SENTRY_ORG_SLUG, SENTRY_PROJECT_SLUG, SENTRY_AUTH_TOKEN.",
            "Set SENTRY_ORG_SLUG, SENTRY_PROJECT_SLUG, and SENTRY_AUTH_TOKEN, then rerun paperclipDebug.sentry_health."
          )
        );
      }
      try {
        const payload = await sentryClient.checkHealth(20);
        return asToolResponse(payload);
      } catch (error: unknown) {
        return asToolResponse(
          adapterUnavailableOnError({
            configured: true,
            error,
            remediation:
              "Verify Sentry API access and retry paperclipDebug.sentry_health."
          })
        );
      }
    }
  );

  server.registerTool(
    "paperclipDebug.wordpress_health",
    {
      title: "WordPress health check",
      description: "Runs direct WordPress checks for REST availability, XML-RPC, and optional auth.",
      inputSchema: {}
    },
    async () => {
      if (!wordpressClient.isEnabled()) {
        return asToolResponse(
          adapterNotConfigured(
            "WordPress is not configured. Set WORDPRESS_BASE_URL.",
            "Set WORDPRESS_BASE_URL and rerun paperclipDebug.wordpress_health."
          )
        );
      }
      try {
        const payload = await wordpressClient.checkHealth();
        return asToolResponse(payload);
      } catch (error: unknown) {
        return asToolResponse(
          adapterUnavailableOnError({
            configured: true,
            error,
            remediation:
              "Verify WordPress endpoint accessibility and retry paperclipDebug.wordpress_health."
          })
        );
      }
    }
  );

  server.registerTool(
    "paperclipDebug.refresh_collectors",
    {
      title: "Refresh collectors",
      description: "Runs all enabled collectors and returns per-collector incident counts and errors.",
      inputSchema: {}
    },
    async () => {
      const results = await registry.refreshCollectors();
      const payload = {
        collectors: results.map(({ incidents, ...meta }) => meta),
        totalIncidents: results.reduce((sum, item) => sum + item.incidentCount, 0),
        activeCollectors: results.filter((item) => item.enabled).length,
        failedCollectors: results.filter((item) => Boolean(item.lastError)).length
      };
      return {
        structuredContent: payload,
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
      };
    }
  );

  server.registerTool(
    "paperclipDebug.list_incidents",
    {
      title: "List incidents",
      description: "Returns normalized incidents from all enabled collectors.",
      inputSchema: {
        limit: z.number().int().positive().max(500).optional()
      }
    },
    async ({ limit }) => {
      const incidents = await registry.collectAllIncidents();
      const cut = incidents.slice(0, limit ?? 50);
      return {
        structuredContent: { incidents: cut, total: incidents.length },
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: incidents.length, incidents: cut }, null, 2)
          }
        ]
      };
    }
  );

  server.registerTool(
    "paperclipDebug.list_incident_clusters",
    {
      title: "List incident clusters",
      description:
        "Returns deduplicated incident clusters grouped by fingerprint, sorted by impact.",
      inputSchema: {
        limit: z.number().int().positive().max(200).optional()
      }
    },
    async ({ limit }) => {
      const incidents = await registry.collectAllIncidents();
      const clusters = clusterIncidents(incidents).slice(0, limit ?? 20);
      return {
        structuredContent: { clusters, totalClusters: clusters.length, totalIncidents: incidents.length },
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { totalIncidents: incidents.length, totalClusters: clusters.length, clusters },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.registerTool(
    "paperclipDebug.incident_trends",
    {
      title: "Incident trends",
      description: "Returns incident trend buckets for the selected time window.",
      inputSchema: {
        windowHours: z.number().int().positive().max(24 * 14).optional(),
        bucketMinutes: z.number().int().positive().max(24 * 60).optional()
      }
    },
    async ({ windowHours, bucketMinutes }) => {
      const incidents = await registry.collectAllIncidents();
      const trends = buildIncidentTrends(incidents, { windowHours, bucketMinutes });
      return {
        structuredContent: trends,
        content: [{ type: "text", text: JSON.stringify(trends, null, 2) }]
      };
    }
  );

  server.registerTool(
    "paperclipDebug.prioritize_incidents",
    {
      title: "Prioritize incidents",
      description: "Ranks incidents by severity, recency, and likely operational impact.",
      inputSchema: {
        limit: z.number().int().positive().max(500).optional(),
        minBand: z.enum(["low", "medium", "high", "critical"]).optional()
      }
    },
    async ({ limit, minBand }) => {
      const incidents = await registry.collectAllIncidents();
      const prioritized = prioritizeIncidents(incidents, limit ?? 100);
      const bandRank: Record<"low" | "medium" | "high" | "critical", number> = {
        low: 0,
        medium: 1,
        high: 2,
        critical: 3
      };
      const filtered = minBand
        ? prioritized.filter((incident) => bandRank[incident.priorityBand] >= bandRank[minBand])
        : prioritized;
      const triageGuidance = buildPrioritizeTriageGuidance(filtered, minBand);
      return {
        structuredContent: {
          totalIncidents: incidents.length,
          returnedIncidents: filtered.length,
          incidents: filtered,
          summary: triageGuidance.summary,
          topSignals: triageGuidance.topSignals,
          recommendedNextTools: triageGuidance.recommendedNextTools,
          correlationHints: triageGuidance.correlationHints
        },
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalIncidents: incidents.length,
                returnedIncidents: filtered.length,
                incidents: filtered,
                summary: triageGuidance.summary,
                topSignals: triageGuidance.topSignals,
                recommendedNextTools: triageGuidance.recommendedNextTools,
                correlationHints: triageGuidance.correlationHints
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.registerTool(
    "paperclipDebug.trace_handoff",
    {
      title: "Trace handoff by run",
      description:
        "Builds run-level handoff traces from normalized incidents that have relatedRunId.",
      inputSchema: {
        runId: z.string().min(1).optional(),
        limit: z.number().int().positive().max(200).optional()
      }
    },
    async ({ runId, limit }) => {
      const incidents = await registry.collectAllIncidents();
      const traces = buildHandoffTraces(incidents);
      const filtered = runId ? traces.filter((trace) => trace.runId === runId) : traces;
      const cut = filtered.slice(0, limit ?? 30);
      const handoffGuidance = buildTraceHandoffTriageGuidance({
        traces: cut,
        requestedRunId: runId
      });
      return {
        structuredContent: {
          traces: cut,
          totalTraces: filtered.length,
          totalIncidents: incidents.length,
          summary: handoffGuidance.summary,
          topSignals: handoffGuidance.topSignals,
          recommendedNextTools: handoffGuidance.recommendedNextTools
        },
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalIncidents: incidents.length,
                totalTraces: filtered.length,
                traces: cut,
                summary: handoffGuidance.summary,
                topSignals: handoffGuidance.topSignals,
                recommendedNextTools: handoffGuidance.recommendedNextTools
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.registerTool(
    "paperclipDebug.list_runs",
    {
      title: "List runs",
      description: "Returns recent run summaries from Paperclip API.",
      inputSchema: {
        limit: z.number().int().positive().max(200).optional()
      }
    },
    async ({ limit }) => {
      if (!paperclipClient.isEnabled()) {
        return asToolResponse(paperclipNotConfiguredPayload("list_runs"));
      }

      try {
        const { runs, sourcePath } = await listRuns(paperclipClient, limit ?? 20, {
          companyId: paperclipCompanyId,
          projectId: paperclipProjectId
        });
        return {
          structuredContent: {
            sourcePath,
            totalRuns: runs.length,
            runs
          },
          content: [
            {
              type: "text",
              text: JSON.stringify({ sourcePath, totalRuns: runs.length, runs }, null, 2)
            }
          ]
        };
      } catch (error: unknown) {
        return asToolResponse(paperclipFailurePayload("list_runs", error));
      }
    }
  );

  server.registerTool(
    "paperclipDebug.list_issues",
    {
      title: "List issues",
      description: "Returns recent Paperclip issues for the configured company/project.",
      inputSchema: {
        limit: z.number().int().positive().max(200).optional(),
        status: z.string().min(1).optional()
      }
    },
    async ({ limit, status }) => {
      if (!paperclipClient.isEnabled()) {
        return asToolResponse(paperclipNotConfiguredPayload("list_issues"));
      }
      if (!paperclipCompanyId) {
        return asToolResponse(paperclipMissingCompanyIdPayload("list_issues"));
      }

      try {
        const { issues, sourcePath } = await listIssues(
          paperclipClient,
          paperclipCompanyId,
          paperclipProjectId,
          limit ?? 30,
          status
        );
        const issueGuidance = buildListIssuesTriageGuidance({
          issues,
          requestedStatus: status
        });
        return {
          structuredContent: {
            sourcePath,
            totalIssues: issues.length,
            issues,
            summary: issueGuidance.summary,
            topSignals: issueGuidance.topSignals,
            recommendedNextTools: issueGuidance.recommendedNextTools
          },
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sourcePath,
                  totalIssues: issues.length,
                  issues,
                  summary: issueGuidance.summary,
                  topSignals: issueGuidance.topSignals,
                  recommendedNextTools: issueGuidance.recommendedNextTools
                },
                null,
                2
              )
            }
          ]
        };
      } catch (error: unknown) {
        return asToolResponse(paperclipFailurePayload("list_issues", error));
      }
    }
  );

  server.registerTool(
    "paperclipDebug.get_issue_comments",
    {
      title: "Get issue comments",
      description: "Returns ordered comments for one issue id.",
      inputSchema: {
        issueId: z.string().min(1),
        limit: z.number().int().positive().max(2000).optional()
      }
    },
    async ({ issueId, limit }) => {
      if (!paperclipClient.isEnabled()) {
        return asToolResponse(paperclipNotConfiguredPayload("get_issue_comments"));
      }

      try {
        const { comments, sourcePath } = await getIssueComments(paperclipClient, issueId);
        const cut = comments.slice(0, limit ?? 300);
        const commentGuidance = buildIssueCommentsTriageGuidance({
          issueId,
          comments: cut
        });
        return {
          structuredContent: {
            issueId,
            sourcePath,
            totalComments: comments.length,
            comments: cut,
            summary: commentGuidance.summary,
            topSignals: commentGuidance.topSignals,
            recommendedNextTools: commentGuidance.recommendedNextTools
          },
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  issueId,
                  sourcePath,
                  totalComments: comments.length,
                  comments: cut,
                  summary: commentGuidance.summary,
                  topSignals: commentGuidance.topSignals,
                  recommendedNextTools: commentGuidance.recommendedNextTools
                },
                null,
                2
              )
            }
          ]
        };
      } catch (error: unknown) {
        return asToolResponse(paperclipFailurePayload("get_issue_comments", error));
      }
    }
  );

  server.registerTool(
    "paperclipDebug.get_run_events",
    {
      title: "Get run events",
      description: "Returns normalized events for a specific run id.",
      inputSchema: {
        runId: z.string().min(1),
        limit: z.number().int().positive().max(5000).optional()
      }
    },
    async ({ runId, limit }) => {
      if (!paperclipClient.isEnabled()) {
        return asToolResponse(paperclipNotConfiguredPayload("get_run_events"));
      }

      try {
        const { events, sourcePath } = await getRunEvents(paperclipClient, runId, {
          companyId: paperclipCompanyId,
          projectId: paperclipProjectId
        });
        const cut = events.slice(0, limit ?? 1000);
        const runGuidance = buildRunEventsTriageGuidance({
          runId,
          events: cut
        });
        return {
          structuredContent: {
            sourcePath,
            runId,
            totalEvents: events.length,
            events: cut,
            summary: runGuidance.summary,
            topSignals: runGuidance.topSignals,
            recommendedNextTools: runGuidance.recommendedNextTools
          },
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sourcePath,
                  runId,
                  totalEvents: events.length,
                  events: cut,
                  summary: runGuidance.summary,
                  topSignals: runGuidance.topSignals,
                  recommendedNextTools: runGuidance.recommendedNextTools
                },
                null,
                2
              )
            }
          ]
        };
      } catch (error: unknown) {
        return asToolResponse(paperclipFailurePayload("get_run_events", error));
      }
    }
  );

  server.registerTool(
    "paperclipDebug.list_services",
    {
      title: "List docker services",
      description: "Returns live Docker service/container snapshot with problematic markers.",
      inputSchema: {
        includeHealthy: z.boolean().optional()
      }
    },
    async ({ includeHealthy }) => {
      const services = await listDockerServices();
      const filtered = includeHealthy ? services : services.filter((service) => service.problematic);
      return {
        structuredContent: {
          totalServices: services.length,
          returnedServices: filtered.length,
          problematicServices: services.filter((service) => service.problematic).length,
          services: filtered
        },
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalServices: services.length,
                returnedServices: filtered.length,
                problematicServices: services.filter((service) => service.problematic).length,
                services: filtered
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.registerTool(
    "paperclipDebug.get_service_logs",
    {
      title: "Get service logs",
      description: "Returns redacted Docker logs for one container/service id or name.",
      inputSchema: {
        service: z.string().min(1),
        tail: z.number().int().positive().max(5000).optional()
      }
    },
    async ({ service, tail }) => {
      const result = await getDockerServiceLogs(service, tail ?? 200);
      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );

  server.registerTool(
    "paperclipDebug.build_incident_packet",
    {
      title: "Build incident packet",
      description:
        "Builds one evidence packet for investigation: issue, comments, run summary, run events, incidents, clusters.",
      inputSchema: {
        issueId: z.string().min(1).optional(),
        runId: z.string().min(1).optional(),
        runEventLimit: z.number().int().positive().max(5000).optional(),
        incidentLimit: z.number().int().positive().max(2000).optional()
      }
    },
    async ({ issueId, runId, runEventLimit, incidentLimit }) => {
      if (!paperclipClient.isEnabled()) {
        return asToolResponse(paperclipNotConfiguredPayload("build_incident_packet"));
      }
      if (!issueId && !runId) {
        return {
          structuredContent: { error: "Provide at least one: issueId or runId." },
          content: [{ type: "text", text: "Provide at least one: issueId or runId." }]
        };
      }

      try {
        const allIncidents = (await registry.collectAllIncidents()).slice(0, incidentLimit ?? 500);
        let resolvedIssueId = issueId;
        let resolvedRunId = runId;
        let issueData: Awaited<ReturnType<typeof listIssues>>["issues"][number] | undefined;
        let commentsData: Awaited<ReturnType<typeof getIssueComments>>["comments"] | undefined;
        let runSummary: Awaited<ReturnType<typeof listRuns>>["runs"][number] | undefined;
        let runEvents: Awaited<ReturnType<typeof getRunEvents>>["events"] | undefined;

        if (resolvedIssueId && paperclipCompanyId) {
          const { issues } = await listIssues(paperclipClient, paperclipCompanyId, paperclipProjectId, 100, undefined);
          issueData = issues.find((issue) => issue.issueId === resolvedIssueId);
          const commentsResult = await getIssueComments(paperclipClient, resolvedIssueId);
          commentsData = commentsResult.comments;
          resolvedRunId = resolvedRunId ?? issueData?.relatedRunId;
        }

        if (resolvedRunId) {
          const { runs } = await listRuns(paperclipClient, 200, {
            companyId: paperclipCompanyId,
            projectId: paperclipProjectId
          });
          runSummary = runs.find((run) => run.runId === resolvedRunId);
          const eventsResult = await getRunEvents(paperclipClient, resolvedRunId, {
            companyId: paperclipCompanyId,
            projectId: paperclipProjectId
          });
          runEvents = eventsResult.events.slice(0, runEventLimit ?? 1000);
        }

        const packet = buildIncidentPacket({
          issue: issueData,
          comments: commentsData,
          run: runSummary,
          runEvents,
          allIncidents
        });
        const packetGuidance = buildIncidentPacketGuidance({ packet });

        return {
          structuredContent: {
            packet,
            summary: {
              issueId: packet.issue?.issueId,
              runId: packet.run?.runId ?? packet.issue?.relatedRunId,
              comments: packet.comments?.length ?? 0,
              runEvents: packet.runEvents?.length ?? 0,
              relatedIncidents: packet.relatedIncidents.length,
              clusters: packet.clusters.length
            },
            topSignals: packetGuidance.topSignals,
            recommendedNextTools: packetGuidance.recommendedNextTools,
            packetReadiness: packetGuidance.packetReadiness,
            correlationHints: packetGuidance.correlationHints
          },
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  packet,
                  summary: {
                    issueId: packet.issue?.issueId,
                    runId: packet.run?.runId ?? packet.issue?.relatedRunId,
                    comments: packet.comments?.length ?? 0,
                    runEvents: packet.runEvents?.length ?? 0,
                    relatedIncidents: packet.relatedIncidents.length,
                    clusters: packet.clusters.length
                  },
                  topSignals: packetGuidance.topSignals,
                  recommendedNextTools: packetGuidance.recommendedNextTools,
                  packetReadiness: packetGuidance.packetReadiness,
                  correlationHints: packetGuidance.correlationHints
                },
                null,
                2
              )
            }
          ]
        };
      } catch (error: unknown) {
        return asToolResponse(paperclipFailurePayload("build_incident_packet", error));
      }
    }
  );

  server.registerTool(
    "paperclipDebug.system_snapshot",
    {
      title: "System snapshot",
      description:
        "Returns one high-level snapshot of collectors, incidents, services, runs, and issues.",
      inputSchema: {
        runLimit: z.number().int().positive().max(100).optional(),
        issueLimit: z.number().int().positive().max(100).optional()
      }
    },
    async ({ runLimit, issueLimit }) => {
      const collectors = registry.listStatuses();
      const incidents = await registry.collectAllIncidents();
      const prioritized = prioritizeIncidents(incidents, 20);
      const services = await listDockerServices();

      let runs: Awaited<ReturnType<typeof listRuns>>["runs"] = [];
      let issues: Awaited<ReturnType<typeof listIssues>>["issues"] = [];
      let paperclipError: string | undefined;

      if (paperclipClient.isEnabled()) {
        try {
          runs = (
            await listRuns(paperclipClient, runLimit ?? 20, {
              companyId: paperclipCompanyId,
              projectId: paperclipProjectId
            })
          ).runs;
          if (paperclipCompanyId) {
            issues = (await listIssues(
              paperclipClient,
              paperclipCompanyId,
              paperclipProjectId,
              issueLimit ?? 20,
              undefined
            )).issues;
          }
        } catch (error: unknown) {
          paperclipError = error instanceof Error ? error.message : String(error);
        }
      } else {
        paperclipError = "Paperclip API is not configured.";
      }

      const payload = {
        generatedAt: Date.now(),
        collectors,
        summary: {
          incidents: incidents.length,
          criticalOrHigh: prioritized.filter((item) => item.priorityBand === "critical" || item.priorityBand === "high").length,
          services: services.length,
          problematicServices: services.filter((service) => service.problematic).length,
          runs: runs.length,
          issues: issues.length
        },
        topIncidents: prioritized.slice(0, 10),
        services,
        runs,
        issues,
        paperclipError
      };
      const triageGuidance = buildSystemSnapshotTriageGuidance({
        collectors,
        summary: payload.summary,
        topIncidents: payload.topIncidents,
        services,
        paperclipError
      });

      return {
        structuredContent: {
          ...payload,
          topSignals: triageGuidance.topSignals,
          recommendedNextTools: triageGuidance.recommendedNextTools,
          correlationHints: triageGuidance.correlationHints
        },
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...payload,
                topSignals: triageGuidance.topSignals,
                recommendedNextTools: triageGuidance.recommendedNextTools,
                correlationHints: triageGuidance.correlationHints
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  return server;
}

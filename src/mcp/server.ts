import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { DockerCliCollector } from "../collectors/docker-cli-collector.js";
import { PaperclipApiCollector } from "../collectors/paperclip-api-collector.js";
import { CollectorRegistry } from "../core/registry.js";
import { clusterIncidents } from "../core/incident-analysis.js";
import { buildHandoffTraces } from "../core/handoff-trace.js";
import { buildIncidentPacket } from "../core/incident-packet.js";
import { prioritizeIncidents } from "../core/incident-priority.js";
import { readRuntimeConfig } from "../core/runtime-config.js";
import { PaperclipApiClient, firstString } from "../integrations/paperclip-client.js";
import { getRunEvents, listRuns } from "../integrations/paperclip-runs.js";
import { getDockerServiceLogs, listDockerServices } from "../integrations/docker-services.js";
import { getIssueComments, listIssues } from "../integrations/paperclip-issues.js";

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
  const paperclipClient = new PaperclipApiClient();
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
      return {
        structuredContent: {
          totalIncidents: incidents.length,
          returnedIncidents: filtered.length,
          incidents: filtered
        },
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalIncidents: incidents.length,
                returnedIncidents: filtered.length,
                incidents: filtered
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
      return {
        structuredContent: {
          traces: cut,
          totalTraces: filtered.length,
          totalIncidents: incidents.length
        },
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalIncidents: incidents.length,
                totalTraces: filtered.length,
                traces: cut
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
        return {
          structuredContent: {
            error: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN."
          },
          content: [
            {
              type: "text",
              text: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN."
            }
          ]
        };
      }

      const { runs, sourcePath } = await listRuns(paperclipClient, limit ?? 20);
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
        return {
          structuredContent: { error: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN." },
          content: [{ type: "text", text: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN." }]
        };
      }
      if (!paperclipCompanyId) {
        return {
          structuredContent: { error: "PAPERCLIP_COMPANY_ID is required for list_issues." },
          content: [{ type: "text", text: "PAPERCLIP_COMPANY_ID is required for list_issues." }]
        };
      }

      const { issues, sourcePath } = await listIssues(
        paperclipClient,
        paperclipCompanyId,
        paperclipProjectId,
        limit ?? 30,
        status
      );
      return {
        structuredContent: { sourcePath, totalIssues: issues.length, issues },
        content: [{ type: "text", text: JSON.stringify({ sourcePath, totalIssues: issues.length, issues }, null, 2) }]
      };
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
        return {
          structuredContent: { error: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN." },
          content: [{ type: "text", text: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN." }]
        };
      }

      const { comments, sourcePath } = await getIssueComments(paperclipClient, issueId);
      const cut = comments.slice(0, limit ?? 300);
      return {
        structuredContent: { issueId, sourcePath, totalComments: comments.length, comments: cut },
        content: [{ type: "text", text: JSON.stringify({ issueId, sourcePath, totalComments: comments.length, comments: cut }, null, 2) }]
      };
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
        return {
          structuredContent: {
            error: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN."
          },
          content: [
            {
              type: "text",
              text: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN."
            }
          ]
        };
      }

      const { events, sourcePath } = await getRunEvents(paperclipClient, runId);
      const cut = events.slice(0, limit ?? 1000);
      return {
        structuredContent: {
          sourcePath,
          runId,
          totalEvents: events.length,
          events: cut
        },
        content: [
          {
            type: "text",
            text: JSON.stringify({ sourcePath, runId, totalEvents: events.length, events: cut }, null, 2)
          }
        ]
      };
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
        return {
          structuredContent: { error: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN." },
          content: [{ type: "text", text: "Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN." }]
        };
      }
      if (!issueId && !runId) {
        return {
          structuredContent: { error: "Provide at least one: issueId or runId." },
          content: [{ type: "text", text: "Provide at least one: issueId or runId." }]
        };
      }

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
        const { runs } = await listRuns(paperclipClient, 200);
        runSummary = runs.find((run) => run.runId === resolvedRunId);
        const eventsResult = await getRunEvents(paperclipClient, resolvedRunId);
        runEvents = eventsResult.events.slice(0, runEventLimit ?? 1000);
      }

      const packet = buildIncidentPacket({
        issue: issueData,
        comments: commentsData,
        run: runSummary,
        runEvents,
        allIncidents
      });

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
          }
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
                }
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
          runs = (await listRuns(paperclipClient, runLimit ?? 20)).runs;
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

      return {
        structuredContent: payload,
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
      };
    }
  );

  return server;
}

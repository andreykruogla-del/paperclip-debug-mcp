import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { DockerCliCollector } from "../collectors/docker-cli-collector.js";
import { PaperclipApiCollector } from "../collectors/paperclip-api-collector.js";
import { CollectorRegistry } from "../core/registry.js";
import { clusterIncidents } from "../core/incident-analysis.js";
import { buildHandoffTraces } from "../core/handoff-trace.js";
import { PaperclipApiClient } from "../integrations/paperclip-client.js";
import { getRunEvents, listRuns } from "../integrations/paperclip-runs.js";
import { listDockerServices } from "../integrations/docker-services.js";

export function createMcpServer(): McpServer {
  const registry = new CollectorRegistry();
  registry.register(new PaperclipApiCollector());
  registry.register(new DockerCliCollector());
  const paperclipClient = new PaperclipApiClient();

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

  return server;
}

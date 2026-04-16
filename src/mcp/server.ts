import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { DockerCliCollector } from "../collectors/docker-cli-collector.js";
import { PaperclipApiCollector } from "../collectors/paperclip-api-collector.js";
import { CollectorRegistry } from "../core/registry.js";
import { clusterIncidents } from "../core/incident-analysis.js";
import { buildHandoffTraces } from "../core/handoff-trace.js";

export function createMcpServer(): McpServer {
  const registry = new CollectorRegistry();
  registry.register(new PaperclipApiCollector());
  registry.register(new DockerCliCollector());

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

  return server;
}

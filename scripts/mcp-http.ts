import "dotenv/config";

import { randomUUID } from "node:crypto";

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createMcpServer } from "../src/mcp/server.js";

type TransportMap = Record<string, StreamableHTTPServerTransport>;

type HeaderCarrier = {
  headers: Record<string, unknown>;
};

function readAuthToken(): string | undefined {
  const raw = process.env.MCP_HTTP_AUTH_TOKEN?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

function isAuthorized(req: HeaderCarrier, expectedToken: string | undefined): boolean {
  if (!expectedToken) return true;
  const header = String(req.headers.authorization ?? "");
  if (!header.toLowerCase().startsWith("bearer ")) return false;
  const token = header.slice(7).trim();
  return token === expectedToken;
}

async function closeAllTransports(transports: TransportMap): Promise<void> {
  for (const sessionId of Object.keys(transports)) {
    try {
      await transports[sessionId]?.close();
    } catch {
      // ignore shutdown errors
    } finally {
      delete transports[sessionId];
    }
  }
}

async function main(): Promise<void> {
  const port = Number.parseInt(process.env.MCP_HTTP_PORT ?? "8787", 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid MCP_HTTP_PORT: ${process.env.MCP_HTTP_PORT}`);
  }

  const authToken = readAuthToken();
  const app = createMcpExpressApp();
  const transports: TransportMap = {};

  app.get("/healthz", (_req: any, res: any) => {
    res.status(200).json({
      ok: true,
      name: "paperclip-debug-mcp",
      mode: "http",
      auth: authToken ? "enabled" : "disabled",
      activeSessions: Object.keys(transports).length
    });
  });

  app.post("/mcp", async (req: any, res: any) => {
    if (!isAuthorized(req, authToken)) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null
      });
      return;
    }

    const sessionIdHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

    try {
      let transport: StreamableHTTPServerTransport | undefined;
      if (typeof sessionId === "string" && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          onsessioninitialized: (sid) => {
            transports[sid] = transport!;
          }
        });

        transport.onclose = () => {
          const sid = transport?.sessionId;
          if (sid) delete transports[sid];
        };

        const server = createMcpServer();
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided"
          },
          id: null
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error: unknown) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error)
          },
          id: null
        });
      }
    }
  });

  app.get("/mcp", async (req: any, res: any) => {
    if (!isAuthorized(req, authToken)) {
      res.status(401).send("Unauthorized");
      return;
    }

    const sessionIdHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    await transports[sessionId].handleRequest(req, res);
  });

  app.delete("/mcp", async (req: any, res: any) => {
    if (!isAuthorized(req, authToken)) {
      res.status(401).send("Unauthorized");
      return;
    }

    const sessionIdHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    await transports[sessionId].handleRequest(req, res);
  });

  const server = app.listen(port, (error?: Error) => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[paperclip-debug-mcp] failed to start http server: ${error.message}`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[paperclip-debug-mcp] http server listening on http://localhost:${port}/mcp (auth=${authToken ? "on" : "off"})`
    );
  });

  process.on("SIGINT", async () => {
    await closeAllTransports(transports);
    server.close();
    process.exit(0);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`[paperclip-debug-mcp] mcp:http fatal: ${message}`);
  process.exit(1);
});

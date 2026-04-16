export type RuntimeConfig = {
  enablePaperclipCollector: boolean;
  enableDockerCollector: boolean;
  enableFileCollector: boolean;
  fileCollectorPathsCount: number;
  fileCollectorMaxLines: number;
  fileCollectorPattern: string;
  mcpHttpPort: number;
  mcpHttpAuthEnabled: boolean;
  hasPaperclipBaseUrl: boolean;
  hasPaperclipToken: boolean;
  hasPaperclipCompanyId: boolean;
  hasPaperclipProjectId: boolean;
  paperclipMaxIssues: number;
};

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function readRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const mcpHttpPort = parsePositiveInt(env.MCP_HTTP_PORT, 8787);
  const fileCollectorPattern = env.FILE_COLLECTOR_INCLUDE_PATTERN?.trim() || "error|exception|failed|timeout|refused|unauthor";
  const fileCollectorPaths = (env.FILE_COLLECTOR_PATHS ?? "")
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return {
    enablePaperclipCollector: parseBoolean(env.PAPERCLIP_COLLECTOR_ENABLED, true),
    enableDockerCollector: parseBoolean(env.DOCKER_COLLECTOR_ENABLED, true),
    enableFileCollector: parseBoolean(env.FILE_COLLECTOR_ENABLED, false),
    fileCollectorPathsCount: fileCollectorPaths.length,
    fileCollectorMaxLines: Math.min(parsePositiveInt(env.FILE_COLLECTOR_MAX_LINES, 300), 5000),
    fileCollectorPattern,
    mcpHttpPort,
    mcpHttpAuthEnabled: Boolean(env.MCP_HTTP_AUTH_TOKEN && env.MCP_HTTP_AUTH_TOKEN.trim().length > 0),
    hasPaperclipBaseUrl: Boolean(env.PAPERCLIP_BASE_URL && env.PAPERCLIP_BASE_URL.trim().length > 0),
    hasPaperclipToken: Boolean(env.PAPERCLIP_TOKEN && env.PAPERCLIP_TOKEN.trim().length > 0),
    hasPaperclipCompanyId: Boolean(env.PAPERCLIP_COMPANY_ID && env.PAPERCLIP_COMPANY_ID.trim().length > 0),
    hasPaperclipProjectId: Boolean(env.PAPERCLIP_PROJECT_ID && env.PAPERCLIP_PROJECT_ID.trim().length > 0),
    paperclipMaxIssues: Math.min(parsePositiveInt(env.PAPERCLIP_MAX_ISSUES, 25), 200)
  };
}

import { describe, expect, it } from "vitest";

import { readRuntimeConfig } from "./runtime-config.js";

describe("readRuntimeConfig", () => {
  it("uses defaults when env is empty", () => {
    const cfg = readRuntimeConfig({});
    expect(cfg.enablePaperclipCollector).toBe(true);
    expect(cfg.enableDockerCollector).toBe(true);
    expect(cfg.mcpHttpPort).toBe(8787);
    expect(cfg.mcpHttpAuthEnabled).toBe(false);
    expect(cfg.paperclipMaxIssues).toBe(25);
  });

  it("parses booleans and numeric limits", () => {
    const cfg = readRuntimeConfig({
      PAPERCLIP_COLLECTOR_ENABLED: "false",
      DOCKER_COLLECTOR_ENABLED: "0",
      MCP_HTTP_PORT: "9901",
      MCP_HTTP_AUTH_TOKEN: "token",
      PAPERCLIP_MAX_ISSUES: "500"
    });
    expect(cfg.enablePaperclipCollector).toBe(false);
    expect(cfg.enableDockerCollector).toBe(false);
    expect(cfg.mcpHttpPort).toBe(9901);
    expect(cfg.mcpHttpAuthEnabled).toBe(true);
    expect(cfg.paperclipMaxIssues).toBe(200);
  });

  it("reports availability of paperclip settings", () => {
    const cfg = readRuntimeConfig({
      PAPERCLIP_BASE_URL: "https://example.com",
      PAPERCLIP_TOKEN: "abc",
      PAPERCLIP_COMPANY_ID: "comp",
      PAPERCLIP_PROJECT_ID: "proj"
    });
    expect(cfg.hasPaperclipBaseUrl).toBe(true);
    expect(cfg.hasPaperclipToken).toBe(true);
    expect(cfg.hasPaperclipCompanyId).toBe(true);
    expect(cfg.hasPaperclipProjectId).toBe(true);
  });
});

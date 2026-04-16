import { describe, expect, it } from "vitest";

import { readRuntimeConfig } from "./runtime-config.js";

describe("readRuntimeConfig", () => {
  it("uses defaults when env is empty", () => {
    const cfg = readRuntimeConfig({});
    expect(cfg.enablePaperclipCollector).toBe(true);
    expect(cfg.enableDockerCollector).toBe(true);
    expect(cfg.enableFileCollector).toBe(false);
    expect(cfg.enableWordpressCollector).toBe(false);
    expect(cfg.fileCollectorPathsCount).toBe(0);
    expect(cfg.fileCollectorMaxLines).toBe(300);
    expect(cfg.mcpHttpPort).toBe(8787);
    expect(cfg.mcpHttpAuthEnabled).toBe(false);
    expect(cfg.hasWordpressBaseUrl).toBe(false);
    expect(cfg.hasWordpressAuth).toBe(false);
    expect(cfg.paperclipMaxIssues).toBe(25);
  });

  it("parses booleans and numeric limits", () => {
    const cfg = readRuntimeConfig({
      PAPERCLIP_COLLECTOR_ENABLED: "false",
      DOCKER_COLLECTOR_ENABLED: "0",
      FILE_COLLECTOR_ENABLED: "1",
      WORDPRESS_COLLECTOR_ENABLED: "true",
      FILE_COLLECTOR_PATHS: "/tmp/a.log;/tmp/b.log",
      FILE_COLLECTOR_MAX_LINES: "9999",
      FILE_COLLECTOR_INCLUDE_PATTERN: "panic|fatal",
      MCP_HTTP_PORT: "9901",
      MCP_HTTP_AUTH_TOKEN: "token",
      PAPERCLIP_MAX_ISSUES: "500"
    });
    expect(cfg.enablePaperclipCollector).toBe(false);
    expect(cfg.enableDockerCollector).toBe(false);
    expect(cfg.enableFileCollector).toBe(true);
    expect(cfg.enableWordpressCollector).toBe(true);
    expect(cfg.fileCollectorPathsCount).toBe(2);
    expect(cfg.fileCollectorMaxLines).toBe(5000);
    expect(cfg.fileCollectorPattern).toBe("panic|fatal");
    expect(cfg.mcpHttpPort).toBe(9901);
    expect(cfg.mcpHttpAuthEnabled).toBe(true);
    expect(cfg.paperclipMaxIssues).toBe(200);
  });

  it("reports availability of paperclip settings", () => {
    const cfg = readRuntimeConfig({
      PAPERCLIP_BASE_URL: "https://example.com",
      PAPERCLIP_TOKEN: "abc",
      PAPERCLIP_COMPANY_ID: "comp",
      PAPERCLIP_PROJECT_ID: "proj",
      WORDPRESS_BASE_URL: "https://wp.example.com",
      WORDPRESS_USERNAME: "admin",
      WORDPRESS_APP_PASSWORD: "abcd"
    });
    expect(cfg.hasPaperclipBaseUrl).toBe(true);
    expect(cfg.hasPaperclipToken).toBe(true);
    expect(cfg.hasPaperclipCompanyId).toBe(true);
    expect(cfg.hasPaperclipProjectId).toBe(true);
    expect(cfg.hasWordpressBaseUrl).toBe(true);
    expect(cfg.hasWordpressAuth).toBe(true);
  });
});

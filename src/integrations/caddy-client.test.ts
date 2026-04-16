import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import { CaddyClient } from "./caddy-client.js";

describe("CaddyClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns unreachable when health endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );
    const client = new CaddyClient({ healthUrl: "https://paperclip.example.com/healthz" });
    const health = await client.checkHealth();
    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(false);
    expect(health.error).toContain("ECONNREFUSED");
  });

  it("reads log errors from configured file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 }))
    );
    const dir = await mkdtemp(join(tmpdir(), "paperclip-caddy-"));
    const logPath = join(dir, "caddy.log");
    await writeFile(
      logPath,
      ["info: started", "error: bad gateway upstream 502", "warn: timeout"].join("\n"),
      "utf-8"
    );
    const client = new CaddyClient({ healthUrl: "https://paperclip.example.com/healthz", logPath });
    const health = await client.checkHealth();
    expect(health.reachable).toBe(true);
    expect((health.logErrorCount ?? 0) > 0).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });
});

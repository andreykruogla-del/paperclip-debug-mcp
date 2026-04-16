import { afterEach, describe, expect, it, vi } from "vitest";

import { WordPressClient } from "./wordpress-client.js";

type MockResponseInit = {
  status?: number;
  body?: string;
};

function makeResponse(init?: MockResponseInit): Response {
  return new Response(init?.body ?? "{}", {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" }
  });
}

describe("WordPressClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports unreachable wordpress when wp-json request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      })
    );

    const client = new WordPressClient({ baseUrl: "https://wp.example.com" });
    const health = await client.checkHealth();

    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(false);
    expect(health.restApiAvailable).toBe(false);
    expect(health.restError).toContain("ECONNREFUSED");
  });

  it("returns unconfigured state when base url is missing", async () => {
    const client = new WordPressClient({});
    const health = await client.checkHealth();

    expect(health.configured).toBe(false);
    expect(health.reachable).toBe(false);
    expect(health.restApiAvailable).toBe(false);
  });

  it("checks rest/xmlrpc/auth when credentials configured", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ status: 200, body: "{\"name\":\"wp\"}" }))
      .mockResolvedValueOnce(makeResponse({ status: 405, body: "XML-RPC server accepts POST requests only." }))
      .mockResolvedValueOnce(makeResponse({ status: 401, body: "{\"code\":\"rest_forbidden\"}" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new WordPressClient({
      baseUrl: "https://wp.example.com",
      username: "admin",
      appPassword: "app-pass"
    });
    const health = await client.checkHealth();

    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(true);
    expect(health.restApiAvailable).toBe(true);
    expect(health.xmlrpcEnabled).toBe(true);
    expect(health.authChecked).toBe(true);
    expect(health.authOk).toBe(false);
    expect(health.authError).toContain("401");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

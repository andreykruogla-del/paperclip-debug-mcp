import { afterEach, describe, expect, it, vi } from "vitest";

import { WordPressHealthCollector } from "./wordpress-health-collector.js";

function response(status: number, body = "{}"): Response {
  return new Response(body, { status });
}

describe("WordPressHealthCollector", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates critical incident when wordpress is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const collector = new WordPressHealthCollector({
      enabled: true,
      baseUrl: "https://wp.example.com"
    });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0]?.severity).toBe("critical");
  });

  it("creates auth/xmlrpc incidents for risky state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(403, "{\"message\":\"forbidden\"}"));
    vi.stubGlobal("fetch", fetchMock);

    const collector = new WordPressHealthCollector({
      enabled: true,
      baseUrl: "https://wp.example.com",
      username: "admin",
      appPassword: "app-pass"
    });
    const incidents = await collector.collectIncidents();
    expect(incidents.some((item) => item.id.includes("wordpress-xmlrpc"))).toBe(true);
    expect(incidents.some((item) => item.id.includes("wordpress-auth"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

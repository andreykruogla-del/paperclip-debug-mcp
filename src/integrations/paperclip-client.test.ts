import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PaperclipApiClient,
  PaperclipApiError,
  classifyPaperclipError
} from "./paperclip-client.js";

describe("PaperclipApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("classifies auth failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));
    const client = new PaperclipApiClient({
      baseUrl: "https://paperclip.example.com",
      token: "token"
    });

    await expect(client.get("/api/runs?limit=1")).rejects.toMatchObject({
      name: "PaperclipApiError",
      category: "auth_failure",
      status: 401
    });
  });

  it("classifies connectivity failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      })
    );
    const client = new PaperclipApiClient({
      baseUrl: "https://paperclip.example.com",
      token: "token"
    });

    await expect(client.get("/api/runs?limit=1")).rejects.toMatchObject({
      name: "PaperclipApiError",
      category: "connectivity_failure"
    });
  });

  it("returns endpoint mismatch when all endpoint variants fail with 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => new Response("not found", { status: 404 }))
    );
    const client = new PaperclipApiClient({
      baseUrl: "https://paperclip.example.com",
      token: "token"
    });

    await expect(
      client.getFirst(["/api/runs?limit=1", "/api/runs?take=1", "/api/run-logs?limit=1"])
    ).rejects.toMatchObject({
      name: "PaperclipApiError",
      category: "endpoint_mismatch"
    });
  });

  it("keeps non-endpoint failure when endpoint variants mixed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new PaperclipApiClient({
      baseUrl: "https://paperclip.example.com",
      token: "token"
    });

    await expect(client.getFirst(["/a", "/b"])).rejects.toMatchObject({
      name: "PaperclipApiError",
      category: "auth_failure",
      status: 401
    });
  });
});

describe("classifyPaperclipError", () => {
  it("extracts structured info from PaperclipApiError", () => {
    const error = new PaperclipApiError("boom", {
      category: "http_error",
      status: 500,
      path: "/api/runs"
    });

    const normalized = classifyPaperclipError(error);
    expect(normalized.category).toBe("http_error");
    expect(normalized.status).toBe(500);
    expect(normalized.path).toBe("/api/runs");
  });
});

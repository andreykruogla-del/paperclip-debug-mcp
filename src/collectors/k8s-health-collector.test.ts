import { afterEach, describe, expect, it, vi } from "vitest";

import { K8sHealthCollector } from "./k8s-health-collector.js";

describe("K8sHealthCollector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates error incident when kubectl fails", async () => {
    const mod = await import("../integrations/k8s-client.js");
    vi.spyOn(mod.K8sClient.prototype, "checkHealth").mockResolvedValue({
      configured: true,
      namespace: "paperclip",
      reachable: false,
      error: "forbidden"
    });
    const collector = new K8sHealthCollector({ enabled: true, namespace: "paperclip" });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0]?.severity).toBe("error");
  });

  it("creates warning incident for problematic pods", async () => {
    const mod = await import("../integrations/k8s-client.js");
    vi.spyOn(mod.K8sClient.prototype, "checkHealth").mockResolvedValue({
      configured: true,
      namespace: "paperclip",
      reachable: true,
      podCount: 10,
      problematicPodCount: 2,
      problematicPods: [{ name: "coder-abc", phase: "Running", restartCount: 5, reason: "CrashLoopBackOff" }]
    });
    const collector = new K8sHealthCollector({ enabled: true, namespace: "paperclip" });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0]?.severity).toBe("warning");
  });
});

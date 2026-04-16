import { describe, expect, it } from "vitest";

import { findProblemPods } from "./k8s-client.js";

describe("findProblemPods", () => {
  it("detects problematic pods by phase/restarts/not-ready", () => {
    const payload = {
      items: [
        {
          metadata: { name: "ok-pod" },
          status: { phase: "Running", containerStatuses: [{ restartCount: 0, ready: true }] }
        },
        {
          metadata: { name: "bad-pod-1" },
          status: { phase: "Pending", containerStatuses: [{ restartCount: 0, ready: false }] }
        },
        {
          metadata: { name: "bad-pod-2" },
          status: { phase: "Running", containerStatuses: [{ restartCount: 8, ready: true }] }
        }
      ]
    };
    const bad = findProblemPods(payload);
    expect(bad.length).toBe(2);
    expect(bad[0]?.name).toBe("bad-pod-1");
    expect(bad[1]?.name).toBe("bad-pod-2");
  });
});

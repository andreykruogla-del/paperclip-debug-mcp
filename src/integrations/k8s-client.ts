import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { redactSensitiveText } from "../core/redaction.js";

const execFileAsync = promisify(execFile);

type K8sPodItem = {
  metadata?: { name?: string };
  status?: {
    phase?: string;
    containerStatuses?: Array<{
      restartCount?: number;
      state?: { waiting?: { reason?: string; message?: string }; terminated?: { reason?: string; message?: string } };
      ready?: boolean;
    }>;
  };
};

type K8sPodList = {
  items?: K8sPodItem[];
};

export type K8sProblemPod = {
  name: string;
  phase: string;
  restartCount: number;
  reason?: string;
};

export type K8sHealthResult = {
  configured: boolean;
  namespace: string;
  reachable: boolean;
  podCount?: number;
  problematicPodCount?: number;
  problematicPods?: K8sProblemPod[];
  error?: string;
};

type K8sClientOptions = {
  namespace?: string;
};

export function findProblemPods(payload: unknown): K8sProblemPod[] {
  const list = (payload ?? {}) as K8sPodList;
  const items = Array.isArray(list.items) ? list.items : [];
  const bad: K8sProblemPod[] = [];

  for (const pod of items) {
    const name = pod.metadata?.name ?? "unknown";
    const phase = pod.status?.phase ?? "Unknown";
    const statuses = pod.status?.containerStatuses ?? [];
    const restartCount = statuses.reduce((sum, c) => sum + (c.restartCount ?? 0), 0);
    const waitingReason = statuses.find((c) => c.state?.waiting?.reason)?.state?.waiting?.reason;
    const terminatedReason = statuses.find((c) => c.state?.terminated?.reason)?.state?.terminated?.reason;
    const reason = waitingReason ?? terminatedReason;
    const notReady = statuses.some((c) => c.ready === false);
    const phaseBad = /failed|unknown|pending/i.test(phase);
    const restarting = restartCount > 3;
    if (phaseBad || restarting || notReady || Boolean(reason)) {
      bad.push({ name, phase, restartCount, reason });
    }
  }

  return bad;
}

export class K8sClient {
  private readonly namespace: string;

  public constructor(options?: K8sClientOptions) {
    this.namespace = (options?.namespace ?? process.env.K8S_NAMESPACE ?? "default").trim() || "default";
  }

  public isEnabled(): boolean {
    return true;
  }

  public async checkHealth(): Promise<K8sHealthResult> {
    const result: K8sHealthResult = {
      configured: true,
      namespace: this.namespace,
      reachable: false
    };
    try {
      const { stdout } = await execFileAsync(
        "kubectl",
        ["get", "pods", "-n", this.namespace, "-o", "json", "--request-timeout=8s"],
        { windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024 }
      );
      const payload = JSON.parse(stdout || "{}") as K8sPodList;
      const items = Array.isArray(payload.items) ? payload.items : [];
      const bad = findProblemPods(payload);
      result.reachable = true;
      result.podCount = items.length;
      result.problematicPodCount = bad.length;
      result.problematicPods = bad.slice(0, 20);
      return result;
    } catch (error: unknown) {
      result.error = redactSensitiveText(error instanceof Error ? error.message : String(error));
      return result;
    }
  }
}

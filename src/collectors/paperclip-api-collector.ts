import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident, IncidentSeverity } from "../core/types.js";

type PaperclipIssue = {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
  updatedAt?: string;
  assigneeAgentId?: string;
  assigneeAgent?: {
    id?: string;
    name?: string;
  };
  runId?: string;
};

type PaperclipComment = {
  body?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PaperclipCollectorOptions = {
  baseUrl?: string;
  token?: string;
  companyId?: string;
  projectId?: string;
  issueIds?: string[];
  maxIssues?: number;
};

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toTimestamp(value: string | undefined): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function statusToSeverity(status: string | undefined): IncidentSeverity {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized.includes("blocked") || normalized.includes("failed")) return "critical";
  if (normalized.includes("error")) return "error";
  if (normalized.includes("progress") || normalized.includes("doing")) return "warning";
  return "info";
}

function probableCauseFromText(description: string | undefined, commentBody: string | undefined): string | undefined {
  const text = [description, commentBody].filter(Boolean).join("\n");
  if (!text) return undefined;
  if (/401|403|unauthor/i.test(text)) return "Authorization/credentials issue";
  if (/429|rate limit/i.test(text)) return "Provider rate limit";
  if (/timeout|timed out/i.test(text)) return "Timeout while calling dependency";
  if (/500|502|503|504/i.test(text)) return "Upstream service instability";
  return undefined;
}

export class PaperclipApiCollector implements IncidentCollector {
  public readonly id = "paperclip-api";
  public readonly kind = "paperclip" as const;
  public readonly enabled: boolean;

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly companyId?: string;
  private readonly projectId?: string;
  private readonly issueIds: string[];
  private readonly maxIssues: number;

  public constructor(options?: PaperclipCollectorOptions) {
    const envIssueIds = parseCsv(process.env.PAPERCLIP_ISSUE_IDS);
    const envMaxIssues = Number.parseInt(process.env.PAPERCLIP_MAX_ISSUES ?? "", 10);

    this.baseUrl = (options?.baseUrl ?? process.env.PAPERCLIP_BASE_URL ?? "").trim().replace(/\/+$/, "");
    this.token = (options?.token ?? process.env.PAPERCLIP_TOKEN ?? "").trim();
    this.companyId = firstString(options?.companyId ?? process.env.PAPERCLIP_COMPANY_ID);
    this.projectId = firstString(options?.projectId ?? process.env.PAPERCLIP_PROJECT_ID);
    this.issueIds = options?.issueIds?.length ? options.issueIds : envIssueIds;
    this.maxIssues =
      options?.maxIssues ??
      (Number.isFinite(envMaxIssues) && envMaxIssues > 0 ? Math.min(envMaxIssues, 200) : 25);

    this.enabled = this.baseUrl.length > 0 && this.token.length > 0;
  }

  public async collectIncidents(): Promise<Incident[]> {
    if (!this.enabled) return [];

    const issues = await this.loadIssues();
    const incidents: Incident[] = [];

    for (const issue of issues) {
      const issueId = firstString(issue.id);
      if (!issueId) continue;
      const comments = await this.fetchIssueComments(issueId);
      const latestComment = comments.sort((a, b) => toTimestamp(b.updatedAt ?? b.createdAt) - toTimestamp(a.updatedAt ?? a.createdAt))[0];
      const title = firstString(issue.title) ?? `Issue ${issueId}`;
      const status = firstString(issue.status) ?? "unknown";
      const assignee = firstString(issue.assigneeAgent?.name) ?? firstString(issue.assigneeAgentId) ?? "unassigned";

      incidents.push({
        id: `paperclip-issue-${issueId}`,
        runtime: "paperclip",
        source: "paperclip-api",
        service: `issue:${assignee}`,
        severity: statusToSeverity(status),
        timestamp: toTimestamp(issue.updatedAt ?? issue.createdAt),
        summary: `${title} [${status}]`,
        probableCause: probableCauseFromText(issue.description, latestComment?.body),
        relatedRunId: firstString(issue.runId),
        rawExcerpt: firstString(latestComment?.body) ?? firstString(issue.description)
      });
    }

    return incidents;
  }

  private async loadIssues(): Promise<PaperclipIssue[]> {
    if (this.issueIds.length > 0) {
      const resolved = await Promise.all(this.issueIds.map(async (issueId) => this.fetchIssue(issueId)));
      return resolved.filter((issue): issue is PaperclipIssue => Boolean(issue));
    }

    if (!this.companyId) {
      throw new Error("Paperclip collector requires PAPERCLIP_COMPANY_ID or PAPERCLIP_ISSUE_IDS.");
    }

    const params = new URLSearchParams();
    params.set("limit", String(this.maxIssues));
    if (this.projectId) params.set("projectId", this.projectId);
    const query = params.toString();
    const payload = await this.fetchJson(
      `/api/companies/${this.companyId}/issues${query ? `?${query}` : ""}`
    );
    return this.extractArray<PaperclipIssue>(payload);
  }

  private async fetchIssue(issueId: string): Promise<PaperclipIssue | null> {
    const payload = await this.fetchJson(`/api/issues/${issueId}`);
    if (payload && typeof payload === "object") {
      return payload as PaperclipIssue;
    }
    return null;
  }

  private async fetchIssueComments(issueId: string): Promise<PaperclipComment[]> {
    const payload = await this.fetchJson(`/api/issues/${issueId}/comments`);
    return this.extractArray<PaperclipComment>(payload);
  }

  private async fetchJson(path: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Paperclip API ${response.status} for ${path}: ${body.slice(0, 240)}`);
    }

    return response.json();
  }

  private extractArray<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      const candidateKeys = ["items", "data", "results", "issues", "comments"];
      for (const key of candidateKeys) {
        const value = record[key];
        if (Array.isArray(value)) return value as T[];
      }
      for (const value of Object.values(record)) {
        if (Array.isArray(value)) return value as T[];
      }
    }
    return [];
  }
}

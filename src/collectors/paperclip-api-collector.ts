import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident, IncidentSeverity } from "../core/types.js";
import { redactSensitiveText } from "../core/redaction.js";
import {
  PaperclipApiClient,
  firstString,
  parseCsv,
  toTimestamp
} from "../integrations/paperclip-client.js";

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
  enabled?: boolean;
};

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
  private readonly client: PaperclipApiClient;

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

    this.client = new PaperclipApiClient({ baseUrl: this.baseUrl, token: this.token });
    const enabledByConfig = options?.enabled ?? true;
    this.enabled = enabledByConfig && this.client.isEnabled();
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
        rawExcerpt: redactSensitiveText(firstString(latestComment?.body) ?? firstString(issue.description))
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
    const payload = await this.client.get(
      `/api/companies/${this.companyId}/issues${query ? `?${query}` : ""}`
    );
    return this.client.extractArray<PaperclipIssue>(payload, ["issues", "items", "data", "results"]);
  }

  private async fetchIssue(issueId: string): Promise<PaperclipIssue | null> {
    const payload = await this.client.get(`/api/issues/${issueId}`);
    if (payload && typeof payload === "object") {
      return payload as PaperclipIssue;
    }
    return null;
  }

  private async fetchIssueComments(issueId: string): Promise<PaperclipComment[]> {
    const payload = await this.client.get(`/api/issues/${issueId}/comments`);
    return this.client.extractArray<PaperclipComment>(payload, ["comments", "items", "data", "results"]);
  }
}

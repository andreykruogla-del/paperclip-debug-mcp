import { redactSensitiveText } from "../core/redaction.js";

type SentryClientOptions = {
  baseUrl?: string;
  orgSlug?: string;
  projectSlug?: string;
  authToken?: string;
};

type SentryIssue = {
  id?: string;
  title?: string;
  culprit?: string;
  level?: string;
  status?: string;
  count?: string;
  userCount?: number;
  permalink?: string;
  lastSeen?: string;
};

export type SentryHealthResult = {
  configured: boolean;
  reachable: boolean;
  baseUrl: string;
  orgSlug?: string;
  projectSlug?: string;
  issuesChecked?: number;
  unresolvedIssues?: number;
  highSeverityIssues?: number;
  latestIssueTitle?: string;
  error?: string;
};

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

export class SentryClient {
  private readonly baseUrl: string;
  private readonly orgSlug: string;
  private readonly projectSlug: string;
  private readonly authToken: string;

  public constructor(options?: SentryClientOptions) {
    this.baseUrl = trim(options?.baseUrl ?? process.env.SENTRY_BASE_URL ?? "https://sentry.io/api/0").replace(/\/+$/, "");
    this.orgSlug = trim(options?.orgSlug ?? process.env.SENTRY_ORG_SLUG);
    this.projectSlug = trim(options?.projectSlug ?? process.env.SENTRY_PROJECT_SLUG);
    this.authToken = trim(options?.authToken ?? process.env.SENTRY_AUTH_TOKEN);
  }

  public isEnabled(): boolean {
    return this.orgSlug.length > 0 && this.projectSlug.length > 0 && this.authToken.length > 0;
  }

  public async checkHealth(limit = 20): Promise<SentryHealthResult> {
    const result: SentryHealthResult = {
      configured: this.isEnabled(),
      reachable: false,
      baseUrl: this.baseUrl,
      orgSlug: this.orgSlug || undefined,
      projectSlug: this.projectSlug || undefined
    };
    if (!this.isEnabled()) return result;

    const url =
      `${this.baseUrl}/projects/${encodeURIComponent(this.orgSlug)}/${encodeURIComponent(this.projectSlug)}/issues/` +
      `?query=is%3Aunresolved&limit=${Math.min(Math.max(limit, 1), 100)}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const body = await response.text();
        result.error = redactSensitiveText(`Sentry ${response.status}: ${body.slice(0, 180)}`);
        return result;
      }

      result.reachable = true;
      const payload = (await response.json()) as unknown;
      const issues = Array.isArray(payload) ? (payload as SentryIssue[]) : [];
      const highSeverity = issues.filter((issue) => /error|fatal/i.test(issue.level ?? "")).length;

      result.issuesChecked = issues.length;
      result.unresolvedIssues = issues.length;
      result.highSeverityIssues = highSeverity;
      result.latestIssueTitle = issues[0]?.title;
      return result;
    } catch (error: unknown) {
      result.error = redactSensitiveText(error instanceof Error ? error.message : String(error));
      return result;
    }
  }
}

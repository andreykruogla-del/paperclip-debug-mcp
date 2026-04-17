import { redactSensitiveText } from "../core/redaction.js";
import { PaperclipApiClient, firstString, toTimestamp } from "./paperclip-client.js";

type IssueShape = Record<string, unknown>;
type CommentShape = Record<string, unknown>;

export type PaperclipIssueSummary = {
  issueId: string;
  title: string;
  status: string;
  priority?: string;
  assigneeAgentId?: string;
  assigneeAgentName?: string;
  relatedRunId?: string;
  updatedAt: number;
};

export type PaperclipIssueComment = {
  commentId: string;
  issueId: string;
  body?: string;
  createdAt: number;
  authorId?: string;
};

function mapIssue(issue: IssueShape): PaperclipIssueSummary | null {
  const issueId = firstString(issue.id);
  if (!issueId) return null;
  const assigneeAgent = issue.assigneeAgent && typeof issue.assigneeAgent === "object"
    ? (issue.assigneeAgent as Record<string, unknown>)
    : undefined;
  const activeRun = issue.activeRun && typeof issue.activeRun === "object"
    ? (issue.activeRun as Record<string, unknown>)
    : undefined;
  return {
    issueId,
    title: firstString(issue.title) ?? `Issue ${issueId}`,
    status: firstString(issue.status) ?? "unknown",
    priority: firstString(issue.priority),
    assigneeAgentId: firstString(issue.assigneeAgentId),
    assigneeAgentName: firstString(assigneeAgent?.name),
    relatedRunId:
      firstString(issue.relatedRunId) ??
      firstString(issue.runId) ??
      firstString(issue.run_id) ??
      firstString(issue.executionRunId) ??
      firstString(issue.checkoutRunId) ??
      firstString(issue.originRunId) ??
      firstString(activeRun?.id) ??
      firstString(activeRun?.runId),
    updatedAt: toTimestamp(
      (issue.updatedAt as string | number | undefined) ??
        (issue.createdAt as string | number | undefined)
    )
  };
}

function mapComment(issueId: string, comment: CommentShape, idx: number): PaperclipIssueComment {
  return {
    commentId: firstString(comment.id) ?? `${issueId}-comment-${idx}`,
    issueId,
    body: redactSensitiveText(firstString(comment.body)),
    createdAt: toTimestamp(
      (comment.createdAt as string | number | undefined) ??
        (comment.updatedAt as string | number | undefined)
    ),
    authorId: firstString(comment.authorId) ?? firstString(comment.userId)
  };
}

export async function listIssues(
  client: PaperclipApiClient,
  companyId: string,
  projectId: string | undefined,
  limit = 30,
  status: string | undefined
): Promise<{ issues: PaperclipIssueSummary[]; sourcePath: string }> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (projectId) params.set("projectId", projectId);
  if (status) params.set("status", status);
  const path = `/api/companies/${companyId}/issues?${params.toString()}`;
  const payload = await client.get(path);
  const rows = client.extractArray<IssueShape>(payload, ["issues", "items", "data", "results"]);
  const issues = rows
    .map((row) => mapIssue(row))
    .filter((row): row is PaperclipIssueSummary => Boolean(row))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return { issues, sourcePath: path };
}

export async function getIssueComments(
  client: PaperclipApiClient,
  issueId: string
): Promise<{ comments: PaperclipIssueComment[]; sourcePath: string }> {
  const path = `/api/issues/${encodeURIComponent(issueId)}/comments`;
  const payload = await client.get(path);
  const rows = client.extractArray<CommentShape>(payload, ["comments", "items", "data", "results"]);
  const comments = rows
    .map((row, idx) => mapComment(issueId, row, idx))
    .sort((a, b) => a.createdAt - b.createdAt);
  return { comments, sourcePath: path };
}

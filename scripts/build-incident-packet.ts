import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { DockerCliCollector } from "../src/collectors/docker-cli-collector.js";
import { PaperclipApiCollector } from "../src/collectors/paperclip-api-collector.js";
import { buildIncidentPacket } from "../src/core/incident-packet.js";
import { CollectorRegistry } from "../src/core/registry.js";
import { PaperclipApiClient, firstString } from "../src/integrations/paperclip-client.js";
import { getIssueComments, listIssues } from "../src/integrations/paperclip-issues.js";
import { getRunEvents, listRuns } from "../src/integrations/paperclip-runs.js";

type Args = {
  issueId?: string;
  runId?: string;
  outDir: string;
};

function parseArgs(argv: string[]): Args {
  let issueId: string | undefined;
  let runId: string | undefined;
  let outDir = "./artifacts";

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--issue-id" && next) {
      issueId = next;
      i += 1;
    } else if (token === "--run-id" && next) {
      runId = next;
      i += 1;
    } else if (token === "--out-dir" && next) {
      outDir = next;
      i += 1;
    }
  }

  return { issueId, runId, outDir };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.issueId && !args.runId) {
    throw new Error("Provide --issue-id <id> or --run-id <id>.");
  }

  const client = new PaperclipApiClient();
  if (!client.isEnabled()) {
    throw new Error("Paperclip API is not configured. Set PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN.");
  }

  const registry = new CollectorRegistry();
  registry.register(new PaperclipApiCollector());
  registry.register(new DockerCliCollector());
  const allIncidents = await registry.collectAllIncidents();

  const companyId = firstString(process.env.PAPERCLIP_COMPANY_ID);
  const projectId = firstString(process.env.PAPERCLIP_PROJECT_ID);

  let issueData: Awaited<ReturnType<typeof listIssues>>["issues"][number] | undefined;
  let commentsData: Awaited<ReturnType<typeof getIssueComments>>["comments"] | undefined;
  let runId = args.runId;

  if (args.issueId) {
    if (!companyId) throw new Error("PAPERCLIP_COMPANY_ID is required when using --issue-id.");
    const { issues } = await listIssues(client, companyId, projectId, 200, undefined);
    issueData = issues.find((issue) => issue.issueId === args.issueId);
    if (!issueData) throw new Error(`Issue not found: ${args.issueId}`);
    const commentsResult = await getIssueComments(client, args.issueId);
    commentsData = commentsResult.comments;
    runId = runId ?? issueData.relatedRunId;
  }

  let runData: Awaited<ReturnType<typeof listRuns>>["runs"][number] | undefined;
  let runEvents: Awaited<ReturnType<typeof getRunEvents>>["events"] | undefined;
  if (runId) {
    const { runs } = await listRuns(client, 400);
    runData = runs.find((run) => run.runId === runId);
    if (runData) {
      const eventsResult = await getRunEvents(client, runId);
      runEvents = eventsResult.events;
    }
  }

  const packet = buildIncidentPacket({
    issue: issueData,
    comments: commentsData,
    run: runData,
    runEvents,
    allIncidents
  });

  const outputDir = resolve(process.cwd(), args.outDir);
  await mkdir(outputDir, { recursive: true });
  const target = resolve(outputDir, `${packet.packetId}.json`);
  await writeFile(target, JSON.stringify(packet, null, 2), "utf8");

  console.log(JSON.stringify({ ok: true, packetId: packet.packetId, file: target }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

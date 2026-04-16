import "dotenv/config";
import { PaperclipApiClient } from "../src/integrations/paperclip-client.js";
import { listRuns } from "../src/integrations/paperclip-runs.js";
import { listDockerServices } from "../src/integrations/docker-services.js";
import { listIssues } from "../src/integrations/paperclip-issues.js";

async function main(): Promise<void> {
  const paperclipClient = new PaperclipApiClient();
  const report: Record<string, unknown> = {
    at: new Date().toISOString()
  };

  if (paperclipClient.isEnabled()) {
    try {
      const { runs, sourcePath } = await listRuns(paperclipClient, 5);
      report.paperclip = {
        status: "ok",
        sourcePath,
        runs: runs.length
      };

      const companyId = process.env.PAPERCLIP_COMPANY_ID;
      if (companyId) {
        const issueResult = await listIssues(
          paperclipClient,
          companyId,
          process.env.PAPERCLIP_PROJECT_ID,
          5,
          undefined
        );
        report.paperclipIssues = {
          status: "ok",
          sourcePath: issueResult.sourcePath,
          issues: issueResult.issues.length
        };
      } else {
        report.paperclipIssues = {
          status: "skipped",
          reason: "PAPERCLIP_COMPANY_ID is not set"
        };
      }
    } catch (error: unknown) {
      report.paperclip = {
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      };
      report.paperclipIssues = {
        status: "skipped",
        reason: "Paperclip run check failed"
      };
    }
  } else {
    report.paperclip = {
      status: "skipped",
      reason: "PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN are not set"
    };
    report.paperclipIssues = {
      status: "skipped",
      reason: "PAPERCLIP_BASE_URL and PAPERCLIP_TOKEN are not set"
    };
  }

  try {
    const services = await listDockerServices();
    report.docker = {
      status: "ok",
      total: services.length,
      problematic: services.filter((service) => service.problematic).length
    };
  } catch (error: unknown) {
    report.docker = {
      status: "error",
      error: error instanceof Error ? error.message : String(error)
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

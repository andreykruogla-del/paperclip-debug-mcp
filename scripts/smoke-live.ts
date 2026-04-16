import { PaperclipApiClient } from "../src/integrations/paperclip-client.js";
import { listRuns } from "../src/integrations/paperclip-runs.js";
import { listDockerServices } from "../src/integrations/docker-services.js";

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
    } catch (error: unknown) {
      report.paperclip = {
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    report.paperclip = {
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

import "dotenv/config";
import { PaperclipApiClient } from "../src/integrations/paperclip-client.js";
import { listRuns } from "../src/integrations/paperclip-runs.js";
import { listDockerServices } from "../src/integrations/docker-services.js";
import { listIssues } from "../src/integrations/paperclip-issues.js";
import { CaddyClient } from "../src/integrations/caddy-client.js";
import { K8sClient } from "../src/integrations/k8s-client.js";
import { PostgresClient } from "../src/integrations/postgres-client.js";
import { SentryClient } from "../src/integrations/sentry-client.js";
import { WordPressClient } from "../src/integrations/wordpress-client.js";

async function main(): Promise<void> {
  const paperclipClient = new PaperclipApiClient();
  const report: Record<string, unknown> = {
    at: new Date().toISOString()
  };
  const caddyClient = new CaddyClient();
  const k8sClient = new K8sClient();
  const postgresClient = new PostgresClient();
  const sentryClient = new SentryClient();
  const wordpressClient = new WordPressClient();

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

  if (caddyClient.isEnabled()) {
    try {
      const health = await caddyClient.checkHealth();
      report.caddy = {
        status: health.reachable ? "ok" : "error",
        reachable: health.reachable,
        statusCode: health.statusCode,
        logErrorCount: health.logErrorCount
      };
    } catch (error: unknown) {
      report.caddy = {
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    report.caddy = {
      status: "skipped",
      reason: "CADDY_HEALTH_URL/CADDY_LOG_PATH are not set"
    };
  }

  if (wordpressClient.isEnabled()) {
    try {
      const health = await wordpressClient.checkHealth();
      report.wordpress = {
        status: health.reachable ? "ok" : "error",
        reachable: health.reachable,
        restApiAvailable: health.restApiAvailable,
        xmlrpcEnabled: health.xmlrpcEnabled,
        authChecked: health.authChecked,
        authOk: health.authOk
      };
    } catch (error: unknown) {
      report.wordpress = {
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    report.wordpress = {
      status: "skipped",
      reason: "WORDPRESS_BASE_URL is not set"
    };
  }

  if ((process.env.K8S_COLLECTOR_ENABLED ?? "false").toLowerCase() !== "false") {
    try {
      const health = await k8sClient.checkHealth();
      report.k8s = {
        status: health.reachable ? "ok" : "error",
        namespace: health.namespace,
        podCount: health.podCount,
        problematicPodCount: health.problematicPodCount
      };
    } catch (error: unknown) {
      report.k8s = {
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    report.k8s = {
      status: "skipped",
      reason: "K8S_COLLECTOR_ENABLED is false"
    };
  }

  if (sentryClient.isEnabled()) {
    try {
      const health = await sentryClient.checkHealth(10);
      report.sentry = {
        status: health.reachable ? "ok" : "error",
        reachable: health.reachable,
        unresolvedIssues: health.unresolvedIssues,
        highSeverityIssues: health.highSeverityIssues
      };
    } catch (error: unknown) {
      report.sentry = {
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    report.sentry = {
      status: "skipped",
      reason: "SENTRY_ORG_SLUG/SENTRY_PROJECT_SLUG/SENTRY_AUTH_TOKEN are not set"
    };
  }

  if (postgresClient.isEnabled()) {
    try {
      const health = await postgresClient.checkHealth();
      report.postgres = {
        status: health.reachable ? "ok" : "error",
        reachable: health.reachable,
        blockedQueries: health.blockedQueries,
        longRunningQueries: health.longRunningQueries,
        replicationLagSeconds: health.replicationLagSeconds
      };
    } catch (error: unknown) {
      report.postgres = {
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    report.postgres = {
      status: "skipped",
      reason: "POSTGRES_URL is not set"
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

import "dotenv/config";

import { CaddyHealthCollector } from "../src/collectors/caddy-health-collector.js";
import { DockerCliCollector } from "../src/collectors/docker-cli-collector.js";
import { FileSystemLogCollector } from "../src/collectors/filesystem-log-collector.js";
import { K8sHealthCollector } from "../src/collectors/k8s-health-collector.js";
import { PaperclipApiCollector } from "../src/collectors/paperclip-api-collector.js";
import { PostgresHealthCollector } from "../src/collectors/postgres-health-collector.js";
import { RedisHealthCollector } from "../src/collectors/redis-health-collector.js";
import { SentryHealthCollector } from "../src/collectors/sentry-health-collector.js";
import { WordPressHealthCollector } from "../src/collectors/wordpress-health-collector.js";
import { prioritizeIncidents } from "../src/core/incident-priority.js";
import { CollectorRegistry } from "../src/core/registry.js";
import { readRuntimeConfig } from "../src/core/runtime-config.js";

async function main(): Promise<void> {
  const runtimeConfig = readRuntimeConfig();
  const registry = new CollectorRegistry();
  registry.register(
    new PaperclipApiCollector({
      enabled: runtimeConfig.enablePaperclipCollector,
      maxIssues: runtimeConfig.paperclipMaxIssues
    })
  );
  registry.register(new DockerCliCollector(40, runtimeConfig.enableDockerCollector));
  registry.register(new CaddyHealthCollector({ enabled: runtimeConfig.enableCaddyCollector }));
  registry.register(new SentryHealthCollector({ enabled: runtimeConfig.enableSentryCollector }));
  registry.register(new K8sHealthCollector({ enabled: runtimeConfig.enableK8sCollector }));
  registry.register(new PostgresHealthCollector({ enabled: runtimeConfig.enablePostgresCollector }));
  registry.register(new RedisHealthCollector({ enabled: runtimeConfig.enableRedisCollector }));
  registry.register(
    new FileSystemLogCollector({
      enabled: runtimeConfig.enableFileCollector,
      maxLines: runtimeConfig.fileCollectorMaxLines,
      includePattern: runtimeConfig.fileCollectorPattern
    })
  );
  registry.register(new WordPressHealthCollector({ enabled: runtimeConfig.enableWordpressCollector }));

  const refreshed = await registry.refreshCollectors();
  const incidents = refreshed.flatMap((item) => item.incidents);
  const prioritized = prioritizeIncidents(incidents, 20);

  const output = {
    at: new Date().toISOString(),
    runtimeConfig,
    collectors: refreshed.map(({ incidents: _incidents, ...meta }) => meta),
    summary: {
      incidents: incidents.length,
      highOrCritical: prioritized.filter((item) => item.priorityBand === "high" || item.priorityBand === "critical").length
    },
    topIncidents: prioritized.slice(0, 5)
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

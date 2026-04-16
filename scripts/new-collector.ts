import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function toClassName(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function normalizeFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function parseArgs(argv: string[]): { name?: string; kind?: string } {
  let name: string | undefined;
  let kind: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--name" && next) {
      name = next;
      i += 1;
    } else if (token === "--kind" && next) {
      kind = next;
      i += 1;
    }
  }
  return { name, kind };
}

async function main(): Promise<void> {
  const { name, kind } = parseArgs(process.argv.slice(2));
  if (!name) {
    throw new Error("Usage: npm run collector:new -- --name wordpress --kind external");
  }

  const collectorKind = (kind ?? "external").trim();
  const fileName = normalizeFileName(name);
  const classBase = toClassName(fileName);
  const className = `${classBase}Collector`;
  const targetDir = resolve(process.cwd(), "src", "collectors");
  const targetPath = resolve(targetDir, `${fileName}-collector.ts`);

  const content = `import type { IncidentCollector } from "../core/collector-interface.js";
import type { Incident } from "../core/types.js";

export class ${className} implements IncidentCollector {
  public readonly id = "${fileName}";
  public readonly kind = "${collectorKind}" as const;
  public readonly enabled = true;

  public async collectIncidents(): Promise<Incident[]> {
    // TODO: replace with real integration and normalization.
    return [];
  }
}
`;

  await mkdir(targetDir, { recursive: true });
  await writeFile(targetPath, content, "utf8");
  console.log(JSON.stringify({ ok: true, file: targetPath, className }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

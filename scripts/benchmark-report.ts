import "dotenv/config";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type IncidentPacket = {
  packetId: string;
  generatedAt: number;
  comments?: Array<unknown>;
  runEvents?: Array<{ timestamp?: number; error?: string }>;
  relatedIncidents: Array<{ timestamp?: number; severity?: string }>;
  clusters: Array<{ count: number }>;
};

type Args = {
  inputDir: string;
  output: string;
};

function parseArgs(argv: string[]): Args {
  let inputDir = "./artifacts";
  let output = "./artifacts/benchmark-report.md";
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--input-dir" && next) {
      inputDir = next;
      i += 1;
    } else if (token === "--output" && next) {
      output = next;
      i += 1;
    }
  }
  return { inputDir, output };
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function min(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

function fmt(num: number): string {
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function minutes(start: number, end: number): number {
  return Math.max(0, (end - start) / (1000 * 60));
}

function buildMarkdown(packets: IncidentPacket[]): string {
  const countsIncidents = packets.map((packet) => packet.relatedIncidents.length);
  const countsClusters = packets.map((packet) => packet.clusters.length);
  const countsComments = packets.map((packet) => packet.comments?.length ?? 0);
  const countsEvents = packets.map((packet) => packet.runEvents?.length ?? 0);

  const criticalCounts = packets.map((packet) =>
    packet.relatedIncidents.filter((incident) => (incident.severity ?? "").toLowerCase() === "critical").length
  );

  const triageMinutes = packets.map((packet) => {
    const timestamps = packet.relatedIncidents
      .map((incident) => incident.timestamp)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (timestamps.length === 0) return 0;
    const first = min(timestamps);
    const last = packet.generatedAt;
    return minutes(first, last);
  });

  const topPacket = packets
    .map((packet) => ({
      packetId: packet.packetId,
      incidents: packet.relatedIncidents.length,
      clusters: packet.clusters.length,
      events: packet.runEvents?.length ?? 0
    }))
    .sort((a, b) => b.incidents - a.incidents || b.events - a.events)[0];

  return `# Benchmark Report

Generated: ${new Date().toISOString()}
Packets analyzed: ${packets.length}

## Summary

- Avg incidents per packet: ${fmt(avg(countsIncidents))}
- Avg clusters per packet: ${fmt(avg(countsClusters))}
- Avg comments per packet: ${fmt(avg(countsComments))}
- Avg run events per packet: ${fmt(avg(countsEvents))}
- Avg critical incidents per packet: ${fmt(avg(criticalCounts))}
- Avg triage window (first incident -> packet generated): ${fmt(avg(triageMinutes))} min

## Distribution

- Incidents min/max: ${min(countsIncidents)} / ${max(countsIncidents)}
- Clusters min/max: ${min(countsClusters)} / ${max(countsClusters)}
- Run events min/max: ${min(countsEvents)} / ${max(countsEvents)}
- Triage window min/max: ${fmt(min(triageMinutes))} / ${fmt(max(triageMinutes))} min

## Heaviest Packet

${topPacket ? `- packetId: ${topPacket.packetId}
- incidents: ${topPacket.incidents}
- clusters: ${topPacket.clusters}
- run events: ${topPacket.events}` : "- no packets"}
`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputDir = resolve(process.cwd(), args.inputDir);
  const output = resolve(process.cwd(), args.output);

  const files = (await readdir(inputDir))
    .filter((file) => file.toLowerCase().endsWith(".json"));

  if (files.length === 0) {
    throw new Error(`No JSON packets found in ${inputDir}`);
  }

  const packets: IncidentPacket[] = [];
  for (const file of files) {
    const raw = await readFile(resolve(inputDir, file), "utf8");
    const parsed = JSON.parse(raw) as IncidentPacket;
    packets.push(parsed);
  }

  const md = buildMarkdown(packets);
  await writeFile(output, md, "utf8");
  console.log(JSON.stringify({ ok: true, packets: packets.length, output }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

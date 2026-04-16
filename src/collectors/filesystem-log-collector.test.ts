import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { FileSystemLogCollector } from "./filesystem-log-collector.js";

describe("FileSystemLogCollector", () => {
  it("returns incidents for matched log lines", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paperclip-debug-"));
    const filePath = join(dir, "hermes.log");
    await writeFile(
      filePath,
      [
        "INFO startup complete",
        "ERROR provider timeout while calling API",
        "WARN harmless signal",
        "Exception auth token=abc123def4567890"
      ].join("\n"),
      "utf-8"
    );

    const collector = new FileSystemLogCollector({
      enabled: true,
      paths: [filePath],
      includePattern: "error|exception|timeout"
    });
    const incidents = await collector.collectIncidents();

    expect(incidents.length).toBe(2);
    expect(incidents[0]?.service).toBe("hermes");
    expect(incidents[0]?.rawExcerpt).toContain("***REDACTED***");
    expect(incidents[1]?.severity).toBe("error");

    await rm(dir, { recursive: true, force: true });
  });

  it("returns empty when collector disabled", async () => {
    const collector = new FileSystemLogCollector({
      enabled: false,
      paths: ["C:/not/existing.log"]
    });
    const incidents = await collector.collectIncidents();
    expect(incidents.length).toBe(0);
  });
});

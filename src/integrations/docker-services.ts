import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type DockerPsRow = {
  ID?: string;
  Names?: string;
  Image?: string;
  Status?: string;
  State?: string;
};

export type DockerServiceStatus = {
  id: string;
  name: string;
  image?: string;
  status: string;
  state?: string;
  problematic: boolean;
};

function isProblemStatus(status: string): boolean {
  const value = status.toLowerCase();
  return (
    value.includes("exited") ||
    value.includes("dead") ||
    value.includes("unhealthy") ||
    value.includes("restarting")
  );
}

export async function listDockerServices(): Promise<DockerServiceStatus[]> {
  const { stdout } = await execFileAsync(
    "docker",
    ["ps", "-a", "--format", "{{json .}}"],
    { timeout: 8000, windowsHide: true, maxBuffer: 1024 * 1024 }
  );

  const rows = (stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as DockerPsRow;
      } catch {
        return {};
      }
    });

  const services: DockerServiceStatus[] = [];
  for (const row of rows) {
      const id = row.ID?.trim();
      const name = row.Names?.trim();
      const status = row.Status?.trim() ?? "unknown";
      if (!id || !name) continue;
      services.push({
        id,
        name,
        image: row.Image?.trim(),
        status,
        state: row.State?.trim(),
        problematic: isProblemStatus(status)
      });
  }

  return services.sort(
    (a, b) => Number(b.problematic) - Number(a.problematic) || a.name.localeCompare(b.name)
  );
}

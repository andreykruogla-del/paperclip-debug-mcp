import { rm } from "node:fs/promises";
import { resolve } from "node:path";

async function safeRemove(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

async function main(): Promise<void> {
  const root = process.cwd();
  await safeRemove(resolve(root, "dist"));
  await safeRemove(resolve(root, "artifacts"));
  await safeRemove(resolve(root, "artifacts-test"));
  console.log(JSON.stringify({ ok: true, cleaned: ["dist", "artifacts", "artifacts-test"] }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

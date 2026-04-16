import { createClient } from "redis";

import { redactSensitiveText } from "../core/redaction.js";

type RedisClientOptions = {
  url?: string;
};

export type RedisHealthResult = {
  configured: boolean;
  reachable: boolean;
  urlConfigured: boolean;
  pingMs?: number;
  usedMemoryBytes?: number;
  maxMemoryBytes?: number;
  rejectedConnections?: number;
  evictedKeys?: number;
  connectedClients?: number;
  error?: string;
};

function parseInfoNumber(info: string, key: string): number | undefined {
  const row = info
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${key}:`));
  if (!row) return undefined;
  const raw = row.slice(key.length + 1).trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class RedisClient {
  private readonly url: string;

  public constructor(options?: RedisClientOptions) {
    this.url = (options?.url ?? process.env.REDIS_URL ?? "").trim();
  }

  public isEnabled(): boolean {
    return this.url.length > 0;
  }

  public async checkHealth(): Promise<RedisHealthResult> {
    const result: RedisHealthResult = {
      configured: this.isEnabled(),
      reachable: false,
      urlConfigured: this.isEnabled()
    };
    if (!this.isEnabled()) return result;

    const client = createClient({ url: this.url });
    try {
      const started = Date.now();
      await client.connect();
      await client.ping();
      result.pingMs = Date.now() - started;
      const info = await client.info();
      result.reachable = true;
      result.usedMemoryBytes = parseInfoNumber(info, "used_memory");
      result.maxMemoryBytes = parseInfoNumber(info, "maxmemory");
      result.rejectedConnections = parseInfoNumber(info, "rejected_connections");
      result.evictedKeys = parseInfoNumber(info, "evicted_keys");
      result.connectedClients = parseInfoNumber(info, "connected_clients");
      return result;
    } catch (error: unknown) {
      result.error = redactSensitiveText(error instanceof Error ? error.message : String(error));
      return result;
    } finally {
      try {
        await client.quit();
      } catch {
        await client.disconnect().catch(() => undefined);
      }
    }
  }
}

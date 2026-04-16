import { Client } from "pg";

import { redactSensitiveText } from "../core/redaction.js";

type PostgresClientOptions = {
  connectionString?: string;
};

export type PostgresHealthResult = {
  configured: boolean;
  reachable: boolean;
  hasReplicationLag: boolean;
  connectionStringConfigured: boolean;
  currentConnections?: number;
  maxConnections?: number;
  blockedQueries?: number;
  longRunningQueries?: number;
  replicationLagSeconds?: number;
  error?: string;
};

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export class PostgresClient {
  private readonly connectionString: string;

  public constructor(options?: PostgresClientOptions) {
    this.connectionString = (options?.connectionString ?? process.env.POSTGRES_URL ?? "").trim();
  }

  public isEnabled(): boolean {
    return this.connectionString.length > 0;
  }

  public async checkHealth(): Promise<PostgresHealthResult> {
    const result: PostgresHealthResult = {
      configured: this.isEnabled(),
      reachable: false,
      hasReplicationLag: false,
      connectionStringConfigured: this.isEnabled()
    };
    if (!this.isEnabled()) return result;

    const client = new Client({ connectionString: this.connectionString });
    try {
      await client.connect();
      result.reachable = true;

      const [connRes, blockedRes, longRes, replRes] = await Promise.all([
        client.query(
          "select (select count(*)::int from pg_stat_activity) as current_connections, (select setting::int from pg_settings where name = 'max_connections') as max_connections"
        ),
        client.query("select count(*)::int as blocked_queries from pg_stat_activity where wait_event_type = 'Lock'"),
        client.query(
          "select count(*)::int as long_running from pg_stat_activity where state <> 'idle' and now() - query_start > interval '60 seconds'"
        ),
        client.query(
          "select extract(epoch from coalesce(max(replay_lag), interval '0 seconds'))::int as replication_lag_seconds from pg_stat_replication"
        )
      ]);

      result.currentConnections = toNumber(connRes.rows[0]?.current_connections);
      result.maxConnections = toNumber(connRes.rows[0]?.max_connections);
      result.blockedQueries = toNumber(blockedRes.rows[0]?.blocked_queries) ?? 0;
      result.longRunningQueries = toNumber(longRes.rows[0]?.long_running) ?? 0;
      result.replicationLagSeconds = toNumber(replRes.rows[0]?.replication_lag_seconds) ?? 0;
      result.hasReplicationLag = (result.replicationLagSeconds ?? 0) > 30;
      return result;
    } catch (error: unknown) {
      result.error = redactSensitiveText(error instanceof Error ? error.message : String(error));
      return result;
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}

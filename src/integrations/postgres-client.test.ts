import { describe, expect, it } from "vitest";

import { PostgresClient } from "./postgres-client.js";

describe("PostgresClient", () => {
  it("returns not configured when POSTGRES_URL missing", async () => {
    const client = new PostgresClient({ connectionString: "" });
    const health = await client.checkHealth();
    expect(health.configured).toBe(false);
    expect(health.reachable).toBe(false);
  });
});

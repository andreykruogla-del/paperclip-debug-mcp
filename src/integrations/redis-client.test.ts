import { describe, expect, it } from "vitest";

import { RedisClient } from "./redis-client.js";

describe("RedisClient", () => {
  it("returns not configured when REDIS_URL missing", async () => {
    const client = new RedisClient({ url: "" });
    const health = await client.checkHealth();
    expect(health.configured).toBe(false);
    expect(health.reachable).toBe(false);
  });
});

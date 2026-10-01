import { describe, expect, it, vi } from "vitest";
import {
  RESOURCE_KEY_PREFIX,
  RESOURCE_SAMPLE_TTL_SECONDS,
  ResourceReporter,
} from "./ResourceReporter";

const metrics = {
  ts: 1_000,
  cpuPercent: 12.5,
  rssBytes: 300,
  heapUsedBytes: 100,
  heapTotalBytes: 150,
  eventLoopLagMs: 2,
  uptimeSeconds: 60,
};

function build(store = vi.fn().mockResolvedValue("OK")) {
  const warn = vi.fn();
  const reporter = new ResourceReporter({
    shardId: 3,
    version: "1.2.3",
    sample: () => metrics,
    guildCount: () => 42,
    store,
    logger: { warn },
  });
  return { reporter, store, warn };
}

describe("ResourceReporter", () => {
  it("stores the sample under a per-shard key with a TTL", async () => {
    const { reporter, store } = build();
    await reporter.tick();
    expect(store).toHaveBeenCalledTimes(1);
    const [key, value, ttl] = store.mock.calls[0];
    expect(key).toBe(`${RESOURCE_KEY_PREFIX}3`);
    expect(ttl).toBe(RESOURCE_SAMPLE_TTL_SECONDS);
    expect(JSON.parse(value)).toEqual({
      ...metrics,
      source: "bot",
      shardId: 3,
      version: "1.2.3",
      guilds: 42,
    });
  });

  it("does not throw when the store fails, and warns once per outage", async () => {
    const store = vi.fn().mockRejectedValue(new Error("redis down"));
    const { reporter, warn } = build(store);

    await expect(reporter.tick()).resolves.toBeUndefined();
    await reporter.tick();
    expect(warn).toHaveBeenCalledTimes(1);

    store.mockResolvedValue("OK");
    await reporter.tick(); // recovery resets the throttle
    store.mockRejectedValue(new Error("redis down again"));
    await reporter.tick();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

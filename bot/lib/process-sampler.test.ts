import { describe, expect, it } from "vitest";
import { createProcessSampler, eventLoopLagMs, type SamplerDeps } from "./process-sampler";

function fakeDeps(initial: { uptime?: number } = {}) {
  const state = { now: 1_000_000, cpu: 0, uptime: initial.uptime ?? 0, lag: 0 };
  const deps: SamplerDeps = {
    now: () => state.now,
    cpuMicros: () => state.cpu,
    memory: () => ({ rss: 200, heapUsed: 80, heapTotal: 120 }),
    uptimeSeconds: () => state.uptime,
    readEventLoopP99Ms: () => state.lag,
  };
  return { state, deps };
}

describe("createProcessSampler", () => {
  it("reports CPU as a percentage of the real elapsed window", () => {
    const { state, deps } = fakeDeps();
    const sample = createProcessSampler(deps);
    state.now += 5_000;
    state.cpu += 2_500_000; // 2.5s of CPU over 5s
    expect(sample().cpuPercent).toBe(50);
  });

  it("uses the actual elapsed time when a tick is delayed", () => {
    const { state, deps } = fakeDeps();
    const sample = createProcessSampler(deps);
    state.now += 11_000;
    state.cpu += 2_200_000;
    expect(sample().cpuPercent).toBe(20);
  });

  it("makes the first sample the lifetime average, not zero", () => {
    const { state, deps } = fakeDeps({ uptime: 100 });
    state.cpu = 20_000_000; // 20s of CPU in a 100s-old process
    const sample = createProcessSampler(deps);
    expect(sample().cpuPercent).toBe(20);
  });

  it("returns 0 for a zero-length window without discarding the CPU delta", () => {
    const { state, deps } = fakeDeps();
    const sample = createProcessSampler(deps);
    state.cpu += 500_000;
    expect(sample().cpuPercent).toBe(0); // same timestamp as the baseline
    state.now += 1_000;
    expect(sample().cpuPercent).toBe(50); // the 0.5s is still counted
  });

  it("never reports negative CPU", () => {
    const { state, deps } = fakeDeps();
    const sample = createProcessSampler(deps);
    state.cpu = -100;
    state.now += 1_000;
    expect(sample().cpuPercent).toBe(0);
  });

  it("maps memory, lag and uptime and rounds CPU to one decimal", () => {
    const { state, deps } = fakeDeps();
    const sample = createProcessSampler(deps); // baseline taken at uptime 0
    state.lag = 3.25;
    state.uptime = 42;
    state.now += 3_000;
    state.cpu += 1_000_000; // 33.333…%
    expect(sample()).toEqual({
      ts: 1_003_000,
      cpuPercent: 33.3,
      rssBytes: 200,
      heapUsedBytes: 80,
      heapTotalBytes: 120,
      eventLoopLagMs: 3.25,
      uptimeSeconds: 42,
    });
  });
});

describe("eventLoopLagMs", () => {
  it("subtracts the sampling resolution that monitorEventLoopDelay includes in every reading", () => {
    // An idle process reads ~resolution (+ timer granularity), not 0.
    expect(eventLoopLagMs(31_800_000, 20)).toBeCloseTo(11.8);
    expect(eventLoopLagMs(20_000_000, 20)).toBe(0);
  });

  it("never goes negative or non-finite", () => {
    expect(eventLoopLagMs(10_000_000, 20)).toBe(0);
    expect(eventLoopLagMs(Number.NaN, 20)).toBe(0);
    expect(eventLoopLagMs(Number.POSITIVE_INFINITY, 20)).toBe(0);
  });
});

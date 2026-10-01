/**
 * Process-level resource sampler.
 *
 * Mirrored in web/server/utils/admin-resources/process-sampler.ts — the web
 * package doesn't import from bot (or vice versa), so keep the two in sync.
 *
 * CPU is computed from cumulative CPU time over the *real* elapsed window, so
 * a delayed timer tick doesn't inflate the number. The baseline is process
 * start (now - uptime, cpu 0), which makes the first sample the lifetime
 * average instead of a meaningless 0.
 */
import { monitorEventLoopDelay } from "node:perf_hooks";

export interface ProcessMetrics {
  ts: number;
  cpuPercent: number;
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  eventLoopLagMs: number;
  uptimeSeconds: number;
}

export interface SamplerDeps {
  now(): number;
  /** Cumulative user + system CPU time, in microseconds. */
  cpuMicros(): number;
  memory(): { rss: number; heapUsed: number; heapTotal: number };
  uptimeSeconds(): number;
  /** p99 event-loop delay since the previous call, then resets the histogram. */
  readEventLoopP99Ms(): number;
}

/**
 * `monitorEventLoopDelay` reports every sample as the timer's resolution *plus*
 * the real delay, so an idle process reads ~resolution (more on platforms with
 * coarse timers) instead of 0. Subtract the resolution so the figure is lag.
 */
export function eventLoopLagMs(p99Ns: number, resolutionMs: number): number {
  const ms = p99Ns / 1e6 - resolutionMs;
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}

const LOOP_RESOLUTION_MS = 20;

export function createRealSamplerDeps(): SamplerDeps {
  const histogram = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
  histogram.enable();
  return {
    now: () => Date.now(),
    cpuMicros: () => {
      const usage = process.cpuUsage();
      return usage.user + usage.system;
    },
    memory: () => {
      const usage = process.memoryUsage();
      return { rss: usage.rss, heapUsed: usage.heapUsed, heapTotal: usage.heapTotal };
    },
    uptimeSeconds: () => process.uptime(),
    readEventLoopP99Ms: () => {
      const lag = eventLoopLagMs(histogram.percentile(99), LOOP_RESOLUTION_MS);
      histogram.reset();
      return lag;
    },
  };
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function createProcessSampler(
  deps: SamplerDeps = createRealSamplerDeps(),
): () => ProcessMetrics {
  let lastCpu = 0;
  let lastAt = deps.now() - deps.uptimeSeconds() * 1000;

  return () => {
    const now = deps.now();
    const elapsedMs = now - lastAt;
    let cpuPercent = 0;
    if (elapsedMs > 0) {
      const cpu = deps.cpuMicros();
      cpuPercent = Math.max(0, ((cpu - lastCpu) / 1000 / elapsedMs) * 100);
      lastCpu = cpu;
      lastAt = now;
    }
    const memory = deps.memory();
    return {
      ts: now,
      cpuPercent: round1(cpuPercent),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      eventLoopLagMs: deps.readEventLoopP99Ms(),
      uptimeSeconds: deps.uptimeSeconds(),
    };
  };
}

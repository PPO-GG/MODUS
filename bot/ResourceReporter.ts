/**
 * Publishes this shard's own process usage for the admin Resources page.
 *
 * Every shard reports itself (not leader-gated: nothing shared is being done).
 * The sample is a TTL'd Redis key, one per shard, which the dashboard reads on
 * its own 5s tick. A shard that stops reporting goes "stale" in the UI after
 * 15s and its key expires after RESOURCE_SAMPLE_TTL_SECONDS.
 *
 * Keep RESOURCE_KEY_PREFIX in sync with web/server/utils/admin-resources/types.ts.
 */
import type { ProcessMetrics } from "./lib/process-sampler";
import type { Logger } from "./Logger";

export const RESOURCE_KEY_PREFIX = "modus:resources:bot:";
export const RESOURCE_SAMPLE_TTL_SECONDS = 120;
const DEFAULT_INTERVAL_MS = 5_000;

export interface BotResourceSample extends ProcessMetrics {
  source: "bot";
  shardId: number;
  version: string;
  guilds: number;
}

export interface ResourceReporterDeps {
  shardId: number;
  version: string;
  sample: () => ProcessMetrics;
  guildCount: () => number;
  store: (key: string, value: string, ttlSeconds: number) => Promise<unknown>;
  logger: Pick<Logger, "warn">;
  intervalMs?: number;
}

export class ResourceReporter {
  private timer: NodeJS.Timeout | null = null;
  private failing = false;

  constructor(private deps: ResourceReporterDeps) {}

  start(): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.deps.intervalMs ?? DEFAULT_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    try {
      const sample: BotResourceSample = {
        ...this.deps.sample(),
        source: "bot",
        shardId: this.deps.shardId,
        version: this.deps.version,
        guilds: this.deps.guildCount(),
      };
      await this.deps.store(
        `${RESOURCE_KEY_PREFIX}${this.deps.shardId}`,
        JSON.stringify(sample),
        RESOURCE_SAMPLE_TTL_SECONDS,
      );
      this.failing = false;
    } catch (err) {
      // Warn once per outage so a Redis blip doesn't log every 5s.
      if (!this.failing) {
        this.failing = true;
        void this.deps.logger.warn(
          `Resource report failed: ${err instanceof Error ? err.message : String(err)}`,
          undefined,
          "resources",
        );
      }
    }
  }
}

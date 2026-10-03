export interface CoalescerOptions {
  /** Minimum gap between two runs for the same key. */
  minIntervalMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface KeyState {
  running: boolean;
  pending: boolean;
  lastStart: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Serializes work per key and collapses a burst into at most one follow-up.
 * While a run is in flight, further calls just mark the key dirty; the
 * in-flight caller loops once more (after the min interval) and the final
 * state wins. `fn` must not throw — callers wrap their own error handling.
 */
export class KeyedCoalescer {
  private readonly states = new Map<string, KeyState>();
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: CoalescerOptions) {
    this.minIntervalMs = options.minIntervalMs;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async run(key: string, fn: () => Promise<void>): Promise<void> {
    this.prune();
    let state = this.states.get(key);
    if (!state) {
      state = { running: false, pending: false, lastStart: 0 };
      this.states.set(key, state);
    }
    if (state.running) {
      state.pending = true;
      return;
    }
    state.running = true;
    try {
      do {
        state.pending = false;
        if (state.lastStart > 0) {
          const wait = state.lastStart + this.minIntervalMs - this.now();
          if (wait > 0) await this.sleep(wait);
        }
        state.lastStart = this.now();
        await fn();
      } while (state.pending);
    } finally {
      state.running = false;
    }
  }

  /** Drops idle keys whose throttle window has passed so the map cannot grow forever. */
  private prune(): void {
    if (this.states.size < 500) return;
    const cutoff = this.now() - this.minIntervalMs;
    for (const [key, state] of this.states) {
      if (!state.running && state.lastStart < cutoff) this.states.delete(key);
    }
  }
}

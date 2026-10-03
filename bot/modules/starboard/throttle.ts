/** Lets a given key log at most once per `ttlMs` (used for per-board permission warnings). */
export class LogThrottle {
  private readonly last = new Map<string, number>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  shouldLog(key: string): boolean {
    const t = this.now();
    const previous = this.last.get(key);
    if (previous !== undefined && t - previous < this.ttlMs) return false;
    this.last.set(key, t);
    return true;
  }
}

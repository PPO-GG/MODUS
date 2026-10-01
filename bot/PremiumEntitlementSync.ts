/**
 * Keeps `guild_entitlements` in step with Discord for the Modus Premium SKU.
 *
 * Two inputs: gateway events (immediate) and an hourly reconcile against the
 * entitlements API (catches events missed while offline). Reconcile runs on
 * whichever shard holds the "premium-sync" leader lease (see bot/index.ts).
 * Writes are idempotent, so it doesn't matter which shard receives an event.
 */
import type { EntitlementInput } from "@modus/db";
import {
  toEntitlementInput,
  type EntitlementLike,
} from "./lib/entitlements";

const RECONCILE_INTERVAL_MS = 60 * 60 * 1000;

export interface EntitlementStore {
  upsert(input: EntitlementInput): Promise<void>;
  markDeleted(id: string): Promise<void>;
  listActiveIds(skuId: string): Promise<string[]>;
}

export interface SyncLogger {
  info(message: string, guildId?: string, module?: string): void;
  warn(message: string, guildId?: string, module?: string): void;
  error(message: string, guildId: string | undefined, err: unknown, module?: string): void;
}

export class PremiumEntitlementSync {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private opts: {
      skuId: string;
      store: EntitlementStore;
      fetchActive: (skuId: string) => Promise<EntitlementLike[]>;
      logger: SyncLogger;
    },
  ) {}

  async handleUpsert(e: EntitlementLike): Promise<void> {
    if (e.skuId !== this.opts.skuId || !e.guildId) return;
    await this.opts.store.upsert(toEntitlementInput(e, e.guildId));
  }

  async handleDelete(e: EntitlementLike): Promise<void> {
    if (e.skuId !== this.opts.skuId || !e.guildId) return;
    await this.opts.store.markDeleted(e.id);
  }

  /**
   * Upsert everything Discord reports as live, then revoke any row we think is
   * active that Discord no longer lists. If the fetch throws nothing is
   * revoked — a partial or failed listing must never strip subscriptions.
   *
   * The active-row snapshot is taken BEFORE the fetch: a subscription bought
   * while the (paginated, sequential) reconcile runs arrives via its create
   * event, is absent from Discord's earlier listing, and must not be revoked.
   */
  async reconcile(): Promise<{ upserted: number; revoked: number }> {
    const knownActive = await this.opts.store.listActiveIds(this.opts.skuId);
    const live = await this.opts.fetchActive(this.opts.skuId);
    const seen = new Set<string>();
    let upserted = 0;
    for (const e of live) {
      seen.add(e.id);
      if (!e.guildId) continue;
      await this.handleUpsert(e);
      upserted++;
    }
    let revoked = 0;
    for (const id of knownActive) {
      if (seen.has(id)) continue;
      await this.opts.store.markDeleted(id);
      revoked++;
    }
    return { upserted, revoked };
  }

  start(): void {
    this.runReconcile();
    this.timer = setInterval(() => this.runReconcile(), RECONCILE_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private runReconcile(): void {
    if (this.running) return;
    this.running = true;
    this.reconcile()
      .then(({ upserted, revoked }) => {
        this.opts.logger.info(
          `Premium entitlement reconcile: ${upserted} active, ${revoked} revoked`,
          undefined,
          "premium",
        );
      })
      .catch((err) => {
        this.opts.logger.error("Premium entitlement reconcile failed", undefined, err, "premium");
      })
      .finally(() => {
        this.running = false;
      });
  }
}

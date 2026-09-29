import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb } from "../client";
import { ticketRecords } from "../schema";
import { TicketRepository } from "./tickets";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("TicketRepository (integration)", () => {
  const { db, pool } = createDb({ url });
  const repo = new TicketRepository(db);
  const guildId = `test-${randomUUID()}`;
  const ticket = (n: number, threadId: string, openedAt: Date) => ({
    guildId, threadId, ticketNumber: n, ownerId: "u1", ownerTag: "owner#1", typeId: null,
    priority: "normal" as const, status: "open" as const, claimedBy: null, claimedByTag: null, openedAt,
  });

  afterAll(async () => {
    await db.delete(ticketRecords).where(eq(ticketRecords.guildId, guildId));
    await pool.end();
  });

  it("upserts by thread and lists open tickets oldest first", async () => {
    await repo.upsert(ticket(2, `${guildId}-b`, new Date("2026-01-02")));
    await repo.upsert(ticket(1, `${guildId}-a`, new Date("2026-01-01")));
    await repo.upsert({ ...ticket(1, `${guildId}-a`, new Date("2026-01-01")), status: "claimed", claimedBy: "m1", claimedByTag: "mod#1", ownerTag: null });
    const open = await repo.listOpen(guildId);
    expect(open.map((t) => t.ticketNumber)).toEqual([1, 2]);
    expect(open[0].status).toBe("claimed");
    expect(open[0].ownerTag).toBe("owner#1"); // null tag doesn't erase a known one
  });

  it("markClosed and closeMissing remove tickets from the open list", async () => {
    await repo.markClosed(`${guildId}-a`);
    await repo.upsert(ticket(3, `${guildId}-c`, new Date("2026-01-03")));
    const closed = await repo.closeMissing(guildId, [`${guildId}-c`]);
    expect(closed).toBe(1); // -b
    expect((await repo.listOpen(guildId)).map((t) => t.ticketNumber)).toEqual([3]);
  });

  it("closeMissing with olderThan spares tickets touched after the scan started", async () => {
    const scanStartedAt = new Date();
    await new Promise((r) => setTimeout(r, 20));
    await repo.upsert(ticket(4, `${guildId}-d`, new Date("2026-01-04"))); // opened mid-scan
    const closed = await repo.closeMissing(guildId, [`${guildId}-c`], scanStartedAt);
    expect(closed).toBe(0);
    expect((await repo.listOpen(guildId)).map((t) => t.ticketNumber)).toEqual([3, 4]);
  });
});

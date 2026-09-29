/**
 * One-time backfill: copy each guild's moderation `settings.warnings[]`
 * into `moderation_cases`, preserving case numbers and timestamps.
 *
 * Idempotent: rows are inserted with ON CONFLICT DO NOTHING on
 * (guild_id, case_number), so re-running is safe.
 *
 * Usage:
 *   pnpm --filter @modus/db run migrate:mod-cases [--dry-run]
 *
 * DATABASE_URL is read from the environment, else from the repo-root .env
 * (then packages/db/.env) — the same files drizzle.config.ts loads.
 */
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { createDb } from "../src/client";
import { guildConfigs } from "../src/schema";
import { ModerationCaseRepository } from "../src/repositories/moderation-cases";

// Existing environment variables win; files never override them.
for (const file of [path.resolve(__dirname, "../../../.env"), path.resolve(__dirname, "../.env")]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

interface LegacyWarning {
  caseId: number;
  moderatorId?: string;
  moderatorTag?: string;
  targetId: string;
  targetTag?: string;
  reason?: string;
  timestamp?: string;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { db, pool } = createDb();
  const repo = new ModerationCaseRepository(db);
  try {
    const rows = await db.select().from(guildConfigs).where(eq(guildConfigs.moduleName, "moderation"));
    let inserted = 0;
    let skipped = 0;
    for (const row of rows) {
      const settings = (typeof row.settings === "string" ? JSON.parse(row.settings) : row.settings) as {
        warnings?: LegacyWarning[];
      };
      for (const w of settings.warnings ?? []) {
        if (!w?.caseId || !w.targetId) continue;
        if (dryRun) {
          inserted++;
          continue;
        }
        const d = w.timestamp ? new Date(w.timestamp) : undefined;
        const ok = await repo.insertIfAbsent({
          guildId: row.guildId,
          caseNumber: w.caseId,
          action: "warn",
          targetId: w.targetId,
          targetTag: w.targetTag ?? w.targetId,
          moderatorId: w.moderatorId ?? null,
          moderatorTag: w.moderatorTag ?? null,
          reason: w.reason ?? null,
          source: "command",
          createdAt: d && !Number.isNaN(d.getTime()) ? d : undefined,
        });
        if (ok) inserted++;
        else skipped++;
      }
    }
    console.log(`${dryRun ? "[dry-run] would insert" : "inserted"} ${inserted}, skipped ${skipped} existing`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

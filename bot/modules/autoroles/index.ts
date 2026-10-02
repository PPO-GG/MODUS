import { Events, type Guild, type GuildMember } from "discord.js";
import { BotModule, ModuleManager } from "../../ModuleManager";
import { onLevelUp } from "../../lib/levelEvents";
import { parseAutoRoles } from "./rules";
import { hasRequirement } from "./requirements";
import {
  grantQualifyingRoles,
  tryGrant,
  type GrantDeps,
  type GrantMember,
} from "./grant";
import { sweepGuild, type SweepDeps } from "./sweep";

const MODULE = "autoroles";
const SWEEP_INTERVAL_MS = 10 * 60_000;
/** Give the gateway time to populate the guild cache before the first sweep. */
const FIRST_SWEEP_DELAY_MS = 60_000;
/** How long the sweep remembers that a user could not be fetched (left the guild). */
const MISSING_MEMBER_TTL_MS = 60 * 60_000;

/** `${guildId}:${userId}` -> expiry (ms). Stops the sweep re-fetching departed members every tick. */
const missingMembers = new Map<string, number>();

function grantDeps(moduleManager: ModuleManager): GrantDeps {
  return {
    grants: moduleManager.databaseService.autoroleGrants,
    logger: moduleManager.logger,
    nowMs: () => Date.now(),
  };
}

/** Enabled-module check + parsed, valid rules for a guild. */
async function loadRules(moduleManager: ModuleManager, guildId: string) {
  const db = moduleManager.databaseService;
  if (!(await db.isModuleEnabled(guildId, MODULE))) return [];
  const settings = await db.getModuleSettings(guildId, MODULE);
  return parseAutoRoles(settings).rules.filter((r) => r.enabled);
}

function asGrantMember(member: GuildMember): GrantMember {
  return member as unknown as GrantMember;
}

function buildSweepDeps(moduleManager: ModuleManager, guild: Guild): SweepDeps {
  const db = moduleManager.databaseService;
  const gdeps = grantDeps(moduleManager);
  return {
    loadSettings: () => db.getModuleSettings(guild.id, MODULE),
    listGranted: (ruleId) => db.autoroleGrants.listGrantedUserIds(guild.id, ruleId),
    reconcile: (keep) => db.autoroleGrants.deleteRulesNotIn(guild.id, keep),
    listLevels: (min) => db.listOptedInXpLevels(guild.id, min),
    fetchMembers: async () => {
      // A warm cache avoids a full member fetch (gateway-rate-limited) every tick.
      const source =
        guild.members.cache.size >= guild.memberCount
          ? guild.members.cache
          : await guild.members.fetch();
      return [...source.values()].map(asGrantMember);
    },
    getMember: async (userId) => {
      const cached = guild.members.cache.get(userId);
      if (cached) return asGrantMember(cached);
      const missKey = `${guild.id}:${userId}`;
      const missUntil = missingMembers.get(missKey);
      if (missUntil !== undefined && missUntil > Date.now()) return null;
      const fetched = await guild.members.fetch(userId).catch(() => null);
      if (!fetched) {
        missingMembers.set(missKey, Date.now() + MISSING_MEMBER_TTL_MS);
        return null;
      }
      return asGrantMember(fetched);
    },
    tryGrant: (member, rule) => tryGrant(gdeps, member, rule),
    nowMs: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

let sweeping = false;

/**
 * Runs on every shard over the guilds that shard owns. Deliberately NOT
 * leader-gated: each guild belongs to exactly one shard, so there is no
 * duplicate work, and leader gating would skip every other shard's guilds.
 */
async function runSweep(moduleManager: ModuleManager): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    for (const guild of moduleManager.client.guilds.cache.values()) {
      try {
        if (!(await moduleManager.databaseService.isModuleEnabled(guild.id, MODULE))) continue;
        await sweepGuild(buildSweepDeps(moduleManager, guild));
      } catch (err) {
        moduleManager.logger.error("Auto roles sweep failed for guild", guild.id, err, MODULE);
      }
    }
  } finally {
    sweeping = false;
  }
}

function registerAutoRolesEvents(moduleManager: ModuleManager): void {
  const { client, logger, databaseService: db } = moduleManager;

  /** Join-path evaluation, shared by the join event and the end of Membership Screening. */
  const evaluateJoin = async (member: GuildMember): Promise<void> => {
    const rules = await loadRules(moduleManager, member.guild.id);
    if (rules.length === 0) return;
    await grantQualifyingRoles(grantDeps(moduleManager), asGrantMember(member), rules, {
      level: null,
      isJoinEvent: true,
    });
  };

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      if (member.user.bot) return;
      // A fresh join holds no roles, so any grant rows left over from a leave
      // the bot missed (downtime) are stale and would block every grant.
      await db.autoroleGrants.deleteByMember(member.guild.id, member.id);
      await evaluateJoin(member);
    } catch (err) {
      logger.error("Auto roles join handler failed", member.guild.id, err, MODULE);
    }
  });

  // Members held in Membership Screening are skipped on join; evaluate them once they accept.
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      if (newMember.user.bot) return;
      if (oldMember.pending !== true || newMember.pending !== false) return;
      await evaluateJoin(newMember);
    } catch (err) {
      logger.error("Auto roles screening handler failed", newMember.guild.id, err, MODULE);
    }
  });

  // Tenure restarts on rejoin, so the member can earn their roles again.
  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      await db.autoroleGrants.deleteByMember(member.guild.id, member.id);
    } catch (err) {
      logger.error("Auto roles leave cleanup failed", member.guild.id, err, MODULE);
    }
  });

  onLevelUp(async ({ guildId, userId, level }) => {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
      const rules = (await loadRules(moduleManager, guildId)).filter((r) =>
        hasRequirement(r, "level"),
      );
      if (rules.length === 0) return;
      const member =
        guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
      if (!member) return;
      await grantQualifyingRoles(grantDeps(moduleManager), asGrantMember(member), rules, {
        level,
        isJoinEvent: false,
      });
    } catch (err) {
      logger.error("Auto roles level-up handler failed", guildId, err, MODULE);
    }
  });

  setTimeout(() => {
    void runSweep(moduleManager);
    setInterval(() => void runSweep(moduleManager), SWEEP_INTERVAL_MS).unref();
  }, FIRST_SWEEP_DELAY_MS).unref();

  logger.info("Auto roles events registered.", undefined, MODULE);
}

const autorolesModule: BotModule = {
  name: MODULE,
  description: "Automatically grants roles to members who meet configured requirements",
  registerEvents: registerAutoRolesEvents,
  meta: {
    displayName: "Auto Roles",
    category: "community",
    icon: "i-lucide-user-check",
    color: "teal",
    tags: ["roles", "level", "tenure", "join", "automatic", "rewards"],
  },
  // No slash command: configured entirely from the dashboard. ModuleManager
  // still requires an execute function to load a module.
  execute: async () => undefined,
};

export default autorolesModule;

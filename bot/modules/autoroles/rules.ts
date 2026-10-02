import { AutoRoleSchema, MAX_AUTOROLES_PER_GUILD, type AutoRole } from "../../lib/schemas";

export interface ParsedAutoRoles {
  /** Valid rules only (enabled or not), capped at MAX_AUTOROLES_PER_GUILD. */
  rules: AutoRole[];
  /**
   * Ids of EVERY stored rule, valid or not, so reconcile never deletes the
   * grants of a rule that is merely malformed. null means the settings had no
   * `rules` array at all (config row absent, or DatabaseService swallowed a DB
   * error and returned {}) — callers must NOT reconcile in that case.
   */
  allRuleIds: string[] | null;
  invalidCount: number;
}

export function parseAutoRoles(raw: unknown): ParsedAutoRoles {
  const stored = (raw as { rules?: unknown } | null | undefined)?.rules;
  if (!Array.isArray(stored)) {
    return { rules: [], allRuleIds: null, invalidCount: 0 };
  }

  const rules: AutoRole[] = [];
  const allRuleIds: string[] = [];
  let invalidCount = 0;

  for (const entry of stored) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (typeof id === "string" && id.length > 0) allRuleIds.push(id);
    const parsed = AutoRoleSchema.safeParse(entry);
    if (parsed.success) {
      if (rules.length < MAX_AUTOROLES_PER_GUILD) rules.push(parsed.data);
    } else {
      invalidCount++;
    }
  }

  return { rules, allRuleIds, invalidCount };
}

/**
 * Handler factories for POST /api/automod/draft and GET /api/automod/draft-status.
 * All I/O is injected (see DraftDeps) so the logic runs under vitest without
 * Nitro globals; automod-draft-runtime.ts wires the real implementations.
 */
import {
  buildDraftPrompt,
  buildRepairMessage,
  extractJsonObject,
  LIMITS,
  validateRuleDraft,
  type DraftRule,
  type GuildContext,
  type ValidationResult,
} from "@modus/db/automod-rules";
import type {
  CompleteTextInput,
  CompleteTextResult,
  GuildAiResolution,
  GuildAiUnavailableReason,
} from "./guild-ai";
import type { Repos } from "./db";

export const DRAFT_COOLDOWN_MS = 10_000;

export type DraftRepos = Pick<Repos, "guildConfigs" | "servers" | "aiUsage">;

export interface DraftDeps<E> {
  readBody(event: E): Promise<unknown>;
  getQuery(event: E): Record<string, unknown>;
  requireModuleAccess(event: E, guildId: string): Promise<{ userId: string }>;
  getRepos(): DraftRepos | null;
  resolveGuildAi(repos: DraftRepos, guildId: string): Promise<GuildAiResolution>;
  completeText(input: CompleteTextInput): Promise<CompleteTextResult>;
  fetchGuildContext(guildId: string): Promise<GuildContext>;
  now(): number;
  createHttpError(statusCode: number, statusMessage: string, data?: unknown): Error;
  logError(message: string, error: unknown): void;
}

export interface DraftResponse {
  rule: DraftRule;
  warnings: string[];
  notes: string[];
}

export interface DraftStatusResponse {
  available: boolean;
  source: "guild" | "shared" | null;
  reason?: GuildAiUnavailableReason;
}

const DB_UNAVAILABLE = "Database unavailable (NUXT_DATABASE_URL not set).";

export function createDraftStatusHandler<E>(deps: DraftDeps<E>) {
  return async (event: E): Promise<DraftStatusResponse> => {
    const guildId = String(deps.getQuery(event).guild_id ?? "");
    if (!guildId) throw deps.createHttpError(400, "Missing guild_id parameter.");
    await deps.requireModuleAccess(event, guildId);
    const repos = deps.getRepos();
    if (!repos) throw deps.createHttpError(503, DB_UNAVAILABLE);

    const ai = await deps.resolveGuildAi(repos, guildId);
    return ai.ok
      ? { available: true, source: ai.keySource }
      : { available: false, source: null, reason: ai.reason };
  };
}

export function createDraftHandler<E>(deps: DraftDeps<E>) {
  // Per-instance, in-memory: keeps a double-click or a hammered broken key from
  // spending provider quota. Keyed by guild + user.
  const lastCall = new Map<string, number>();

  return async (event: E): Promise<DraftResponse> => {
    const body = (await deps.readBody(event)) as {
      guild_id?: unknown;
      prompt?: unknown;
    } | null;
    const guildId = typeof body?.guild_id === "string" ? body.guild_id : "";
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!guildId || !prompt) {
      throw deps.createHttpError(400, "guild_id and prompt are required.");
    }
    if (prompt.length > LIMITS.promptMax) {
      throw deps.createHttpError(
        400,
        `Prompt must be ${LIMITS.promptMax} characters or fewer.`,
      );
    }

    const { userId } = await deps.requireModuleAccess(event, guildId);
    const repos = deps.getRepos();
    if (!repos) throw deps.createHttpError(503, DB_UNAVAILABLE);

    const key = `${guildId}:${userId}`;
    const now = deps.now();
    const last = lastCall.get(key);
    if (last !== undefined && now - last < DRAFT_COOLDOWN_MS) {
      throw deps.createHttpError(
        429,
        "Please wait a few seconds before generating another draft.",
      );
    }

    // Claim the slot before any await so two simultaneous requests cannot both
    // pass the check above; give it back if this request never reaches the provider.
    lastCall.set(key, now);
    let ai: GuildAiResolution;
    try {
      ai = await deps.resolveGuildAi(repos, guildId);
    } catch (error) {
      lastCall.delete(key);
      throw error;
    }
    if (!ai.ok) {
      lastCall.delete(key);
      throw deps.createHttpError(403, "AI drafts are not available for this server.", {
        reason: ai.reason,
      });
    }

    let context: GuildContext;
    try {
      context = await deps.fetchGuildContext(guildId);
    } catch (error) {
      deps.logError("Could not load guild roles/channels", error);
      throw deps.createHttpError(502, "Could not load this server's roles and channels.");
    }

    const { system, user } = buildDraftPrompt(context, prompt);

    const callModel = async (userMessage: string): Promise<string> => {
      let result: CompleteTextResult;
      try {
        result = await deps.completeText({
          provider: ai.provider,
          apiKey: ai.apiKey,
          model: ai.model,
          baseUrl: ai.baseUrl,
          system,
          user: userMessage,
          maxOutputTokens: ai.maxOutputTokens,
        });
      } catch (error) {
        deps.logError("AI provider request failed", error);
        throw deps.createHttpError(
          502,
          "The AI provider request failed. Check the AI settings and try again.",
        );
      }
      try {
        await repos.aiUsage.log({
          guildId,
          userId,
          provider: ai.provider,
          model: ai.model,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          total_tokens: result.inputTokens + result.outputTokens,
          action: "automod_draft",
          key_source: ai.keySource,
        });
      } catch (error) {
        deps.logError("Could not log AI usage", error);
      }
      return result.text;
    };

    const check = (text: string): ValidationResult => {
      const parsed = extractJsonObject(text);
      if (parsed === null) {
        return { ok: false, errors: ["Reply was not a single complete JSON object."] };
      }
      return validateRuleDraft(parsed, context);
    };

    const first = await callModel(user);
    let outcome = check(first);
    if (!outcome.ok) {
      const second = await callModel(
        `${user}\n\n${buildRepairMessage(first, outcome.errors)}`,
      );
      outcome = check(second);
    }
    if (!outcome.ok) {
      throw deps.createHttpError(
        422,
        "The AI could not produce a valid rule. Try rephrasing your request.",
        { errors: outcome.errors },
      );
    }
    return { rule: outcome.rule, warnings: outcome.warnings, notes: outcome.notes };
  };
}

/**
 * Resolve which AI key a guild may use from the web server, and make a single
 * chat completion with it. Mirrors the key-selection rules of bot/modules/ai.ts
 * (guild key first, else premium + shared key) but reads the shared key from the
 * database global config only; the bot's AI_API_KEY env var is invisible here.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Repos } from "./db";

const DEFAULT_PROVIDER = "Groq";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

/** A rule is a JSON document; the chat default of 512 output tokens truncates it. */
export const DRAFT_MIN_OUTPUT_TOKENS = 1024;
export const DRAFT_MAX_OUTPUT_TOKENS = 4096;

export type GuildAiUnavailableReason = "not_premium" | "no_shared_key";

export interface ResolvedGuildAi {
  ok: true;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  keySource: "guild" | "shared";
  maxOutputTokens: number;
}

export type GuildAiResolution =
  | ResolvedGuildAi
  | { ok: false; reason: GuildAiUnavailableReason };

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

function clampTokens(value: unknown): number {
  const n =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DRAFT_MIN_OUTPUT_TOKENS;
  return Math.min(
    DRAFT_MAX_OUTPUT_TOKENS,
    Math.max(DRAFT_MIN_OUTPUT_TOKENS, Math.floor(n)),
  );
}

export async function resolveGuildAi(
  repos: Pick<Repos, "guildConfigs" | "servers">,
  guildId: string,
): Promise<GuildAiResolution> {
  const settings = await repos.guildConfigs.getModuleSettings(guildId, "ai");
  const guildKey = text(settings.aiApiKey);
  if (guildKey) {
    return {
      ok: true,
      provider: text(settings.aiProvider) || DEFAULT_PROVIDER,
      apiKey: guildKey,
      model: text(settings.aiModel) || DEFAULT_MODEL,
      baseUrl: text(settings.aiBaseUrl),
      keySource: "guild",
      maxOutputTokens: clampTokens(settings.maxOutputTokens),
    };
  }

  if (!(await repos.servers.isPremium(guildId))) {
    return { ok: false, reason: "not_premium" };
  }

  const shared = await repos.guildConfigs.getGlobalAIConfig();
  const sharedKey = text(shared?.aiApiKey);
  if (!shared || !sharedKey) return { ok: false, reason: "no_shared_key" };
  return {
    ok: true,
    provider: text(shared.aiProvider) || DEFAULT_PROVIDER,
    apiKey: sharedKey,
    model: text(shared.aiModel) || DEFAULT_MODEL,
    baseUrl: text(shared.aiBaseUrl),
    keySource: "shared",
    maxOutputTokens: clampTokens(shared.maxOutputTokens),
  };
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  OpenAI: "https://api.openai.com/v1",
  "Google Gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
  Groq: "https://api.groq.com/openai/v1",
};

/**
 * Same provider table as bot/modules/ai.ts. The "OpenAI Compatible" base URL is
 * guild-controlled, so it must parse and be http(s) (as in api/ai/models.post.ts).
 */
export function resolveProviderBaseUrl(provider: string, custom: string): string {
  if (provider === "OpenAI Compatible") {
    if (!custom) return "http://localhost:11434/v1";
    let parsed: URL;
    try {
      parsed = new URL(custom);
    } catch {
      throw new Error("AI base URL is not a valid URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("AI base URL must be an http(s) URL.");
    }
    return custom;
  }
  return PROVIDER_BASE_URLS[provider] ?? "https://api.openai.com/v1";
}

export interface CompleteTextInput {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  system: string;
  user: string;
  maxOutputTokens: number;
}

export interface CompleteTextResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** One system + one user message in, plain text out. No tools, no temperature. */
export async function completeGuildText(
  input: CompleteTextInput,
): Promise<CompleteTextResult> {
  if (input.provider === "Anthropic Claude") {
    const anthropic = new Anthropic({ apiKey: input.apiKey });
    const response = await anthropic.messages.create({
      model: input.model,
      max_tokens: input.maxOutputTokens,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    });
    const out = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    return {
      text: out,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }

  const openai = new OpenAI({
    apiKey: input.apiKey,
    baseURL: resolveProviderBaseUrl(input.provider, input.baseUrl),
  });
  const response = await openai.chat.completions.create({
    model: input.model,
    max_tokens: input.maxOutputTokens,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  });
  return {
    text: response.choices[0]?.message?.content ?? "",
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

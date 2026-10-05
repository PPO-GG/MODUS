// ── Reasoning-model handling for the AI module ─────────────────────
// Reasoning ("thinking") models spend output tokens on hidden reasoning before
// they answer. Under the shared key's small output cap that reasoning can eat
// the whole budget, leaving an empty reply. These helpers turn reasoning off
// where the provider allows it and recover when a reply comes back empty.

export interface ReasoningOffOptions {
  /** Extra request-body fields for the chat-completions call. */
  body: Record<string, unknown>;
  /** Text appended to the system prompt (Qwen's "/no_think" soft switch). */
  systemSuffix: string;
}

/**
 * Request options that disable (or, where it can't be disabled, minimise)
 * reasoning for the given provider/model. Unknown models get nothing extra.
 */
export function reasoningOffOptions(provider: string, model: string): ReasoningOffOptions {
  const id = model.toLowerCase();
  const none: ReasoningOffOptions = { body: {}, systemSuffix: "" };

  if (provider === "Groq") {
    if (id.includes("qwen")) return { body: { reasoning_effort: "none" }, systemSuffix: "" };
    // gpt-oss can't turn reasoning off; "low" is the smallest setting.
    if (id.includes("gpt-oss")) return { body: { reasoning_effort: "low" }, systemSuffix: "" };
    return none;
  }

  if (provider === "OpenAI Compatible" && id.includes("qwen")) {
    // vLLM/SGLang honor chat_template_kwargs; Ollama/LM Studio ignore it but
    // honor Qwen's /no_think soft switch in the system prompt.
    return {
      body: { chat_template_kwargs: { enable_thinking: false } },
      systemSuffix: "/no_think",
    };
  }

  // Gemini 2.5 Flash / Flash-Lite can disable thinking; Pro cannot.
  if (provider === "Google Gemini" && id.includes("gemini-2.5-flash")) {
    return { body: { reasoning_effort: "none" }, systemSuffix: "" };
  }

  return none;
}

/**
 * Remove `<think>…</think>` blocks some servers leave inline in the reply.
 * An unclosed block means the reply was cut off mid-thought: drop it all.
 */
export function stripReasoning(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();
}

/** True when the provider stopped because it hit the output-token limit. */
export function isTruncated(finishReason: string | undefined): boolean {
  return finishReason === "length" || finishReason === "max_tokens";
}

/** Output budget for the one retry after a reply came back empty and truncated. */
export function raisedOutputBudget(maxOutputTokens: number): number {
  return Math.min(Math.max(maxOutputTokens * 4, 2048), 8192);
}

/** What to tell the user when the model still produced no text. */
export function emptyReplyMessage(finishReason: string | undefined): string {
  return isTruncated(finishReason)
    ? "⚠️ I ran out of room before I could finish that answer. Try asking something narrower."
    : "🤔 I couldn't come up with an answer for that. Try rephrasing?";
}

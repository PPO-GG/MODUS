import { describe, expect, it } from "vitest";
import {
  emptyReplyMessage,
  isTruncated,
  raisedOutputBudget,
  reasoningOffOptions,
  stripReasoning,
} from "./aiReasoning";

describe("stripReasoning", () => {
  it("removes a closed think block and trims", () => {
    expect(stripReasoning("<think>\nhmm, let me see\n</think>\n\nThe answer is 4.")).toBe(
      "The answer is 4.",
    );
  });

  it("removes the empty think block a no-think Qwen still emits", () => {
    expect(stripReasoning("<think>\n\n</think>\n\nHi!")).toBe("Hi!");
  });

  it("drops an unclosed think block (reply cut off mid-thought)", () => {
    expect(stripReasoning("<think>\nthe user wants news about")).toBe("");
  });

  it("leaves ordinary text alone", () => {
    expect(stripReasoning("No reasoning here.")).toBe("No reasoning here.");
  });
});

describe("reasoningOffOptions", () => {
  it("turns reasoning off for Qwen on Groq via reasoning_effort", () => {
    expect(reasoningOffOptions("Groq", "qwen/qwen3.8-27b")).toEqual({
      body: { reasoning_effort: "none" },
      systemSuffix: "",
    });
  });

  it("lowers (can't disable) reasoning for gpt-oss on Groq", () => {
    expect(reasoningOffOptions("Groq", "openai/gpt-oss-120b").body).toEqual({
      reasoning_effort: "low",
    });
  });

  it("uses the chat-template switch plus /no_think for Qwen on self-hosted servers", () => {
    expect(reasoningOffOptions("OpenAI Compatible", "qwen/qwen3-30b-a3b")).toEqual({
      body: { chat_template_kwargs: { enable_thinking: false } },
      systemSuffix: "/no_think",
    });
  });

  it("disables thinking for Gemini 2.5 Flash but not Pro (Pro can't turn it off)", () => {
    expect(reasoningOffOptions("Google Gemini", "gemini-2.5-flash").body).toEqual({
      reasoning_effort: "none",
    });
    expect(reasoningOffOptions("Google Gemini", "gemini-2.5-pro").body).toEqual({});
  });

  it("sends nothing extra for non-reasoning models", () => {
    expect(reasoningOffOptions("Groq", "llama-3.3-70b-versatile")).toEqual({
      body: {},
      systemSuffix: "",
    });
    expect(reasoningOffOptions("OpenAI", "gpt-4o-mini").body).toEqual({});
  });
});

describe("isTruncated", () => {
  it("recognises both OpenAI and Anthropic truncation reasons", () => {
    expect(isTruncated("length")).toBe(true);
    expect(isTruncated("max_tokens")).toBe(true);
    expect(isTruncated("stop")).toBe(false);
    expect(isTruncated(undefined)).toBe(false);
  });
});

describe("raisedOutputBudget", () => {
  it("gives a small budget room to finish", () => {
    expect(raisedOutputBudget(512)).toBe(2048);
  });

  it("caps the retry budget", () => {
    expect(raisedOutputBudget(4000)).toBe(8192);
  });
});

describe("emptyReplyMessage", () => {
  it("says it ran out of room when truncated", () => {
    expect(emptyReplyMessage("length")).toMatch(/ran out of room/i);
  });

  it("otherwise asks the user to rephrase", () => {
    expect(emptyReplyMessage("stop")).toMatch(/rephras/i);
  });
});

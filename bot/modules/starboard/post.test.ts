import { describe, expect, it } from "vitest";
import { buildBoardMessage, jumpUrl, type BoardPostInput } from "./post";

const input = (over: Partial<BoardPostInput> = {}): BoardPostInput => ({
  guildId: "g1",
  channelId: "c1",
  messageId: "m1",
  authorName: "Alice",
  authorAvatarUrl: "https://cdn.example/a.png",
  content: "hello world",
  attachments: [],
  createdAtMs: Date.parse("2026-10-02T12:00:00Z"),
  count: 5,
  emojiDisplay: "⭐",
  ...over,
});

describe("jumpUrl", () => {
  it("builds a discord.com message link", () => {
    expect(jumpUrl("g", "c", "m")).toBe("https://discord.com/channels/g/c/m");
  });
});

describe("buildBoardMessage", () => {
  it("renders the header with emoji, live count and source channel", () => {
    expect(buildBoardMessage(input()).content).toBe("⭐ **5** | <#c1>");
  });

  it("renders author, description, timestamp and a jump link field", () => {
    const { embeds } = buildBoardMessage(input());
    expect(embeds).toHaveLength(1);
    const embed = embeds[0]!;
    expect(embed.author).toEqual({ name: "Alice", icon_url: "https://cdn.example/a.png" });
    expect(embed.description).toBe("hello world");
    expect(embed.timestamp).toBe("2026-10-02T12:00:00.000Z");
    expect(embed.fields).toEqual([
      { name: "Source", value: "[Jump to message](https://discord.com/channels/g1/c1/m1)" },
    ]);
  });

  it("omits the avatar icon when there is none and the description when content is empty", () => {
    const embed = buildBoardMessage(input({ authorAvatarUrl: null, content: "" })).embeds[0]!;
    expect(embed.author).toEqual({ name: "Alice" });
    expect(embed.description).toBeUndefined();
  });

  it("truncates very long content", () => {
    const embed = buildBoardMessage(input({ content: "x".repeat(5000) })).embeds[0]!;
    expect(embed.description!.length).toBe(4000);
    expect(embed.description!.endsWith("…")).toBe(true);
  });

  it("shows the first image attachment in the embed and lists the rest", () => {
    const embed = buildBoardMessage(
      input({
        attachments: [
          { url: "https://cdn.example/1.png", name: "1.png", contentType: "image/png", spoiler: false },
          { url: "https://cdn.example/2.png", name: "2.png", contentType: "image/png", spoiler: false },
          { url: "https://cdn.example/doc.pdf", name: "doc.pdf", contentType: "application/pdf", spoiler: false },
        ],
      }),
    ).embeds[0]!;
    expect(embed.image).toEqual({ url: "https://cdn.example/1.png" });
    const field = embed.fields!.find((f) => f.name === "Attachments")!;
    expect(field.value).toBe(
      "[2.png](https://cdn.example/2.png)\n[doc.pdf](https://cdn.example/doc.pdf)",
    );
  });

  it("lists non-image attachments when there is no image, and caps the list at 5", () => {
    const attachments = Array.from({ length: 8 }, (_, i) => ({
      url: `https://cdn.example/${i}.zip`,
      name: `${i}.zip`,
      contentType: "application/zip",
      spoiler: false,
    }));
    const embed = buildBoardMessage(input({ attachments })).embeds[0]!;
    expect(embed.image).toBeUndefined();
    const field = embed.fields!.find((f) => f.name === "Attachments")!;
    expect(field.value.split("\n")).toHaveLength(5);
  });

  it("treats a missing content type as a non-image attachment", () => {
    const embed = buildBoardMessage(
      input({ attachments: [{ url: "https://cdn.example/x", name: "x", contentType: null, spoiler: false }] }),
    ).embeds[0]!;
    expect(embed.image).toBeUndefined();
    expect(embed.fields!.some((f) => f.name === "Attachments")).toBe(true);
  });

  it("never uses a spoiler image as the embed image and picks the next non-spoiler image", () => {
    const embed = buildBoardMessage(
      input({
        attachments: [
          { url: "https://cdn.example/s.png", name: "s.png", contentType: "image/png", spoiler: true },
          { url: "https://cdn.example/ok.png", name: "ok.png", contentType: "image/png", spoiler: false },
        ],
      }),
    ).embeds[0]!;
    expect(embed.image).toEqual({ url: "https://cdn.example/ok.png" });
    const field = embed.fields!.find((f) => f.name === "Attachments")!;
    expect(field.value).toBe("[s.png](https://cdn.example/s.png) (spoiler)");
  });

  it("lists a lone spoiler image as a marked link and sets no embed image", () => {
    const embed = buildBoardMessage(
      input({
        attachments: [
          { url: "https://cdn.example/s.png", name: "s.png", contentType: "image/png", spoiler: true },
        ],
      }),
    ).embeds[0]!;
    expect(embed.image).toBeUndefined();
    const field = embed.fields!.find((f) => f.name === "Attachments")!;
    expect(field.value).toContain("(spoiler)");
  });

  it("cuts a long attachment list on a line boundary, never mid-link", () => {
    const attachments = Array.from({ length: 5 }, (_, i) => ({
      url: `https://cdn.example/${i}/${"u".repeat(150)}`,
      name: `${"n".repeat(60)}${i}.zip`,
      contentType: "application/zip",
      spoiler: false,
    }));
    const field = buildBoardMessage(input({ attachments })).embeds[0]!.fields!.find(
      (f) => f.name === "Attachments",
    )!;
    expect(field.value.length).toBeLessThanOrEqual(1024);
    const lines = field.value.split("\n");
    expect(lines.length).toBeLessThan(5);
    for (const line of lines) expect(line).toMatch(/^\[.+\]\(https:\/\/cdn\.example\/.+\)$/);
  });

  it("escapes brackets and backslashes in attachment names", () => {
    const field = buildBoardMessage(
      input({
        attachments: [
          { url: "https://cdn.example/x", name: "shot[1].png", contentType: "application/zip", spoiler: false },
          { url: "https://cdn.example/y", name: "a\\b", contentType: "application/zip", spoiler: false },
        ],
      }),
    ).embeds[0]!.fields!.find((f) => f.name === "Attachments")!;
    expect(field.value).toBe(
      "[shot\\[1\\].png](https://cdn.example/x)\n[a\\\\b](https://cdn.example/y)",
    );
  });
});

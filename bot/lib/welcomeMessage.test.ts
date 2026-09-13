import { describe, expect, it } from "vitest";
import { WelcomeMessageSchema, WelcomeTemplateSchema } from "./schemas";
import {
  applyWelcomePlaceholders,
  buildWelcomeMessage,
  type WelcomeMessageVars,
} from "./welcomeMessage";

const vars: WelcomeMessageVars = {
  userId: "42",
  username: "newbie",
  displayName: "New Person",
  tag: "newbie#0",
  serverName: "Cool Server",
  memberCount: 123,
};

const image = Buffer.from("png");

function build(settings: Record<string, unknown>, img: Buffer | null = image) {
  return buildWelcomeMessage(WelcomeMessageSchema.parse(settings), vars, img);
}

const embedJson = (payload: ReturnType<typeof buildWelcomeMessage>) =>
  payload!.embeds.map((e) => e.toJSON());

describe("WelcomeMessageSchema", () => {
  it("defaults to the legacy welcome line above the image", () => {
    const settings = WelcomeTemplateSchema.parse({});
    expect(settings.message).toEqual({
      mode: "both",
      order: "text-first",
      title: "",
      body: "Welcome to **{server_name}**, {user}! 🎉",
      accentColor: null,
    });
  });
});

describe("applyWelcomePlaceholders", () => {
  it("substitutes every placeholder", () => {
    expect(
      applyWelcomePlaceholders(
        "{user} {username} {displayname} {tag} {server_name} {member_count}",
        vars,
      ),
    ).toBe("<@42> newbie New Person newbie#0 Cool Server 123");
  });

  it("neutralises markdown and mentions smuggled in through user-controlled names", () => {
    const out = applyWelcomePlaceholders("{displayname}", {
      ...vars,
      displayName: "@everyone **bold** <@&99>",
    });
    expect(out).not.toContain("@everyone");
    expect(out).not.toContain("<@&99>");
    expect(out).toContain("\\*\\*bold\\*\\*");
  });
});

describe("buildWelcomeMessage", () => {
  it("puts the image inside the embed for text-first", () => {
    const payload = build({ title: "Hi {username}", accentColor: "#a78bfa" });
    const [embed] = embedJson(payload);

    expect(payload!.embeds).toHaveLength(1);
    expect(embed!.title).toBe("Hi newbie");
    expect(embed!.description).toBe("Welcome to **Cool Server**, <@42>! 🎉");
    expect(embed!.color).toBe(0xa78bfa);
    expect(embed!.image?.url).toBe("attachment://welcome.png");
    expect(payload!.files).toHaveLength(1);
  });

  it("attaches the image outside the embed for image-first", () => {
    const payload = build({ order: "image-first" });
    const [embed] = embedJson(payload);

    // Discord renders message attachments above embeds.
    expect(embed!.image).toBeUndefined();
    expect(embed!.description).toBe("Welcome to **Cool Server**, <@42>! 🎉");
    expect(payload!.files).toHaveLength(1);
  });

  it("pings the member from the message content when the text uses {user}", () => {
    const payload = build({});
    // Mentions inside embeds render but never notify.
    expect(payload!.content).toBe("<@42>");
    expect(payload!.allowedMentions).toEqual({ users: ["42"] });
  });

  it("sends no content when the text does not mention the member", () => {
    const payload = build({ body: "Welcome to {server_name}" });
    expect(payload!.content).toBeUndefined();
    expect(payload!.allowedMentions).toEqual({ users: [] });
  });

  it("sends only the attached image in image mode", () => {
    const payload = build({ mode: "image" });
    expect(payload!.embeds).toHaveLength(0);
    expect(payload!.content).toBeUndefined();
    expect(payload!.files).toHaveLength(1);
  });

  it("sends only the embed in text mode, without attaching the image", () => {
    const payload = build({ mode: "text" });
    const [embed] = embedJson(payload);
    expect(embed!.image).toBeUndefined();
    expect(payload!.files).toHaveLength(0);
  });

  it("falls back to a text-only embed when the image is unavailable", () => {
    const payload = build({}, null);
    const [embed] = embedJson(payload);
    expect(embed!.image).toBeUndefined();
    expect(payload!.files).toHaveLength(0);
  });

  it("sends just the image when both mode has no text", () => {
    const payload = build({ body: "  " });
    expect(payload!.embeds).toHaveLength(0);
    expect(payload!.files).toHaveLength(1);
  });

  it("leaves the embed uncoloured when no accent colour is set", () => {
    const [embed] = embedJson(build({}));
    expect(embed!.color).toBeUndefined();
  });

  it("returns null when there is nothing to send", () => {
    expect(build({ mode: "image" }, null)).toBeNull();
    expect(build({ mode: "text", body: "  " })).toBeNull();
  });
});

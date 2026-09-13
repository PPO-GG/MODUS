import { describe, expect, it } from "vitest";
import { ComponentType, MessageFlags } from "discord.js";
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

function containerChildren(payload: ReturnType<typeof buildWelcomeMessage>) {
  expect(payload).not.toBeNull();
  const [container] = payload!.components.map((c) => c.toJSON()) as any[];
  expect(container.type).toBe(ComponentType.Container);
  return container;
}

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
  it("puts text above the image for text-first", () => {
    const message = WelcomeMessageSchema.parse({ title: "Hi {username}" });
    const payload = buildWelcomeMessage(message, vars, image);
    const container = containerChildren(payload);

    expect(container.components.map((c: any) => c.type)).toEqual([
      ComponentType.TextDisplay,
      ComponentType.MediaGallery,
    ]);
    expect(container.components[0].content).toBe(
      "# Hi newbie\nWelcome to **Cool Server**, <@42>! 🎉",
    );
    expect(container.components[1].items[0].media.url).toBe(
      "attachment://welcome.png",
    );
    expect(payload!.flags).toBe(MessageFlags.IsComponentsV2);
    expect(payload!.files).toHaveLength(1);
    expect(payload!.allowedMentions).toEqual({ parse: ["roles"], users: ["42"] });
  });

  it("puts the image first for image-first", () => {
    const message = WelcomeMessageSchema.parse({ order: "image-first" });
    const container = containerChildren(buildWelcomeMessage(message, vars, image));
    expect(container.components.map((c: any) => c.type)).toEqual([
      ComponentType.MediaGallery,
      ComponentType.TextDisplay,
    ]);
  });

  it("sends only the image in image mode", () => {
    const message = WelcomeMessageSchema.parse({ mode: "image" });
    const container = containerChildren(buildWelcomeMessage(message, vars, image));
    expect(container.components.map((c: any) => c.type)).toEqual([
      ComponentType.MediaGallery,
    ]);
  });

  it("sends only text in text mode, without attaching the image", () => {
    const message = WelcomeMessageSchema.parse({ mode: "text" });
    const payload = buildWelcomeMessage(message, vars, image);
    const container = containerChildren(payload);
    expect(container.components.map((c: any) => c.type)).toEqual([
      ComponentType.TextDisplay,
    ]);
    expect(payload!.files).toHaveLength(0);
  });

  it("falls back to text when the image is unavailable in both mode", () => {
    const message = WelcomeMessageSchema.parse({});
    const payload = buildWelcomeMessage(message, vars, null);
    const container = containerChildren(payload);
    expect(container.components.map((c: any) => c.type)).toEqual([
      ComponentType.TextDisplay,
    ]);
    expect(payload!.files).toHaveLength(0);
  });

  it("returns null when there is nothing to send", () => {
    expect(
      buildWelcomeMessage(WelcomeMessageSchema.parse({ mode: "image" }), vars, null),
    ).toBeNull();
    expect(
      buildWelcomeMessage(
        WelcomeMessageSchema.parse({ mode: "text", body: "  " }),
        vars,
        image,
      ),
    ).toBeNull();
  });

  it("applies the accent colour to the container", () => {
    const message = WelcomeMessageSchema.parse({ accentColor: "#a78bfa" });
    const container = containerChildren(buildWelcomeMessage(message, vars, image));
    expect(container.accent_color).toBe(0xa78bfa);
  });
});

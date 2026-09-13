import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";

// Illustrator/Figma-style export: the colour lives in a <style> sheet, which
// Skia's SVG renderer ignores (it would draw the rect black).
const STYLESHEET_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <defs><style>.cls-1{fill:#fff;}</style></defs>
  <rect class="cls-1" x="0" y="0" width="100" height="100"/>
</svg>`;

const r2 = vi.hoisted(() => ({
  object: null as { body: Buffer; contentType: string } | null,
}));
const db = vi.hoisted(() => ({ settings: {} as Record<string, any> }));

vi.mock("./db", () => ({
  getRepos: () => ({
    guildConfigs: { getModuleSettings: async () => db.settings },
  }),
}));
vi.mock("./r2", () => ({
  getR2: () => ({}),
  getR2Object: async () => r2.object,
}));
vi.mock("./font-manager", () => ({ ensureTemplateFonts: async () => {} }));

const { renderGuildWelcomeImage } = await import("./welcome-render");

const member = {
  guildId: "1",
  avatarUrl: "",
  username: "u",
  displayName: "u",
  tag: "u",
  serverName: "s",
  memberCount: 1,
};

async function pixelAt(png: Buffer, x: number, y: number) {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return [...ctx.getImageData(x, y, 1, 1).data];
}

describe("renderGuildWelcomeImage SVG layers", () => {
  beforeEach(() => {
    r2.object = {
      body: Buffer.from(STYLESHEET_SVG),
      contentType: "image/svg+xml",
    };
  });

  it("applies <style> stylesheet fills in uploaded SVG image layers", async () => {
    db.settings = {
      canvasWidth: 200,
      canvasHeight: 200,
      backgroundColor: "#1a1a2e",
      elements: [
        {
          id: "logo",
          type: "image",
          // Not ending in .svg: detection must not rely on the extension.
          src: "/api/welcome/bg/welcome/1/layers/abc.png",
          x: 50,
          y: 50,
          width: 100,
          height: 100,
        },
      ],
    };

    const png = await renderGuildWelcomeImage(member);
    expect(await pixelAt(png, 100, 100)).toEqual([255, 255, 255, 255]);
  });

  it("applies <style> stylesheet fills in SVG backgrounds", async () => {
    db.settings = {
      canvasWidth: 200,
      canvasHeight: 200,
      backgroundColor: "#1a1a2e",
      backgroundImage: "/api/welcome/bg/welcome/1/bg.svg",
      elements: [],
    };

    const png = await renderGuildWelcomeImage(member);
    expect(await pixelAt(png, 100, 100)).toEqual([255, 255, 255, 255]);
  });

  it("still tints stylesheet-coloured SVG layers with the layer fill", async () => {
    db.settings = {
      canvasWidth: 200,
      canvasHeight: 200,
      backgroundColor: "#1a1a2e",
      elements: [
        {
          id: "logo",
          type: "image",
          src: "/api/welcome/bg/welcome/1/layers/abc.svg",
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          fill: "#ff0000",
        },
      ],
    };

    const png = await renderGuildWelcomeImage(member);
    expect(await pixelAt(png, 100, 100)).toEqual([255, 0, 0, 255]);
  });
});

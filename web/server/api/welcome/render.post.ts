/**
 * POST /api/welcome/render
 *
 * Server-side welcome image renderer.
 * Called by the bot when a new member joins — renders the template
 * with the member's data and returns a PNG buffer.
 *
 * Auth: X-Render-Key header must match NUXT_RENDER_API_KEY.
 *
 * Body: {
 *   guildId: string,
 *   avatarUrl: string,
 *   username: string,
 *   displayName: string,
 *   tag: string,
 *   serverName: string,
 *   memberCount: number
 * }
 *
 * Response: PNG image buffer (Content-Type: image/png)
 */
import {
  renderGuildWelcomeImage,
  type WelcomeRenderRequest,
} from "../../utils/welcome-render";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  // ── Auth ──
  // Fail closed: this renderer loads images from URLs found in the request
  // body and the guild's template, so it must never be callable without the
  // shared key. A missing key is a misconfiguration, not an open door.
  const renderKey = config.renderApiKey as string;
  if (!renderKey) {
    console.error(
      "[Welcome Render] NUXT_RENDER_API_KEY is not configured — refusing to render.",
    );
    throw createError({
      statusCode: 503,
      statusMessage: "Render endpoint is not configured.",
    });
  }
  const providedKey = getHeader(event, "x-render-key");
  if (providedKey !== renderKey) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // ── Parse body ──
  const body = (await readBody(event)) as WelcomeRenderRequest;
  if (!body?.guildId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing guildId in request body",
    });
  }

  // ── Render ──
  try {
    const imageBuffer = await renderGuildWelcomeImage(body);

    // Return as PNG
    setResponseHeader(event, "Content-Type", "image/png");
    setResponseHeader(event, "Content-Length", imageBuffer.length);
    setResponseHeader(event, "Cache-Control", "no-store");
    return imageBuffer;
  } catch (err) {
    console.error("[Welcome Render] Render failed:", err);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to render welcome image",
    });
  }
});

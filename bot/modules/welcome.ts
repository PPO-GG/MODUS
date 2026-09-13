import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  GuildMember,
  TextChannel,
  NewsChannel,
  ChannelType,
  MessageFlags,
} from "discord.js";
import { BotModule, ModuleManager } from "../ModuleManager";
import {
  WelcomeTemplateSchema,
  type WelcomeTemplateSettings,
} from "../lib/schemas";
import { parseSettings } from "../lib/validateSettings";
import { buildWelcomeMessage } from "../lib/welcomeMessage";

// ── Types ──────────────────────────────────────────────────────────

export interface TemplateElement {
  id: string;
  type:
    | "text"
    | "image"
    | "rect"
    | "circle"
    | "avatar"
    | "triangle"
    | "star"
    | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fill?: string;
  align?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  opacity?: number;
  src?: string;
  radius?: number;
  borderColor?: string;
  borderWidth?: number;
  rotation?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  scaleX?: number;
  scaleY?: number;
  numPoints?: number;
  innerRadius?: number;
  outerRadius?: number;
  points?: number[];
  arrow?: boolean;
  avatarShape?: "circle" | "square";
  avatarCornerRadius?: number;
}

export interface WelcomeTemplate {
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  backgroundImage?: string;
  elements: TemplateElement[];
  channelId?: string;
}

// ── Default Template ───────────────────────────────────────────────

export const DEFAULT_TEMPLATE: WelcomeTemplate = {
  canvasWidth: 1024,
  canvasHeight: 500,
  backgroundColor: "#1a1a2e",
  elements: [
    {
      id: "bg-overlay",
      type: "rect",
      x: 0,
      y: 0,
      width: 1024,
      height: 500,
      fill: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      opacity: 1,
    },
    {
      id: "decoration-top",
      type: "rect",
      x: 0,
      y: 0,
      width: 1024,
      height: 4,
      fill: "linear-gradient(90deg, #6366f1, #a78bfa, #c084fc)",
      opacity: 1,
    },
    {
      id: "avatar",
      type: "avatar",
      x: 512,
      y: 155,
      radius: 80,
      borderColor: "#a78bfa",
      borderWidth: 4,
    },
    {
      id: "welcome-label",
      type: "text",
      x: 512,
      y: 280,
      text: "WELCOME",
      fontSize: 44,
      fontFamily: "sans-serif",
      fontStyle: "bold",
      fill: "#ffffff",
      align: "center",
    },
    {
      id: "username-text",
      type: "text",
      x: 512,
      y: 340,
      text: "{username}",
      fontSize: 30,
      fontFamily: "sans-serif",
      fill: "#a78bfa",
      align: "center",
    },
    {
      id: "server-text",
      type: "text",
      x: 512,
      y: 395,
      text: "to {server_name}",
      fontSize: 20,
      fontFamily: "sans-serif",
      fill: "#9ca3af",
      align: "center",
    },
    {
      id: "member-count",
      type: "text",
      x: 512,
      y: 450,
      text: "Member #{member_count}",
      fontSize: 16,
      fontFamily: "sans-serif",
      fill: "#6b7280",
      align: "center",
    },
  ],
};

// ── Dashboard Render API ───────────────────────────────────────────

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";
const RENDER_API_KEY = process.env.RENDER_API_KEY || "";

/**
 * Request a rendered welcome image from the dashboard server.
 * The dashboard handles Google Font loading and @napi-rs/canvas rendering.
 */
async function renderViaApi(
  guildId: string,
  member: GuildMember,
): Promise<Buffer> {
  const avatarUrl = member.user.displayAvatarURL({
    extension: "png",
    size: 256,
  });

  const response = await fetch(`${DASHBOARD_URL}/api/welcome/render`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(RENDER_API_KEY ? { "X-Render-Key": RENDER_API_KEY } : {}),
    },
    body: JSON.stringify({
      guildId,
      avatarUrl,
      username: member.user.username,
      displayName: member.displayName,
      tag: member.user.tag,
      serverName: member.guild.name,
      memberCount: member.guild.memberCount,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Dashboard render API returned ${response.status}: ${errText}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Build the configured welcome post for a member. Only renders the image when
 * the mode needs it; a failed render in "both" mode falls back to text-only
 * (and is reported via `onRenderError`) instead of dropping the welcome.
 */
async function buildWelcomeForMember(
  settings: WelcomeTemplateSettings,
  member: GuildMember,
  onRenderError: (err: unknown) => void,
) {
  const { message } = settings;
  let image: Buffer | null = null;

  if (message.mode !== "text") {
    try {
      image = await renderViaApi(member.guild.id, member);
    } catch (err) {
      if (message.mode === "image") throw err;
      onRenderError(err);
    }
  }

  return buildWelcomeMessage(
    message,
    {
      userId: member.id,
      username: member.user.username,
      displayName: member.displayName,
      tag: member.user.tag,
      serverName: member.guild.name,
      memberCount: member.guild.memberCount,
    },
    image,
  );
}

// ── Module Definition ──────────────────────────────────────────────

const welcomeModule: BotModule = {
  name: "welcome",
  registerEvents: registerWelcomeEvents,
  description: "Greet new members with a custom image, text, or both",
  meta: {
    displayName: "Welcome",
    category: "engagement",
    icon: "i-lucide-party-popper",
    color: "purple",
    tags: ["canvas", "welcome-card", "join", "greeting", "banner"],
  },
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure the welcome image module")
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set the channel for welcome messages")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("The channel to send welcome images to")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Send a test welcome image for yourself"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Disable welcome messages for this server"),
    )
    .toJSON(),

  execute: async (
    interaction: ChatInputCommandInteraction,
    moduleManager: ModuleManager,
  ) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply("This command can only be used in a server.");
      return;
    }

    const db = moduleManager.databaseService;

    switch (subcommand) {
      case "channel": {
        const channel = interaction.options.getChannel("channel", true);

        // Load current settings and update channelId
        const currentSettings = await db.getModuleSettings(
          guildId,
          "welcome",
        );
        const template = parseSettings(
          WelcomeTemplateSchema,
          { ...currentSettings, channelId: channel.id },
          "welcome",
          guildId,
        ) ?? { ...DEFAULT_TEMPLATE, channelId: channel.id };

        await db.setModuleSettings(guildId, "welcome", template);

        await interaction.editReply(
          `✅ Welcome messages will be sent to <#${channel.id}>!`,
        );
        break;
      }

      case "test": {
        try {
          const member = interaction.member as GuildMember;
          const settings =
            parseSettings(
              WelcomeTemplateSchema,
              await db.getModuleSettings(guildId, "welcome"),
              "welcome",
              guildId,
            ) ?? WelcomeTemplateSchema.parse({});

          let renderError: unknown;
          const payload = await buildWelcomeForMember(
            settings,
            member,
            (err) => (renderError = err),
          );

          if (!payload) {
            await interaction.editReply(
              "❌ Nothing to send — the welcome text is empty. Add some text or switch the message mode on the dashboard.",
            );
            break;
          }

          // Components V2 messages can't carry `content`, so the preview is
          // exactly what members see; any note goes in a follow-up.
          await interaction.editReply(payload);
          if (renderError) {
            await interaction.followUp({
              content: `⚠️ The image failed to render, so only the text was sent: ${renderError instanceof Error ? renderError.message : String(renderError)}`,
              flags: MessageFlags.Ephemeral,
            });
          }
        } catch (err) {
          console.error("[Welcome] Failed to generate test image:", err);
          await moduleManager.logger.error("Error generating test image", guildId, err, "welcome");
          await interaction.editReply(
            `❌ Failed to generate test image: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        break;
      }

      case "disable": {
        await db.setModuleStatus(guildId, "welcome", false);
        await interaction.editReply("✅ Welcome messages have been disabled.");
        break;
      }
    }
  },
};

// ── Event Registration ─────────────────────────────────────────────

export function registerWelcomeEvents(moduleManager: ModuleManager) {
  const client = moduleManager["client"];

  client.on("guildMemberAdd", async (member: GuildMember) => {
    try {
      const guildId = member.guild.id;
      const db = moduleManager.databaseService;

      // Check if module is enabled
      const isEnabled = await db.isModuleEnabled(guildId, "welcome");
      if (!isEnabled) return;

      // Load template to get channelId
      const settings = await db.getModuleSettings(guildId, "welcome");
      if (!settings || !settings.channelId) return;

      const template =
        parseSettings(WelcomeTemplateSchema, settings, "welcome", guildId) ??
        WelcomeTemplateSchema.parse(DEFAULT_TEMPLATE);

      // Get channel
      const channel = member.guild.channels.cache.get(template.channelId!);
      if (
        !channel ||
        !(channel instanceof TextChannel || channel instanceof NewsChannel)
      )
        return;

      const payload = await buildWelcomeForMember(template, member, (err) =>
        moduleManager.logger.error(
          "Welcome image render failed; sending text only",
          guildId,
          err,
          "welcome",
        ),
      );
      if (!payload) return;

      await channel.send(payload);

      moduleManager.logger.info(
        `Sent welcome message for ${member.user.tag}`,
        guildId,
        "welcome",
      );
    } catch (err) {
      moduleManager.logger.error(
        "Failed to send welcome image",
        member.guild.id,
        err,
        "welcome",
      );
    }
  });

  moduleManager.logger.info("guildMemberAdd event listener registered.", undefined, "welcome");
}

export default welcomeModule;

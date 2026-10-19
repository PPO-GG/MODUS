import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  ComponentType,
  type AnyComponentBuilder,
} from "discord.js";
import { BotModule, ModuleManager } from "../ModuleManager";
import { buildV2Layout } from "../lib/components-v2";
import { buildModuleCatalog, type DocsModule } from "../lib/moduleCatalog";

// ─── Helpers ──────────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, string> = {
  help: "❓",
  ping: "🏓",
  music: "🎵",
  embeds: "📝",
  reload: "🔄",
  welcome: "👋",
  tickets: "🎫",
  moderation: "🛡️",
  automod: "🤖",
  antiraid: "🚨",
  ai: "🧠",
};

const PUBLIC_URL = (
  process.env.PUBLIC_WEB_URL ||
  process.env.DASHBOARD_URL ||
  "https://modusbot.io"
).replace(/\/$/, "");

export function getDashboardUrl(guildId?: string | null): string {
  return guildId ? `${PUBLIC_URL}/dashboard/${guildId}` : `${PUBLIC_URL}/dashboard`;
}

function getModuleIcon(name: string): string {
  return MODULE_ICONS[name.toLowerCase()] || "📦";
}

function buildV2HelpPage(pages: DocsModule[], pageIndex: number): any[] {
  const page = pages[pageIndex];
  const icon = getModuleIcon(page.name);
  const totalPages = pages.length;

  const fields = page.commands.map((cmd) => ({
    name: `/${cmd.name}`,
    value: cmd.description,
  }));

  return buildV2Layout({
    title: `${icon} ${page.name.charAt(0).toUpperCase() + page.name.slice(1)} Module`,
    description: `*${page.description}*\n\nPage ${pageIndex + 1} of ${totalPages}`,
    fields,
    footer: `Use the navigation buttons or dropdown below • ${totalPages} modules loaded`,
    useContainer: true,
  });
}

export function buildInteractiveRows(
  pages: DocsModule[],
  pageIndex: number,
  disabled = false,
  guildId?: string | null,
): ActionRowBuilder<any>[] {
  const totalPages = pages.length;

  // Category select dropdown
  const selectOptions = pages.slice(0, 25).map((p, idx) => ({
    label: `${getModuleIcon(p.name)} ${p.name.charAt(0).toUpperCase() + p.name.slice(1)}`,
    value: idx.toString(),
    description: p.description.slice(0, 50),
    default: idx === pageIndex,
  }));

  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder("Jump to a module...")
    .addOptions(selectOptions)
    .setDisabled(disabled);

  const prevButton = new ButtonBuilder()
    .setCustomId("help_prev")
    .setLabel("◀ Previous")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || pageIndex === 0);

  const pageIndicator = new ButtonBuilder()
    .setCustomId("help_page_indicator")
    .setLabel(`${pageIndex + 1} / ${totalPages}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  const nextButton = new ButtonBuilder()
    .setCustomId("help_next")
    .setLabel("Next ▶")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || pageIndex === totalPages - 1);

  const dashboardButton = new ButtonBuilder()
    .setLabel("Web Dashboard")
    .setStyle(ButtonStyle.Link)
    .setURL(getDashboardUrl(guildId));

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    prevButton,
    pageIndicator,
    nextButton,
    dashboardButton,
  );

  return [row1, row2];
}

// ─── Module Export ────────────────────────────────────────────────────────

const helpCommand = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Browse all available modules and commands.")
  .toJSON();

const dashboardCommand = new SlashCommandBuilder()
  .setName("dashboard")
  .setDescription("Get a link to the MODUS web dashboard for this server.")
  .toJSON();

const helpModule: BotModule = {
  name: "help",
  description:
    "Browse all available modules and commands, or get a link to the web dashboard.",
  meta: {
    displayName: "Help & Dashboard",
    category: "utility",
    icon: "i-lucide-circle-question-mark",
    color: "gray",
    tags: ["commands", "docs", "help", "list", "dashboard"],
  },
  commands: [helpCommand, dashboardCommand],

  execute: async (
    interaction: ChatInputCommandInteraction,
    moduleManager: ModuleManager,
  ) => {
    if (interaction.commandName === "dashboard") {
      const dashboardUrl = getDashboardUrl(interaction.guildId);
      const v2Layout = buildV2Layout({
        title: "🌐 MODUS Web Dashboard",
        description:
          `Manage server settings, configure modules, and view real-time stats directly from the web dashboard.\n\n🔗 [Open Web Dashboard](${dashboardUrl})`,
        buttons: [
          {
            label: "Open Dashboard",
            url: dashboardUrl,
          },
        ],
        footer: "MODUS • Modular Discord Utility System",
        useContainer: true,
      });

      await interaction.editReply({
        components: v2Layout,
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    const pages = buildModuleCatalog(moduleManager, { includeHidden: true });

    if (pages.length === 0) {
      await interaction.editReply({
        content: "No modules are currently loaded.",
      });
      return;
    }

    let currentPage = 0;

    const v2Layout = buildV2HelpPage(pages, currentPage);
    const interactiveRows = buildInteractiveRows(
      pages,
      currentPage,
      false,
      interaction.guildId,
    );

    const reply = await interaction.editReply({
      components: [...v2Layout, ...interactiveRows],
      flags: MessageFlags.IsComponentsV2,
    });

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 3 * 60 * 1000,
    });

    collector.on("collect", async (componentInteraction) => {
      if (
        componentInteraction.isStringSelectMenu() &&
        componentInteraction.customId === "help_category_select"
      ) {
        currentPage = parseInt(componentInteraction.values[0], 10);
      } else if (componentInteraction.isButton()) {
        if (componentInteraction.customId === "help_prev") {
          currentPage = Math.max(0, currentPage - 1);
        } else if (componentInteraction.customId === "help_next") {
          currentPage = Math.min(pages.length - 1, currentPage + 1);
        }
      }

      const updatedV2Layout = buildV2HelpPage(pages, currentPage);
      const updatedRows = buildInteractiveRows(
        pages,
        currentPage,
        false,
        interaction.guildId,
      );

      await componentInteraction.update({
        components: [...updatedV2Layout, ...updatedRows],
        flags: MessageFlags.IsComponentsV2,
      });
    });

    collector.on("end", async () => {
      try {
        const disabledRows = buildInteractiveRows(
          pages,
          currentPage,
          true,
          interaction.guildId,
        );
        const finalV2Layout = buildV2HelpPage(pages, currentPage);
        await interaction.editReply({
          components: [...finalV2Layout, ...disabledRows],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch {}
    });
  },
};

export default helpModule;


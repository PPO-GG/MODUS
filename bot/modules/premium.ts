import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { BotModule, ModuleManager } from "../ModuleManager";
import { describePremiumStatus, premiumComponents } from "../lib/premiumUpsell";

const premiumModule: BotModule = {
  name: "premium",
  description: "Show this server's Modus Premium status.",
  meta: {
    displayName: "Premium",
    category: "utility",
    icon: "i-lucide-crown",
    color: "orange",
    tags: ["premium", "subscription", "plan"],
  },
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Show this server's Modus Premium status.")
    .toJSON(),

  execute: async (
    interaction: ChatInputCommandInteraction,
    moduleManager: ModuleManager,
  ) => {
    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ This command only works in a server.",
      });
      return;
    }

    const status = await moduleManager.databaseService.getGuildPremiumStatus(
      interaction.guildId,
    );
    const embed = new EmbedBuilder()
      .setColor(status.premium ? 0xfaa61a : 0x5865f2)
      .setTitle("⭐ Modus Premium")
      .setDescription(describePremiumStatus(status));

    await interaction.editReply({
      embeds: [embed],
      // The purchase button appears only for Free servers.
      components: status.premium ? [] : premiumComponents(),
    });
  },
};

export default premiumModule;

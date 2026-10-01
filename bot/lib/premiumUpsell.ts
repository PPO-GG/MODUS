/**
 * Upgrade prompts for Modus Premium. Deliberately minimal: callers attach
 * these only where a user has hit a limit or asked (see /premium).
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { PremiumStatus } from "@modus/db";

export function getPremiumSkuId(): string | undefined {
  const id = process.env.MODUS_PREMIUM_SKU_ID?.trim();
  return id || undefined;
}

/** A row holding Discord's native Premium purchase button; empty if no SKU is configured. */
export function premiumComponents(
  skuId: string | undefined = getPremiumSkuId(),
): ActionRowBuilder<ButtonBuilder>[] {
  if (!skuId) return [];
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Premium).setSKUId(skuId),
    ),
  ];
}

export function describePremiumStatus(status: PremiumStatus): string {
  if (!status.premium) {
    return "This server is on the **Free** plan.";
  }
  if (status.source === "manual") {
    return "This server has **Premium**.";
  }
  const base = "This server has **Premium** through a Modus Premium subscription.";
  if (status.subscriptionEndsAt) {
    const unix = Math.floor(status.subscriptionEndsAt.getTime() / 1000);
    return `${base}\nIt ends on <t:${unix}:D>.`;
  }
  return base;
}

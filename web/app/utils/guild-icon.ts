/** Discord CDN URL for a guild icon, or null when the guild has none. */
export function guildIconUrl(
  guildId: string,
  iconHash: string | null | undefined,
  size = 64,
): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=${size}`;
}

/** Up to two uppercase initials for an icon-less guild, "?" if unnamed. */
export function guildInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0]!.toUpperCase())
    .join("");
}

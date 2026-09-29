export type OverviewSection = "attention" | "tickets" | "moderation" | "community" | "botFlags";

/**
 * Which Overview sections a viewer sees. `accessibleModules === null` means a
 * full manager. Module-scoped users get the sections for their modules plus
 * the community snapshot — never setup gaps or bot flags. An empty result
 * means the page has nothing for them.
 */
export function overviewSections(input: {
  accessibleModules: string[] | null;
  isEnabled: (name: string) => boolean;
}): OverviewSection[] {
  const isManager = input.accessibleModules === null;
  const can = (module: string) =>
    input.isEnabled(module) && (isManager || input.accessibleModules!.includes(module));

  const out: OverviewSection[] = [];
  if (isManager) out.push("attention");
  if (can("tickets")) out.push("tickets");
  if (can("moderation")) out.push("moderation");
  if (isManager || out.length > 0) out.push("community");
  if (isManager) out.push("botFlags");
  return out;
}

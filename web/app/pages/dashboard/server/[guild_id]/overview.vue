<template>
  <div class="max-w-7xl mx-auto space-y-6">
    <OverviewNeedsAttention v-if="show('attention')" :issues="issues" />
    <div class="grid gap-6 lg:grid-cols-[1.7fr_1fr] items-start">
      <div class="space-y-6 min-w-0">
        <OverviewOpenTickets v-if="show('tickets')" :guild-id="guildId" />
        <OverviewRecentCases v-if="show('moderation')" :guild-id="guildId" />
      </div>
      <div class="space-y-6 min-w-0">
        <OverviewCommunity v-if="show('community')" :guild-id="guildId" />
        <OverviewBotFlags v-if="show('botFlags')" :guild-id="guildId" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { overviewSections, type OverviewSection } from "~/utils/overview-sections";
import { setupIssues } from "~/utils/module-setup-checks";

const route = useRoute();
const guildId = route.params.guild_id as string;
const { state, isModuleEnabled, getModuleConfig, hasModuleSettings } = useServerSettings(guildId);

const sections = computed(() =>
  overviewSections({ accessibleModules: state.value.accessibleModules, isEnabled: isModuleEnabled }),
);
const show = (s: OverviewSection) => sections.value.includes(s);

const issues = computed(() =>
  setupIssues({
    guildId,
    moduleNames: state.value.modules.map((m) => m.name.toLowerCase()),
    isEnabled: isModuleEnabled,
    getConfig: getModuleConfig,
  }),
);

// Module-scoped users whose modules have no Overview section go to their first module.
watch(
  () => [state.value.loading, sections.value.length] as const,
  ([loading, count]) => {
    if (loading || count > 0) return;
    const mods = state.value.accessibleModules ?? [];
    const target = mods.find((m) => hasModuleSettings(m)) ?? mods[0];
    if (target) navigateTo(`/dashboard/server/${guildId}/modules/${target}`, { replace: true });
  },
  { immediate: true },
);
</script>

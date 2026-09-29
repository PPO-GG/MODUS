<template>
  <div class="mx-auto max-w-7xl space-y-8">
    <!-- Top Header & Primary Tabs -->
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-lg font-semibold leading-tight text-white">Server Configuration</h1>
          <span
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-gray-300"
          >
            {{ activeModuleCount }} / {{ totalModuleCount }} ACTIVE
          </span>
        </div>
        <p class="mt-0.5 text-sm text-gray-400">
          Manage and configure bot features, permissions, and settings for this server.
        </p>
      </div>

      <!-- Main Navigation Switcher (Modules vs Server Management) -->
      <div
        v-if="state.isServerOwnerOrAdmin"
        class="inline-flex max-w-full shrink-0 self-start overflow-x-auto rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10 sm:self-auto"
        role="tablist"
        aria-label="Server configuration sections"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="activeMainTab === 'modules'"
          class="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
          :class="
            activeMainTab === 'modules'
              ? 'bg-sky-200/15 text-white ring-1 ring-inset ring-sky-100/25'
              : 'text-gray-400 hover:text-white'
          "
          @click="activeMainTab = 'modules'"
        >
          <UIcon name="i-lucide-layout-grid" class="h-4 w-4" />
          Modules
          <span class="rounded-full bg-white/[0.08] px-1.5 text-[11px] text-gray-300">
            {{ totalModuleCount }}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeMainTab === 'settings'"
          class="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
          :class="
            activeMainTab === 'settings'
              ? 'bg-sky-200/15 text-white ring-1 ring-inset ring-sky-100/25'
              : 'text-gray-400 hover:text-white'
          "
          @click="activeMainTab = 'settings'"
        >
          <UIcon name="i-lucide-shield-check" class="h-4 w-4" />
          Server Access &amp; Danger Zone
        </button>
      </div>
    </header>

    <!-- ======================================================== -->
    <!-- TAB 1: MODULES & FEATURES                                -->
    <!-- ======================================================== -->
    <div v-if="activeMainTab === 'modules'" class="space-y-8">
      <!-- Search & Category Filters Toolbar -->
      <section class="space-y-4">
        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <!-- Search Input -->
          <div class="relative max-w-md flex-1">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search modules by name, keyword, or tag (e.g. spotify, spam, xp)..."
              class="w-full"
              aria-label="Search modules"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-white focus-visible:outline-2 focus-visible:outline-teal-300"
              aria-label="Clear search"
              @click="searchQuery = ''"
            >
              <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
            </button>
          </div>

          <!-- Status Filter -->
          <div class="flex items-center gap-2">
            <span class="hidden font-mono text-[11px] uppercase tracking-wider text-gray-500 sm:inline">
              Status
            </span>
            <div
              class="inline-flex rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10"
              role="group"
              aria-label="Filter by status"
            >
              <button
                v-for="opt in statusOptions"
                :key="opt.value"
                type="button"
                :aria-pressed="statusFilter === opt.value"
                class="rounded-full px-3.5 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
                :class="
                  statusFilter === opt.value
                    ? 'bg-sky-200/15 text-white ring-1 ring-inset ring-sky-100/25'
                    : 'text-gray-400 hover:text-white'
                "
                @click="statusFilter = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Category Filter Pills -->
        <div class="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
          <button
            type="button"
            :aria-pressed="selectedCategory === 'all'"
            class="flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
            :class="
              selectedCategory === 'all'
                ? 'bg-sky-200/15 text-white ring-sky-100/25'
                : 'bg-white/[0.03] text-gray-300 ring-white/10 hover:bg-white/[0.06] hover:text-white'
            "
            @click="selectedCategory = 'all'"
          >
            <UIcon name="i-lucide-layout-grid" class="h-4 w-4" />
            All Categories
            <span class="rounded-full bg-white/[0.08] px-1.5 text-[11px] text-gray-300">{{ totalModuleCount }}</span>
          </button>

          <button
            v-for="cat in MODULE_CATEGORIES"
            :key="cat.key"
            type="button"
            :aria-pressed="selectedCategory === cat.key"
            class="flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
            :class="
              selectedCategory === cat.key
                ? 'bg-sky-200/15 text-white ring-sky-100/25'
                : 'bg-white/[0.03] text-gray-300 ring-white/10 hover:bg-white/[0.06] hover:text-white'
            "
            @click="selectedCategory = cat.key"
          >
            <UIcon :name="cat.icon" class="h-4 w-4" />
            {{ cat.label }}
            <span class="rounded-full bg-white/[0.08] px-1.5 text-[11px] text-gray-300">
              {{ categoryCounts[cat.key]?.total || 0 }}
            </span>
          </button>
        </div>
      </section>

      <!-- Categorized Module Groups -->
      <div v-if="groupedModules.length > 0" class="space-y-10">
        <section
          v-for="group in groupedModules"
          :key="group.category.key"
          class="space-y-4"
        >
          <!-- Category Section Header -->
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/[0.06] pb-3">
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
              >
                <UIcon :name="group.category.icon" class="h-4 w-4 text-sky-200" />
              </div>
              <div class="min-w-0">
                <h2 class="text-base font-semibold text-white">
                  {{ group.category.label }}
                </h2>
                <p class="text-[13px] text-gray-400">
                  {{ group.category.description }}
                </p>
              </div>
            </div>
            <span
              class="shrink-0 whitespace-nowrap rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[11px] text-gray-300"
            >
              {{ group.enabledCount }} / {{ group.modules.length }} enabled
            </span>
          </div>

          <!-- Cards Grid (gap leaves room for each card's offset glass ring) -->
          <div class="grid grid-cols-1 gap-8 px-2 pt-2 sm:grid-cols-2 lg:grid-cols-3">
            <DashboardModuleCard
              v-for="module in group.modules"
              :key="module.$id"
              :display="getModuleDisplay(module)"
              :description="module.description"
              :enabled="isModuleEnabled(module.name)"
              :updating="updating === module.name"
              :configure-to="
                hasModuleSettings(module.name)
                  ? `/dashboard/server/${guildId}/modules/${module.name.toLowerCase()}`
                  : null
              "
              @toggle="(val: boolean) => handleToggle(module.name, val)"
              @tag="setTagSearch"
            />
          </div>
        </section>
      </div>

      <!-- Zero Results State -->
      <div
        v-else
        class="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-16 text-center"
      >
        <template v-if="hasUnmetadataedModules">
          <UIcon name="i-lucide-refresh-cw" class="mx-auto mb-3 h-10 w-10 text-gray-500" />
          <h3 class="text-base font-semibold text-white">Module metadata isn't available yet</h3>
          <p class="mx-auto mt-1 max-w-sm text-[13px] text-gray-400">
            This usually means the bot needs to restart after a recent update. Try refreshing in
            a moment.
          </p>
        </template>
        <template v-else>
          <UIcon name="i-lucide-search-x" class="mx-auto mb-3 h-10 w-10 text-gray-500" />
          <h3 class="text-base font-semibold text-white">No modules found</h3>
          <p class="mx-auto mt-1 max-w-sm text-[13px] text-gray-400">
            No bot modules matched your query
            <span v-if="searchQuery" class="font-semibold text-white">"{{ searchQuery }}"</span>.
          </p>
          <UButton color="neutral" variant="soft" size="sm" class="mt-4" @click="resetFilters">
            Reset filters
          </UButton>
        </template>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 2: SERVER SETTINGS & ACCESS                           -->
    <!-- ======================================================== -->
    <div
      v-else-if="activeMainTab === 'settings' && state.isServerOwnerOrAdmin"
      class="max-w-3xl space-y-6"
    >
      <!-- Dashboard Access Roles -->
      <DashboardModuleSection
        title="Dashboard access roles"
        description="Let specific Discord roles open this server's dashboard settings without needing the Administrator permission. Members with any of these roles can view and adjust module settings."
      >
        <div class="space-y-4">
          <div v-if="state.rolesLoading" class="flex items-center gap-2 py-3 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
            <span class="text-sm">Loading server roles from Discord…</span>
          </div>

          <USelectMenu
            v-else-if="dashboardRoleOptions.length > 0"
            v-model="selectedDashboardRoles"
            :items="dashboardRoleOptions"
            value-key="value"
            multiple
            placeholder="Select roles…"
            icon="i-lucide-users"
            class="w-full"
            @update:model-value="dashboardRolesDirty = true"
          />
          <p v-else class="py-2 text-sm text-gray-400">
            No roles available. Make sure the bot is in this server.
          </p>

          <div class="flex items-center justify-between border-t border-white/[0.06] pt-4">
            <p class="text-[13px] text-gray-400">
              {{ selectedDashboardRoles.length }} role{{
                selectedDashboardRoles.length !== 1 ? "s" : ""
              }} selected
            </p>
            <UButton
              color="primary"
              size="sm"
              icon="i-lucide-check"
              :loading="savingDashboardRoles"
              :disabled="!dashboardRolesDirty"
              @click="handleSaveDashboardRoles"
            >
              Save roles
            </UButton>
          </div>
        </div>
      </DashboardModuleSection>

      <!-- Danger Zone (same surface as the other sections, in a red tint) -->
      <section
        class="min-w-0 rounded-xl bg-red-400/[0.03] p-5 ring-1 ring-inset ring-red-400/25"
        aria-labelledby="danger-zone-title"
      >
        <header class="mb-4">
          <h3 id="danger-zone-title" class="text-sm font-semibold text-red-300">Danger zone</h3>
          <p class="mt-0.5 text-[13px] text-gray-400">
            Irreversible actions for this server's configuration and records.
          </p>
        </header>
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div class="min-w-0">
            <p class="text-sm font-medium text-white">Remove server from dashboard</p>
            <p class="mt-0.5 text-[13px] text-gray-400">
              Removes this server from your dashboard and deletes all module configurations and
              audit records stored for it.
            </p>
          </div>
          <UButton
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            class="shrink-0"
            :loading="removing"
            @click="showRemoveConfirm = true"
          >
            Remove server
          </UButton>
        </div>
      </section>
    </div>

    <!-- Remove Confirmation Modal -->
    <UModal
      v-model:open="showRemoveConfirm"
      title="Remove server"
      description="This action cannot be undone."
    >
      <template #body>
        <p class="text-sm text-gray-300">
          Are you sure you want to remove
          <strong class="text-white">{{ state.guild?.name }}</strong> from your dashboard? All
          module configurations and stored logs for this server will be permanently deleted.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="showRemoveConfirm = false">
            Cancel
          </UButton>
          <UButton color="error" icon="i-lucide-trash-2" :loading="removing" @click="handleRemove">
            Remove server
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  MODULE_CATEGORIES,
  getModuleDisplay,
  type ModuleCategoryKey,
} from "~/utils/module-metadata";

const route = useRoute();
const guildId = route.params.guild_id as string;
const {
  state,
  isModuleEnabled,
  hasModuleSettings,
  toggleModule,
  removeServer,
  loadRoles,
  saveDashboardRoles,
} = useServerSettings(guildId);

const activeMainTab = ref<"modules" | "settings">("modules");
const searchQuery = ref("");
const selectedCategory = ref<"all" | ModuleCategoryKey>("all");
const statusFilter = ref<"all" | "enabled" | "disabled">("all");
const statusOptions = [
  { value: "all", label: "All" },
  { value: "enabled", label: "Active" },
  { value: "disabled", label: "Disabled" },
] as const;

const updating = ref<string | null>(null);
const showRemoveConfirm = ref(false);
const removing = ref(false);

// Dashboard roles state
const selectedDashboardRoles = ref<string[]>([]);
const dashboardRolesDirty = ref(false);
const savingDashboardRoles = ref(false);

// Build role options for the select menu (exclude managed/bot roles)
const dashboardRoleOptions = computed(() =>
  state.value.roles
    .filter((r) => !r.managed)
    .map((r) => ({
      label: `@${r.name}`,
      value: r.id,
    })),
);

// Module counts — only modules that declare dashboard meta (a category),
// matching what the grid renders. Meta-less modules like `reload` would
// otherwise inflate "All Categories".
const listedModules = computed(() =>
  state.value.modules.filter((m) => getModuleDisplay(m).category),
);
const activeModuleCount = computed(() => {
  return listedModules.value.filter((m) => isModuleEnabled(m.name)).length;
});
const totalModuleCount = computed(() => listedModules.value.length);

// Category module counts
const categoryCounts = computed(() => {
  const counts: Record<string, { total: number; enabled: number }> = {};
  for (const cat of MODULE_CATEGORIES) {
    counts[cat.key] = { total: 0, enabled: 0 };
  }
  for (const mod of state.value.modules) {
    const display = getModuleDisplay(mod);
    if (!display.category) continue;
    const catCount = counts[display.category];
    if (catCount) {
      catCount.total += 1;
      if (isModuleEnabled(mod.name)) {
        catCount.enabled += 1;
      }
    }
  }
  return counts;
});

// Grouped & filtered modules
const groupedModules = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  const filtered = state.value.modules.filter((mod) => {
    const display = getModuleDisplay(mod);
    if (!display.category) return false; // no meta declared — not a dashboard feature (e.g. reload)

    const enabled = isModuleEnabled(mod.name);

    if (statusFilter.value === "enabled" && !enabled) return false;
    if (statusFilter.value === "disabled" && enabled) return false;

    if (selectedCategory.value !== "all" && display.category !== selectedCategory.value) {
      return false;
    }

    if (query) {
      const matchName = mod.name.toLowerCase().includes(query);
      const matchDisplayName = display.displayName.toLowerCase().includes(query);
      const matchDesc = (mod.description || "").toLowerCase().includes(query);
      const matchTag = display.tags.some((t) => t.toLowerCase().includes(query));
      return matchName || matchDisplayName || matchDesc || matchTag;
    }

    return true;
  });

  const groups: Array<{
    category: (typeof MODULE_CATEGORIES)[number];
    modules: typeof state.value.modules;
    enabledCount: number;
  }> = [];

  for (const cat of MODULE_CATEGORIES) {
    if (selectedCategory.value !== "all" && selectedCategory.value !== cat.key) {
      continue;
    }
    const catMods = filtered
      .filter((m) => getModuleDisplay(m).category === cat.key)
      .sort((a, b) =>
        getModuleDisplay(a).displayName.localeCompare(getModuleDisplay(b).displayName),
      );
    if (catMods.length > 0) {
      groups.push({
        category: cat,
        modules: catMods,
        enabledCount: catMods.filter((m) => isModuleEnabled(m.name)).length,
      });
    }
  }

  return groups;
});

// Distinguishes "no modules matched your search/filter" from "the bot
// hasn't populated dashboard metadata yet" (every fetched module has
// category: null — e.g. right after this feature's DB migration, before
// the bot has restarted with the code that upserts `meta`). Only applies
// when no search/filter is active, since an active filter finding nothing
// is a normal "no results" case.
const hasUnmetadataedModules = computed(() => {
  const noActiveFilter =
    searchQuery.value.trim() === "" &&
    selectedCategory.value === "all" &&
    statusFilter.value === "all";
  return (
    noActiveFilter &&
    state.value.modules.length > 0 &&
    groupedModules.value.length === 0
  );
});

const setTagSearch = (tag: string) => {
  searchQuery.value = tag;
};

const resetFilters = () => {
  searchQuery.value = "";
  selectedCategory.value = "all";
  statusFilter.value = "all";
};

// Load roles and init selected values when section is visible
onMounted(async () => {
  if (state.value.isServerOwnerOrAdmin) {
    await loadRoles();
    selectedDashboardRoles.value = [...state.value.dashboardRoleIds];
  }
});

const handleSaveDashboardRoles = async () => {
  savingDashboardRoles.value = true;
  const success = await saveDashboardRoles(selectedDashboardRoles.value);
  if (success) {
    dashboardRolesDirty.value = false;
  }
  savingDashboardRoles.value = false;
};

const handleToggle = async (moduleName: string, enabled: boolean) => {
  updating.value = moduleName;
  await toggleModule(moduleName, enabled);
  updating.value = null;
};

const handleRemove = async () => {
  removing.value = true;
  await removeServer();
  removing.value = false;
};
</script>

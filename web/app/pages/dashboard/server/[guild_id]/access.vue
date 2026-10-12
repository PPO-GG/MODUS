<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-door-open"
      title="Channel Access"
      description="See who can see and post in every channel, change it for many channels at once, and review the exact changes before anything is written."
    >
      <template #status>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-refresh-cw"
          :loading="loading"
          aria-label="Reload channels"
          @click="load()"
        />
      </template>
    </DashboardModuleHeader>

    <div v-if="loading && !state" class="space-y-3" aria-busy="true">
      <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
    </div>

    <div
      v-else-if="error && !state"
      class="flex flex-col items-center gap-3 rounded-xl bg-white/[0.03] p-10 text-center ring-1 ring-inset ring-white/10"
      role="alert"
    >
      <UIcon name="i-lucide-triangle-alert" class="h-8 w-8 text-amber-300" />
      <p class="text-sm text-gray-200">{{ error }}</p>
      <UButton color="neutral" variant="soft" size="sm" @click="load()">Try again</UButton>
    </div>

    <template v-else-if="state">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-3">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Search channels or roles…" class="w-full sm:w-72" aria-label="Search" />
        <div class="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          <span class="rounded-full bg-sky-200/10 px-2 py-0.5 text-sky-100">Everyone</span>
          <span class="rounded-full bg-violet-300/15 px-2 py-0.5 text-violet-100">Role</span>
          <span class="rounded-full bg-white/[0.06] px-2 py-0.5 text-gray-200">read-only</span>
          <span class="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-100">posting: roles</span>
          <span class="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200">Custom</span>
        </div>
        <p v-if="error" class="w-full text-xs text-amber-200" role="alert">{{ error }}</p>
      </div>

      <!-- Bulk bar -->
      <div
        v-if="selected.length > 0"
        class="flex flex-wrap items-center gap-2 rounded-xl bg-[rgba(3,7,18,0.55)] p-3 ring-1 ring-inset ring-white/10"
      >
        <span class="text-xs text-gray-300">{{ selected.length }} selected</span>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-lock" @click="bulk('read-only')">Make read-only</UButton>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-eye-off" @click="privateOpen = !privateOpen">Make private to…</UButton>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-eye" @click="bulk('open')">Open to everyone</UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="clearSelection()">Clear selection</UButton>
        <div v-if="privateOpen" class="flex w-full flex-wrap items-center gap-2 pt-2">
          <USelectMenu v-model="privateRoles" :items="roleItems" value-key="value" multiple placeholder="Roles with access…" class="w-full sm:w-80" aria-label="Roles with access" />
          <UButton size="xs" color="primary" :disabled="privateRoles.length === 0" @click="applyPrivate()">Apply to selection</UButton>
        </div>
      </div>

      <!-- Tree -->
      <p v-if="groups.length === 0" class="text-sm text-gray-400">No channels match.</p>
      <div v-else class="space-y-4">
        <section
          v-for="group in groups"
          :key="group.category?.channel.id ?? 'none'"
          class="space-y-1.5 rounded-xl bg-[rgba(3,7,18,0.55)] p-3 ring-1 ring-inset ring-white/10"
        >
          <p v-if="!group.category" class="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">No category</p>
          <DashboardChannelAccessRow
            v-if="group.category"
            :row="group.category"
            :roles="roleById"
            :selected="selected.includes(group.category.channel.id)"
            :expanded="expanded === group.category.channel.id"
            @toggle-select="toggleSelect(group.category.channel.id)"
            @toggle-expand="toggleExpand(group.category.channel.id)"
            @clear-edit="clearEdit(group.category.channel.id)"
          >
            <DashboardChannelAccessRuleEditor
              :model-value="ruleFor(group.category.channel.id)"
              :roles="state.roles"
              :bot-top-position="state.botTopPosition"
              :bot-wont-see="botWontSee(ruleFor(group.category.channel.id))"
              :is-custom="group.category.channel.rule === null"
              @update:model-value="(r) => setRule(group.category!.channel.id, r)"
            />
          </DashboardChannelAccessRow>
          <DashboardChannelAccessRow
            v-for="row in group.channels"
            :key="row.channel.id"
            :row="row"
            :roles="roleById"
            :selected="selected.includes(row.channel.id)"
            :expanded="expanded === row.channel.id"
            :depth="group.category ? 1 : 0"
            @toggle-select="toggleSelect(row.channel.id)"
            @toggle-expand="toggleExpand(row.channel.id)"
            @clear-edit="clearEdit(row.channel.id)"
          >
            <DashboardChannelAccessRuleEditor
              :model-value="ruleFor(row.channel.id)"
              :roles="state.roles"
              :bot-top-position="state.botTopPosition"
              :bot-wont-see="botWontSee(ruleFor(row.channel.id))"
              :is-custom="row.channel.rule === null"
              @update:model-value="(r) => setRule(row.channel.id, r)"
            />
          </DashboardChannelAccessRow>
        </section>
      </div>
    </template>

    <!--
      Pending-changes bar. Same zero-cost sticky anchor as DashboardModuleSaveBar:
      always in the flow inside the content column, so it never spans the sidebar
      and appearing/disappearing never changes the page height.
    -->
    <div v-if="state" class="pointer-events-none sticky bottom-6 z-20 h-14">
      <Transition name="save-bar">
        <div
          v-if="editCount > 0"
          class="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-full border border-amber-400/40 bg-[rgba(3,7,18,0.88)] py-2 pl-5 pr-2 shadow-[0_0_20px_rgba(251,191,36,0.25)] backdrop-blur-xl"
          role="status"
        >
          <p class="flex items-center gap-2 text-sm text-amber-200">
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
            <span>
              {{ editCount }} channel{{ editCount === 1 ? "" : "s" }} edited<span v-if="cascadeCount">, plus {{ cascadeCount }} via categor{{ cascadeCount === 1 ? "y" : "ies" }}</span>
            </span>
            <span v-if="incompleteEdits" class="hidden text-xs sm:inline">— choose roles for every edited channel</span>
          </p>
          <div class="flex items-center gap-2 whitespace-nowrap">
            <UButton color="neutral" variant="ghost" size="sm" @click="clearEdits()">Discard</UButton>
            <UButton color="primary" size="sm" icon="i-lucide-eye" :disabled="!canReview || incompleteEdits" @click="openPreview()">
              <span>Review<span class="hidden sm:inline"> changes</span></span>
            </UButton>
          </div>
        </div>
      </Transition>
    </div>

    <DashboardPermissionPlanModal
      :state="modal"
      title="Apply channel access changes"
      :cascaded="cascadeCount"
      @confirm="onConfirm"
      @close="closePreview"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import type { AccessRule } from "#shared/channel-access";

const route = useRoute();
const toast = useToast();
const guildId = route.params.guild_id as string;

const {
  state, loading, error, search, expanded, edits, selected,
  roleById, groups, editCount, cascadeCount, canReview,
  load, ruleFor, setRule, clearEdit, clearEdits,
  toggleSelect, clearSelection, bulk, botWontSee,
  modal, lastApply, openPreview, confirmApply, closePreview,
} = useChannelAccess(guildId);

const toggleExpand = (id: string) => {
  expanded.value = expanded.value === id ? null : id;
};

const roleItems = computed(() =>
  (state.value?.roles ?? []).map((r) => ({ label: r.name + (r.managed ? " (integration)" : ""), value: r.id })),
);
const privateOpen = ref(false);
const privateRoles = ref<string[]>([]);
const applyPrivate = () => {
  bulk("private", privateRoles.value);
  privateOpen.value = false;
  privateRoles.value = [];
};

// A see-roles or post-roles field left empty is a half-finished edit; the server would 400 it.
const incomplete = (r: AccessRule) =>
  (r.see.kind === "roles" && r.see.roleIds.length === 0) || (r.post.kind === "roles" && r.post.roleIds.length === 0);
const incompleteEdits = computed(() => Object.values(edits.value).some(incomplete));

const onConfirm = async () => {
  if (await confirmApply()) {
    toast.add(
      lastApply.value?.logged === false
        ? { title: "Changes applied, but not logged", description: "The previous values could not be saved to the Server Logs.", color: "warning" }
        : { title: "Changes applied", description: "The previous values were saved to the Server Logs.", color: "success" },
    );
  }
};

// Leaving with pending edits asks first.
onBeforeRouteLeave(() => {
  if (editCount.value === 0) return true;
  return window.confirm("You have unreviewed channel access edits. Leave and discard them?");
});
const beforeUnload = (e: BeforeUnloadEvent) => {
  if (editCount.value > 0) e.preventDefault();
};
onMounted(() => {
  window.addEventListener("beforeunload", beforeUnload);
  load();
});
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
</script>

<style scoped>
.save-bar-enter-active,
.save-bar-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.save-bar-enter-from,
.save-bar-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
@media (prefers-reduced-motion: reduce) {
  .save-bar-enter-active,
  .save-bar-leave-active {
    transition: none;
  }
}
</style>

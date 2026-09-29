<template>
  <DashboardModuleSection
    v-if="state.isServerOwnerOrAdmin"
    title="Module access"
    description="Let specific Discord roles open just this module's settings, without making them full dashboard admins."
  >
    <div v-if="state.rolesLoading || loadingGrant" class="flex items-center gap-2 py-2 text-gray-400">
      <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
      <span class="text-sm">Loading server roles from Discord…</span>
    </div>

    <USelectMenu
      v-else-if="roleOptions.length > 0"
      v-model="selectedRoles"
      :items="roleOptions"
      value-key="value"
      multiple
      placeholder="Select roles…"
      icon="i-lucide-users"
      class="w-full"
      @update:model-value="dirty = true"
    />
    <p v-else class="py-2 text-sm text-gray-500">
      No roles available. Make sure the bot is in this server.
    </p>

    <div class="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
      <p class="text-[13px] text-gray-400">
        {{ selectedRoles.length }} role{{ selectedRoles.length !== 1 ? "s" : "" }} selected
      </p>
      <UButton
        color="primary"
        size="sm"
        :loading="saving"
        :disabled="!dirty || loadingGrant"
        @click="handleSave"
      >
        Save access
      </UButton>
    </div>
  </DashboardModuleSection>
</template>

<script setup lang="ts">
const props = defineProps<{
  guildId: string;
  moduleName: string;
}>();

const { state, loadRoles, roleOptions } = useServerSettings(props.guildId);
const toast = useToast();

const selectedRoles = ref<string[]>([]);
const dirty = ref(false);
const saving = ref(false);
const loadingGrant = ref(true);

onMounted(async () => {
  if (!state.value.isServerOwnerOrAdmin) return;
  await loadRoles();
  try {
    const current = await $fetch<{ roleIds: string[] }>(
      `/api/module-access/${encodeURIComponent(props.guildId)}/${encodeURIComponent(props.moduleName)}`,
    );
    selectedRoles.value = current.roleIds;
  } catch (error) {
    console.error("Error loading module access:", error);
  } finally {
    loadingGrant.value = false;
  }
});

const handleSave = async () => {
  saving.value = true;
  try {
    await $fetch(
      `/api/module-access/${encodeURIComponent(props.guildId)}/${encodeURIComponent(props.moduleName)}`,
      { method: "PUT", body: { roleIds: selectedRoles.value } },
    );
    dirty.value = false;
    toast.add({
      title: "Module Access Updated",
      description: `Roles with access to the ${props.moduleName} settings page have been updated.`,
      color: "success",
    });
  } catch (error) {
    console.error("Error saving module access:", error);
    toast.add({
      title: "Error",
      description: "Failed to update module access.",
      color: "error",
    });
  } finally {
    saving.value = false;
  }
};
</script>

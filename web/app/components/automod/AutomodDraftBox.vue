<template>
  <div class="space-y-3">
    <UAlert
      v-if="status && !status.available"
      color="neutral"
      variant="subtle"
      icon="i-lucide-sparkles"
      title="AI drafts are unavailable"
      :description="draftUnavailableMessage(status.reason)"
    />

    <UFormField label="Describe the rule" :help="`${prompt.length}/${MAX_PROMPT}`" class="w-full">
      <UTextarea
        v-model="prompt"
        :maxlength="MAX_PROMPT"
        :rows="3"
        :disabled="!canGenerate || generating"
        placeholder="e.g. Delete messages with more than 3 links from anyone who joined less than a day ago, then DM them a warning."
        class="w-full"
      />
    </UFormField>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="errorMessage"
    >
      <template v-if="errorDetails.length" #description>
        <ul class="mt-1 list-disc space-y-0.5 pl-4 text-[13px]">
          <li v-for="detail in errorDetails" :key="detail">{{ detail }}</li>
        </ul>
      </template>
    </UAlert>

    <div class="flex justify-end">
      <UButton
        icon="i-lucide-sparkles"
        :loading="generating"
        :disabled="!canGenerate || !prompt.trim()"
        @click="generate"
      >
        Generate draft
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { draftUnavailableMessage, type DraftResult } from "~/utils/automod-draft";

const MAX_PROMPT = 500;

const props = defineProps<{ guildId: string }>();
const emit = defineEmits<{ draft: [result: DraftResult] }>();

interface DraftStatus {
  available: boolean;
  source: "guild" | "shared" | null;
  reason?: "not_premium" | "no_shared_key";
}

const status = ref<DraftStatus | null>(null);
const prompt = ref("");
const generating = ref(false);
const errorMessage = ref("");
const errorDetails = ref<string[]>([]);

const canGenerate = computed(() => status.value?.available === true);

const loadStatus = async () => {
  try {
    status.value = await $fetch<DraftStatus>("/api/automod/draft-status", {
      query: { guild_id: props.guildId },
    });
  } catch (error) {
    console.error("Error loading AI draft status:", error);
    status.value = { available: false, source: null };
  }
};

const generate = async () => {
  if (!canGenerate.value || generating.value || !prompt.value.trim()) return;
  generating.value = true;
  errorMessage.value = "";
  errorDetails.value = [];
  try {
    const result = await $fetch<DraftResult>("/api/automod/draft", {
      method: "POST",
      body: { guild_id: props.guildId, prompt: prompt.value.trim() },
    });
    emit("draft", result);
  } catch (error: any) {
    errorMessage.value =
      error?.data?.statusMessage || "Could not generate a draft. Please try again.";
    errorDetails.value = error?.data?.data?.errors ?? [];
    if (error?.statusCode === 403 && error?.data?.data?.reason) {
      await loadStatus();
    }
  } finally {
    generating.value = false;
  }
};

onMounted(loadStatus);
</script>

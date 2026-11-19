<template>
  <div class="p-8 space-y-6">
    <AdminPageHeader
      icon="i-heroicons-chat-bubble-left-right"
      title="Feedback"
      description="Messages that server admins sent with /feedback. Newest first."
    />

    <!-- Filter -->
    <div class="glide-tile rounded-2xl p-4 flex flex-wrap items-center gap-2">
      <UButton
        v-for="option in statusOptions"
        :key="option.value"
        :variant="status === option.value ? 'solid' : 'ghost'"
        :color="status === option.value ? 'primary' : 'neutral'"
        size="sm"
        @click="setFilter(option.value)"
      >
        {{ option.label }}
      </UButton>
    </div>

    <p v-if="errorMessage" class="text-sm text-red-400">{{ errorMessage }}</p>

    <!-- Loading -->
    <div v-if="loading && items.length === 0" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="w-8 h-8 animate-spin text-primary-400" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="items.length === 0"
      class="text-center py-16 rounded-3xl border-2 border-dashed border-white/8"
    >
      <UIcon name="i-heroicons-chat-bubble-left-right" class="w-12 h-12 text-gray-600 mx-auto mb-3" />
      <p class="text-gray-500">No feedback found.</p>
    </div>

    <!-- List -->
    <div v-else class="space-y-3">
      <div v-for="item in items" :key="item.id" class="glide-tile rounded-2xl p-4 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="categoryColor(item.category)" variant="soft" size="sm">
            {{ item.category }}
          </UBadge>
          <UBadge v-if="item.status === 'resolved'" color="success" variant="soft" size="sm">
            Resolved
          </UBadge>
          <UBadge v-if="item.contactOk" color="info" variant="soft" size="sm">
            OK to contact
          </UBadge>
          <span class="text-xs text-gray-500 ml-auto whitespace-nowrap">
            {{ formatTime(item.createdAt) }}
          </span>
          <UButton
            size="xs"
            :variant="item.status === 'open' ? 'soft' : 'ghost'"
            :color="item.status === 'open' ? 'success' : 'neutral'"
            :icon="item.status === 'open' ? 'i-heroicons-check' : 'i-heroicons-arrow-uturn-left'"
            :loading="busyId === item.id"
            @click="toggleStatus(item)"
          >
            {{ item.status === "open" ? "Resolve" : "Reopen" }}
          </UButton>
        </div>

        <p class="text-sm text-gray-200 whitespace-pre-wrap break-words">{{ item.message }}</p>

        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
          <template v-if="contextV1(item.context)">
            <span>Server: {{ contextV1(item.context)!.guildName }}</span>
            <span>Bot version: {{ contextV1(item.context)!.botVersion }}</span>
          </template>
          <span class="font-mono">Server ID: {{ item.guildId }}</span>
          <span class="font-mono">User ID: {{ item.userId }}</span>
        </div>

        <!-- Unknown context version: show it raw -->
        <pre
          v-if="!contextV1(item.context)"
          class="text-xs text-gray-300 bg-black/30 rounded-lg p-3 overflow-x-auto"
        >{{ formatJson(item.context) }}</pre>
      </div>
    </div>

    <!-- Load more -->
    <div v-if="hasMore" class="flex justify-center">
      <UButton
        variant="soft"
        color="neutral"
        icon="i-lucide-history"
        :loading="loadingMore"
        @click="loadMore"
      >
        Load more
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

type StatusFilter = "open" | "resolved" | "all";

interface FeedbackContextV1 {
  v: 1;
  guildName: string;
  botVersion: string;
}

interface FeedbackItem {
  id: string;
  guildId: string;
  userId: string;
  category: string;
  message: string;
  contactOk: boolean;
  context: unknown;
  status: "open" | "resolved";
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

const PAGE_SIZE = 50;

const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
  { label: "All", value: "all" },
];

const status = ref<StatusFilter>("open");
const items = ref<FeedbackItem[]>([]);
const hasMore = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const busyId = ref<string | null>(null);
const errorMessage = ref("");

const categoryColor = (category: string) =>
  category === "bug" ? "error" : category === "idea" ? "primary" : "neutral";

// Only version 1 is known. Anything else is shown as raw JSON.
const contextV1 = (context: unknown): FeedbackContextV1 | null => {
  const c = context as Partial<FeedbackContextV1> | null;
  return c && c.v === 1 && typeof c.guildName === "string" && typeof c.botVersion === "string"
    ? (c as FeedbackContextV1)
    : null;
};

const formatJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "—";
  }
};

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const fetchItems = async (append: boolean) => {
  const query: Record<string, string> = { limit: String(PAGE_SIZE) };
  if (status.value !== "all") query.status = status.value;
  const last = items.value[items.value.length - 1];
  if (append && last) query.before = last.createdAt;

  if (append) loadingMore.value = true;
  else loading.value = true;
  errorMessage.value = "";

  try {
    const page = await $fetch<{ items: FeedbackItem[] }>("/api/admin/feedback", { query });
    items.value = append ? [...items.value, ...page.items] : page.items;
    hasMore.value = page.items.length === PAGE_SIZE;
  } catch (error) {
    console.error("Error fetching feedback:", error);
    errorMessage.value = "Could not load feedback. Try again.";
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const setFilter = (value: StatusFilter) => {
  status.value = value;
  fetchItems(false);
};

const loadMore = () => fetchItems(true);

const toggleStatus = async (item: FeedbackItem) => {
  busyId.value = item.id;
  errorMessage.value = "";
  try {
    const updated = await $fetch<FeedbackItem>(`/api/admin/feedback/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: { status: item.status === "open" ? "resolved" : "open" },
    });
    // Drop the row when it no longer matches the filter; otherwise update it.
    items.value =
      status.value === "all"
        ? items.value.map((i) => (i.id === updated.id ? updated : i))
        : items.value.filter((i) => i.id !== updated.id);
  } catch (error) {
    console.error("Error updating feedback:", error);
    errorMessage.value = "Could not update this feedback. Try again.";
  } finally {
    busyId.value = null;
  }
};

onMounted(() => fetchItems(false));
</script>

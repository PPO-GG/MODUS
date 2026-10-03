/**
 * useSuggestions — the dashboard review queue. Module settings (channel,
 * staff roles, toggles) go through useServerSettings's generic
 * saveModuleSettings/getModuleConfig, same as every other module.
 */
import type { StaffStatus, SuggestionStatus } from "~/utils/suggestions";
import { createRequestGate } from "~/utils/suggestions";

export interface SuggestionItem {
  id: string;
  number: number;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  status: SuggestionStatus;
  statusReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  channelId: string | null;
  messageId: string | null;
  threadId: string | null;
  createdAt: string;
  up: number;
  down: number;
}

export interface SuggestionVoter {
  userId: string;
  displayName: string;
  direction: "up" | "down";
}

interface ListResponse {
  suggestions: SuggestionItem[];
  nextBefore: string | null;
  voters: SuggestionVoter[] | null;
  votersTotal: number;
}

const PAGE_SIZE = 25;

const messageOf = (err: any, fallback: string): string =>
  err?.data?.statusMessage || err?.message || fallback;

export function useSuggestions(guildId: string) {
  const items = ref<SuggestionItem[]>([]);
  const status = ref<SuggestionStatus>("pending");
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const nextBefore = ref<string | null>(null);
  const voters = ref<SuggestionVoter[]>([]);
  const votersTotal = ref(0);
  const votersLoading = ref(false);
  const votersError = ref<string | null>(null);

  const listGate = createRequestGate();
  const votersGate = createRequestGate();

  const query = (extra: Record<string, string> = {}) => ({
    guild_id: guildId,
    status: status.value,
    limit: String(PAGE_SIZE),
    ...extra,
  });

  const refresh = async () => {
    loading.value = true;
    error.value = null;
    const token = listGate.next();
    try {
      const data = (await $fetch("/api/suggestions/list", { params: query() })) as ListResponse;
      if (listGate.isCurrent(token)) {
        items.value = data.suggestions;
        nextBefore.value = data.nextBefore;
      }
    } catch (err: any) {
      if (listGate.isCurrent(token)) {
        error.value = messageOf(err, "Failed to load suggestions");
        items.value = [];
        nextBefore.value = null;
      }
    } finally {
      if (listGate.isCurrent(token)) {
        loading.value = false;
      }
    }
  };

  const setStatus = async (next: SuggestionStatus) => {
    status.value = next;
    await refresh();
  };

  const loadMore = async () => {
    if (!nextBefore.value || loading.value || loadingMore.value) return;
    loadingMore.value = true;
    error.value = null;
    const token = listGate.next();
    try {
      const data = (await $fetch("/api/suggestions/list", {
        params: query({ before: nextBefore.value }),
      })) as ListResponse;
      if (listGate.isCurrent(token)) {
        items.value = [...items.value, ...data.suggestions];
        nextBefore.value = data.nextBefore;
      }
    } catch (err: any) {
      if (listGate.isCurrent(token)) {
        error.value = messageOf(err, "Failed to load more suggestions");
      }
    } finally {
      loadingMore.value = false;
    }
  };

  const loadVoters = async (id: string) => {
    votersLoading.value = true;
    votersError.value = null;
    voters.value = [];
    votersTotal.value = 0;
    const token = votersGate.next();
    try {
      const data = (await $fetch("/api/suggestions/list", {
        params: { guild_id: guildId, voters_for: id },
      })) as ListResponse;
      if (votersGate.isCurrent(token)) {
        voters.value = data.voters ?? [];
        votersTotal.value = data.votersTotal ?? 0;
      }
    } catch (err: any) {
      if (votersGate.isCurrent(token)) {
        votersError.value = messageOf(err, "Failed to load voters");
      }
    } finally {
      if (votersGate.isCurrent(token)) {
        votersLoading.value = false;
      }
    }
  };

  const review = async (id: string, next: StaffStatus, reason: string) => {
    try {
      const result = (await $fetch("/api/suggestions/review", {
        method: "POST",
        body: { guild_id: guildId, id, status: next, reason },
      })) as { embedUpdated: boolean; withdrawn: boolean };
      await refresh();
      return { embedUpdated: result.embedUpdated, withdrawn: result.withdrawn };
    } catch (err: any) {
      throw new Error(messageOf(err, "Failed to save the review"));
    }
  };

  onMounted(refresh);

  return {
    items: readonly(items),
    loading: readonly(loading),
    loadingMore: readonly(loadingMore),
    error: readonly(error),
    hasMore: computed(() => nextBefore.value !== null),
    status: readonly(status),
    voters: readonly(voters),
    votersTotal: readonly(votersTotal),
    votersError: readonly(votersError),
    votersLoading: readonly(votersLoading),
    setStatus,
    loadMore,
    refresh,
    loadVoters,
    review,
  };
}

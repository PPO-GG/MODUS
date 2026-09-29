<template>
  <div class="relative">
    <div class="absolute bottom-6 left-[15px] top-6 w-px bg-white/10" aria-hidden="true" />

    <div class="space-y-5">
      <!-- When -->
      <div class="relative flex items-start gap-3">
        <span
          class="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-200/10 ring-1 ring-inset ring-sky-100/25"
        >
          <UIcon name="i-lucide-zap" class="h-4 w-4 text-sky-200" />
        </span>
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="flex h-8 items-center gap-1.5 text-sm text-white"
            :aria-expanded="!triggerCollapsed"
            @click="triggerCollapsed = !triggerCollapsed"
          >
            <UIcon
              :name="triggerCollapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
              class="h-3.5 w-3.5 text-gray-500"
            />
            <span class="font-semibold">When</span>
            <span v-if="triggerCollapsed" class="text-gray-400">{{
              triggerLabel(trigger).toLowerCase()
            }}</span>
          </button>
          <TriggerNode
            v-if="!triggerCollapsed"
            :model-value="trigger"
            :groups="triggerGroups"
            class="mt-1"
            @update:model-value="$emit('update:trigger', $event)"
          />
        </div>
      </div>

      <!-- If -->
      <div class="relative flex items-start gap-3">
        <span
          class="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-200/10 ring-1 ring-inset ring-sky-100/25"
        >
          <UIcon name="i-lucide-funnel" class="h-4 w-4 text-sky-200" />
        </span>
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="flex h-8 items-center gap-1.5 text-sm text-white"
            :aria-expanded="!conditionsCollapsed"
            @click="conditionsCollapsed = !conditionsCollapsed"
          >
            <UIcon
              :name="conditionsCollapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
              class="h-3.5 w-3.5 text-gray-500"
            />
            <span class="font-semibold">If</span>
            <span v-if="conditionsCollapsed" class="text-gray-400">
              {{ conditionCount }} condition{{ conditionCount !== 1 ? "s" : "" }}
            </span>
          </button>
          <ConditionGroupEditor
            v-if="!conditionsCollapsed"
            :model-value="conditions"
            :depth="0"
            class="mt-1"
            @update:model-value="$emit('update:conditions', $event)"
          />
        </div>
      </div>

      <!-- Then -->
      <div class="relative flex items-start gap-3">
        <span
          class="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-300/10 ring-1 ring-inset ring-teal-300/30"
        >
          <UIcon name="i-lucide-play" class="h-4 w-4 text-teal-300" />
        </span>
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="flex h-8 items-center gap-1.5 text-sm text-white"
            :aria-expanded="!actionsCollapsed"
            @click="actionsCollapsed = !actionsCollapsed"
          >
            <UIcon
              :name="actionsCollapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
              class="h-3.5 w-3.5 text-gray-500"
            />
            <span class="font-semibold">Then</span>
            <span v-if="actionsCollapsed" class="text-gray-400">
              {{ actions.length }} action{{ actions.length !== 1 ? "s" : "" }}
            </span>
          </button>
          <ActionsNode
            v-if="!actionsCollapsed"
            :model-value="actions"
            :action-options="actionOptions"
            :channel-options="channelOptions"
            :role-options="roleOptions"
            class="mt-1"
            @update:model-value="$emit('update:actions', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TriggerNode from "~/components/automod/TriggerNode.vue";
import ActionsNode from "~/components/automod/ActionsNode.vue";
import ConditionGroupEditor from "~/components/automod/ConditionGroupEditor.vue";

interface Condition {
  type: "condition";
  field: string;
  operator: string;
  value: string | number | boolean | string[];
  flags?: string[];
  negate?: boolean;
}

interface ConditionGroup {
  operator: "AND" | "OR";
  conditions: (Condition | ConditionGroup)[];
  negate?: boolean;
}

interface ActionForm {
  type: string;
  params: Record<string, any>;
  delaySeconds?: number;
}

const props = defineProps<{
  trigger: string;
  triggerGroups: { label: string; items: { label: string; value: string; icon?: string }[] }[];
  conditions: ConditionGroup;
  actions: ActionForm[];
  actionOptions: { label: string; value: string; icon?: string }[];
  channelOptions: { label: string; value: string }[];
  roleOptions: { label: string; value: string }[];
  triggerLabel: (trigger: string) => string;
}>();

defineEmits<{
  (e: "update:trigger", value: string): void;
  (e: "update:conditions", value: ConditionGroup): void;
  (e: "update:actions", value: ActionForm[]): void;
}>();

const triggerCollapsed = ref(false);
const conditionsCollapsed = ref(false);
const actionsCollapsed = ref(false);

const countGroupConditions = (group: ConditionGroup): number =>
  group.conditions.reduce(
    (acc, c) => acc + ("type" in c && c.type === "condition" ? 1 : countGroupConditions(c as ConditionGroup)),
    0,
  );

const conditionCount = computed(() => countGroupConditions(props.conditions));
</script>

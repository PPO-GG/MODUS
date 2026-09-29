<template>
  <USelectMenu
    :model-value="modelValue"
    :items="flatItems"
    value-key="value"
    class="w-full"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
interface TriggerOption {
  label: string;
  value: string;
  icon?: string;
  disabled?: boolean;
}

interface TriggerGroup {
  label: string;
  items: TriggerOption[];
}

const props = defineProps<{
  modelValue: string;
  groups: TriggerGroup[];
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

// Insert a disabled header row before each group so the flat USelectMenu
// list reads as sectioned without depending on multi-array group support.
const flatItems = computed<TriggerOption[]>(() =>
  props.groups.flatMap((group) => [
    {
      label: group.label.toUpperCase(),
      value: `__header_${group.label}`,
      disabled: true,
    },
    ...group.items,
  ]),
);
</script>

<template>
  <div class="space-y-3">
    <p v-if="questions.length === 0" class="text-[13px] text-gray-400">
      {{ emptyText }}
    </p>

    <div
      v-for="(q, i) in questions"
      :key="q.id"
      class="space-y-3 rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-inset ring-white/10"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium text-white">Question {{ i + 1 }}</span>
        <UButton
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          :aria-label="`Remove question ${i + 1}`"
          @click="remove(i)"
        />
      </div>

      <UFormField label="Question" class="w-full">
        <template #hint>
          <span class="text-xs text-gray-400">{{ q.label.length }}/45</span>
        </template>
        <UInput
          v-model="q.label"
          placeholder="e.g. What do you need help with?"
          :maxlength="45"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Placeholder" hint="Optional" class="w-full">
        <UInput
          v-model="q.placeholder"
          placeholder="Hint text shown inside the answer box"
          :maxlength="100"
          class="w-full"
        />
      </UFormField>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div class="flex items-center gap-2" role="radiogroup" aria-label="Answer length">
          <label v-for="s in styles" :key="s.value" class="cursor-pointer">
            <input
              v-model="q.style"
              type="radio"
              :name="`q-style-${q.id}`"
              :value="s.value"
              class="peer sr-only"
            />
            <span
              class="block rounded-full px-3 py-1.5 text-xs text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:text-white peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
            >
              {{ s.label }}
            </span>
          </label>
        </div>

        <label class="flex cursor-pointer items-center gap-2 text-sm text-white">
          <USwitch v-model="q.required" size="sm" aria-label="Required" />
          Required
        </label>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:max-w-xs">
        <UFormField label="Min length" hint="Optional" class="w-full">
          <UInput
            :model-value="q.minLength"
            type="number"
            :min="0"
            :max="4000"
            class="w-full"
            @update:model-value="(v: any) => (q.minLength = toNum(v))"
          />
        </UFormField>
        <UFormField label="Max length" hint="Optional" class="w-full">
          <UInput
            :model-value="q.maxLength"
            type="number"
            :min="1"
            :max="4000"
            class="w-full"
            @update:model-value="(v: any) => (q.maxLength = toNum(v))"
          />
        </UFormField>
      </div>
    </div>

    <UButton
      color="neutral"
      variant="soft"
      size="sm"
      icon="i-lucide-plus"
      :disabled="questions.length >= max"
      @click="add"
    >
      Add question
    </UButton>
    <span class="ml-2 text-xs text-gray-400">{{ questions.length }} of {{ max }}</span>
  </div>
</template>

<script setup lang="ts">
import { nanoid } from "nanoid";

export interface TicketQuestion {
  id: string;
  label: string;
  placeholder?: string;
  required: boolean;
  style: "short" | "paragraph";
  minLength?: number;
  maxLength?: number;
}

const questions = defineModel<TicketQuestion[]>({ required: true });

const props = withDefaults(
  defineProps<{
    /** Discord allows at most 5 inputs in a modal. */
    max?: number;
    emptyText?: string;
  }>(),
  { max: 5, emptyText: "No questions. Tickets open straight away." },
);

const styles = [
  { value: "short", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
] as const;

// A cleared number input yields "" — treat that as unset.
const toNum = (v: unknown): number | undefined =>
  v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v);

function add() {
  if (questions.value.length >= props.max) return;
  questions.value.push({
    id: nanoid(8),
    label: "",
    placeholder: "",
    required: true,
    style: "short",
  });
}

function remove(index: number) {
  questions.value.splice(index, 1);
}
</script>

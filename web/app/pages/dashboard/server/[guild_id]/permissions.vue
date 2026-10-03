<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-shield-check"
      title="Permission Audit"
      description="A read-only check of risky permissions, role hierarchy, channel overwrites and what MODUS needs to run. Only modules you have configured are checked."
    >
      <template #status>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-refresh-cw"
          :loading="refreshing"
          aria-label="Re-run audit"
          @click="run(true)"
        />
      </template>
    </DashboardModuleHeader>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3" aria-busy="true">
      <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex flex-col items-center gap-3 rounded-xl bg-white/[0.03] p-10 text-center ring-1 ring-inset ring-white/10"
      role="alert"
    >
      <UIcon name="i-lucide-triangle-alert" class="h-8 w-8 text-amber-300" />
      <p class="text-sm text-gray-200">{{ error }}</p>
      <UButton color="neutral" variant="soft" size="sm" @click="run(true)">Try again</UButton>
    </div>

    <template v-else-if="report">
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3">
        <div
          class="inline-flex max-w-full overflow-x-auto rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10"
          role="group"
          aria-label="Filter by severity"
        >
          <button
            v-for="s in severities"
            :key="s.value"
            type="button"
            :aria-pressed="severity === s.value"
            class="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
            :class="
              severity === s.value
                ? 'bg-sky-200/15 text-white ring-1 ring-inset ring-sky-100/25'
                : 'text-gray-400 hover:text-white'
            "
            @click="severity = s.value"
          >
            {{ s.label }}
            <span
              v-if="severityCount(s.value) > 0"
              class="rounded-full px-1.5 text-[11px]"
              :class="s.badge"
            >
              {{ severityCount(s.value) }}
            </span>
          </button>
        </div>

        <USelect
          v-model="check"
          :items="checkItems"
          class="w-full sm:w-52"
          aria-label="Filter by check"
        />

        <span class="ml-auto font-mono text-xs text-gray-400" aria-live="polite">
          {{ filtered.length }} / {{ report.findings.length }} findings
        </span>
      </div>

      <!-- All clear -->
      <div
        v-if="report.findings.length === 0"
        class="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] p-12 text-center ring-1 ring-inset ring-white/10"
      >
        <UIcon name="i-lucide-shield-check" class="h-10 w-10 text-emerald-300" />
        <p class="text-sm text-gray-200">No permission issues found</p>
        <p class="text-[13px] text-gray-400">
          Nothing risky or missing was detected in the checks this audit runs.
        </p>
      </div>

      <!-- No filter match -->
      <div
        v-else-if="filtered.length === 0"
        class="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] p-12 text-center ring-1 ring-inset ring-white/10"
      >
        <UIcon name="i-lucide-search" class="h-8 w-8 text-gray-600" />
        <p class="text-sm text-gray-300">No findings match your filters</p>
        <UButton color="neutral" variant="soft" size="xs" @click="clearFilters">Clear filters</UButton>
      </div>

      <!-- Findings grouped by subject -->
      <div v-else class="space-y-4">
        <section
          v-for="group in groups"
          :key="group.key"
          class="rounded-xl bg-[rgba(3,7,18,0.55)] ring-1 ring-inset ring-white/10"
          :aria-label="`Findings for ${group.subject.name}`"
        >
          <header class="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <UIcon :name="subjectIcon(group.subject.type)" class="h-4 w-4 text-sky-200" />
            <h3 class="text-sm font-semibold text-white">{{ subjectLabel(group.subject) }}</h3>
            <span class="text-xs text-gray-500">{{ group.subject.type }}</span>
          </header>
          <ul class="divide-y divide-white/5">
            <li v-for="finding in group.findings" :key="finding.id">
              <details class="group px-4 py-3">
                <summary class="flex cursor-pointer list-none items-start gap-3">
                  <span
                    class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold uppercase"
                    :class="severityBadge[finding.severity]"
                  >
                    {{ finding.severity }}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm text-gray-100">{{ finding.title }}</span>
                    <span class="block text-xs text-gray-500">{{ CHECK_LABELS[finding.check] }}</span>
                  </span>
                  <UIcon
                    name="i-lucide-chevron-down"
                    class="mt-1 h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div class="mt-3 space-y-2 pl-[3.75rem] text-[13px]">
                  <p class="text-gray-300">{{ finding.detail }}</p>
                  <p class="text-gray-400">
                    <span class="font-semibold text-gray-300">How to fix: </span>{{ finding.recommendation }}
                  </p>
                  <UButton
                    v-if="finding.fixable"
                    color="primary"
                    variant="soft"
                    size="xs"
                    icon="i-lucide-wrench"
                    @click="openFix(finding)"
                  >
                    Fix automatically…
                  </UButton>
                </div>
              </details>
            </li>
          </ul>
        </section>
      </div>

      <p class="text-xs text-gray-500">
        Generated {{ new Date(report.generatedAt).toLocaleString() }}. Results are cached for up to 30
        seconds; use the refresh button to re-run now.
      </p>
    </template>

    <DashboardPermissionFixModal :fix="fix" @confirm="onConfirmFix" @close="closeFix" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import type { FindingSubject, Severity } from "#shared/permission-audit-types";
import type { SeverityFilter } from "~/composables/usePermissionAudit";

const route = useRoute();
const guildId = route.params.guild_id as string;

const {
  report, loading, refreshing, error, severity, check, filtered, groups, run,
  fix, lastFix, openFix, confirmFix, closeFix,
} = usePermissionAudit(guildId);
const toast = useToast();

const onConfirmFix = async () => {
  if (!(await confirmFix())) return;
  if (lastFix.value?.logged === false) {
    toast.add({
      title: "Fix applied, but not logged",
      description: "The previous values could not be saved to the Server Logs. Discord's own audit log still records the change.",
      color: "warning",
    });
    return;
  }
  toast.add({
    title: "Fix applied",
    description: "The previous values were saved to the Server Logs.",
    color: "success",
  });
};

const severities: Array<{ value: SeverityFilter; label: string; badge: string }> = [
  { value: "all", label: "All", badge: "bg-white/[0.08] text-gray-300" },
  { value: "critical", label: "Critical", badge: "bg-red-400/15 text-red-200" },
  { value: "warning", label: "Warning", badge: "bg-amber-400/15 text-amber-200" },
  { value: "info", label: "Info", badge: "bg-sky-400/15 text-sky-200" },
];

const severityBadge: Record<Severity, string> = {
  critical: "bg-red-400/15 text-red-200",
  warning: "bg-amber-400/15 text-amber-200",
  info: "bg-sky-400/15 text-sky-200",
};

const checkItems = [
  { value: "all", label: "All checks" },
  ...Object.entries(CHECK_LABELS).map(([value, label]) => ({ value, label })),
];

const severityCount = (value: SeverityFilter) => {
  if (!report.value) return 0;
  return value === "all" ? report.value.findings.length : report.value.summary[value];
};

const subjectIcon = (type: FindingSubject["type"]) =>
  type === "role"
    ? "i-lucide-users"
    : type === "channel"
      ? "i-lucide-hash"
      : type === "bot"
        ? "i-lucide-bot"
        : "i-lucide-puzzle";

const subjectLabel = (subject: FindingSubject) =>
  subject.type === "channel" ? `#${subject.name}` : subject.name;

const clearFilters = () => {
  severity.value = "all";
  check.value = "all";
};

onMounted(() => run());
</script>

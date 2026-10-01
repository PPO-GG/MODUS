<template>
  <main class="space-y-6 p-5 sm:p-8">
    <AdminPageHeader
      icon="i-lucide-gauge"
      eyebrow="Fleet operations"
      title="Resource usage"
      description="Live CPU, memory and stream counts for the web, bot and Lavalink processes."
    >
      <template #actions>
        <span
          class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
          :class="connection === 'live' ? 'border-success/30 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning'"
          aria-live="polite"
        >
          <span class="size-1.5 rounded-full" :class="connection === 'live' ? 'bg-success' : 'bg-warning'" aria-hidden="true" />
          {{ connectionLabel }}
        </span>
        <span v-if="snapshot" class="text-xs glide-ink-3">Updated {{ updatedLabel }}</span>
      </template>
    </AdminPageHeader>

    <section v-if="error && !snapshot" class="rounded-2xl border border-error/30 bg-error/5 px-6 py-10 text-center" role="alert">
      <UIcon name="i-lucide-triangle-alert" class="mx-auto size-8 text-error" />
      <h2 class="mt-3 text-base font-bold text-white">Resource usage unavailable</h2>
      <p class="mx-auto mt-1 max-w-md text-sm text-gray-400">{{ error }}</p>
      <UButton class="mt-5" icon="i-lucide-refresh-cw" @click="refresh">Retry</UButton>
    </section>

    <section v-else-if="!snapshot" class="glide-tile rounded-2xl px-6 py-16 text-center" aria-busy="true" aria-live="polite">
      <UIcon name="i-lucide-loader-circle" class="mx-auto size-8 animate-spin text-primary-400" />
      <p class="mt-3 text-sm font-medium text-white">Loading resource usage</p>
    </section>

    <div v-else class="space-y-6 transition-opacity" :class="connection === 'live' ? '' : 'opacity-60'" :aria-busy="connection !== 'live'">
      <section aria-label="Summary" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article v-for="item in summary" :key="item.label" class="glide-tile rounded-2xl p-5">
          <div class="flex items-start justify-between gap-3">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] glide-ink-2">{{ item.label }}</p>
            <UIcon :name="item.icon" class="size-4 shrink-0 glide-a1" aria-hidden="true" />
          </div>
          <p class="mt-3 text-2xl font-black tracking-tight text-white">{{ item.value }}</p>
          <p class="mt-1 text-xs text-gray-400">{{ item.detail }}</p>
        </article>
      </section>

      <section aria-labelledby="web-heading">
        <h2 id="web-heading" class="mb-3 text-sm font-bold text-white">Web</h2>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AdminProcessTile title="Dashboard server" subtitle="Nuxt / Nitro" :sample="snapshot.web" :cpu-history="history.web.cpu" />
        </div>
      </section>

      <section aria-labelledby="bot-heading">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="bot-heading" class="text-sm font-bold text-white">Bot</h2>
          <span v-if="snapshot.bot.versionMismatch" class="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] text-warning">
            Shards disagree on version
          </span>
        </div>
        <p v-if="!snapshot.bot.available" class="glide-tile rounded-2xl px-5 py-6 text-sm text-gray-300">
          Live bot metrics need Redis. Set <code class="rounded bg-gray-800 px-1 text-xs">REDIS_URL</code> on the web and bot services, or check that Redis is reachable.
        </p>
        <p v-else-if="!snapshot.bot.shards.length" class="glide-tile rounded-2xl px-5 py-6 text-sm text-gray-300">
          No shard has reported yet. If the bot is running, the first sample arrives within a few seconds.
        </p>
        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AdminProcessTile
            v-for="shard in snapshot.bot.shards"
            :key="shard.shardId"
            :title="`Shard ${shard.shardId}`"
            :subtitle="`${shard.sample.guilds.toLocaleString()} servers · v${shard.sample.version}`"
            :sample="shard.sample"
            :cpu-history="history.shards[shard.shardId]?.cpu ?? []"
            :stale="shard.status === 'stale'"
            :age-ms="shard.ageMs"
          />
        </div>
      </section>

      <section aria-labelledby="lavalink-heading">
        <h2 id="lavalink-heading" class="mb-3 text-sm font-bold text-white">Lavalink</h2>
        <article class="glide-tile rounded-2xl p-5">
          <template v-if="lavalink.sample">
            <header class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold text-white">Music node</h3>
                <p class="mt-0.5 text-xs glide-ink-3">Up {{ formatUptime(lavalink.sample.uptimeMs / 1000) }} · {{ lavalink.sample.cpu.cores }} cores</p>
              </div>
              <span class="glide-chip shrink-0 px-2.5 py-0.5 text-[11px]">Live</span>
            </header>

            <div class="mt-5 grid gap-6 lg:grid-cols-[minmax(0,12rem)_1fr]">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.14em] glide-ink-2">Active streams</p>
                <p class="mt-2 text-4xl font-black tracking-tight text-white">{{ lavalink.sample.playingPlayers }}</p>
                <p class="mt-1 text-xs text-gray-400">{{ lavalink.sample.players }} players connected</p>
                <div class="mt-3">
                  <p class="mb-1 text-[11px] glide-ink-4">Streams, last 5 min</p>
                  <AdminSparkline :values="history.lavalink.streams" />
                </div>
              </div>

              <div>
                <div class="space-y-3">
                  <AdminMeter
                    label="Lavalink CPU"
                    :value="formatPercent(lavalink.sample.cpu.lavalinkLoad * 100)"
                    :ratio="lavalink.sample.cpu.lavalinkLoad"
                  />
                  <AdminMeter
                    label="System CPU"
                    :value="formatPercent(lavalink.sample.cpu.systemLoad * 100)"
                    :ratio="lavalink.sample.cpu.systemLoad"
                  />
                  <AdminMeter
                    label="JVM heap"
                    :value="`${formatBytes(lavalink.sample.memory.used)} / ${formatBytes(lavalink.sample.memory.reservable)}`"
                    :ratio="memoryRatio(lavalink.sample.memory.used, lavalink.sample.memory.reservable)"
                  />
                </div>
                <!-- Lavalink's REST /v4/stats never includes frameStats (websocket-only), so this renders only if a source ever supplies them. -->
                <dl v-if="lavalink.sample.frameStats" class="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt class="glide-ink-3">Frames sent / min</dt>
                    <dd class="mt-1 font-mono text-white">{{ lavalink.sample.frameStats.sent.toLocaleString() }}</dd>
                  </div>
                  <div>
                    <dt class="glide-ink-3">Nulled</dt>
                    <dd class="mt-1 font-mono text-white">{{ lavalink.sample.frameStats.nulled.toLocaleString() }}</dd>
                  </div>
                  <div>
                    <dt class="glide-ink-3">Deficit</dt>
                    <dd class="mt-1 font-mono text-white">{{ lavalink.sample.frameStats.deficit.toLocaleString() }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </template>

          <template v-else>
            <header class="flex items-start justify-between gap-3">
              <h3 class="text-sm font-semibold text-white">Music node</h3>
              <span
                v-if="lavalink.configured"
                class="inline-flex shrink-0 items-center rounded-full border border-error/40 bg-error/10 px-2.5 py-0.5 text-[11px] text-error"
              >
                Unreachable
              </span>
              <span v-else class="glide-chip shrink-0 px-2.5 py-0.5 text-[11px]">Not configured</span>
            </header>
            <p class="mt-3 text-sm text-gray-300">{{ lavalinkMessage }}</p>
          </template>
        </article>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatBytes, formatPercent, formatUptime, memoryRatio } from '~/utils/admin-resources'

useHead({ title: 'Resource usage — Admin' })

const { snapshot, history, connection, error, refresh } = useAdminResources()

const connectionLabel = computed(
  () => ({ live: 'Live', connecting: 'Connecting', reconnecting: 'Reconnecting' })[connection.value],
)

const updatedLabel = computed(() =>
  snapshot.value ? new Date(snapshot.value.generatedAt).toLocaleTimeString() : '',
)

// The template only renders this block when snapshot is non-null.
const lavalink = computed(() => snapshot.value!.lavalink)

const lavalinkMessage = computed(() => {
  if (!lavalink.value.configured) {
    return 'Set NUXT_LAVALINK_VERSION_URL (and NUXT_LAVALINK_PASSWORD) on the web service to monitor Lavalink here.'
  }
  const code = lavalink.value.error ?? ''
  if (code === 'timeout') return 'Lavalink did not respond in time.'
  if (code === 'unauthorized') return 'Lavalink rejected the configured password.'
  if (code === 'invalid_response') return 'Lavalink returned an unexpected response.'
  if (code.startsWith('http_')) return `Lavalink returned HTTP ${code.slice(5)}.`
  return 'Lavalink could not be reached.'
})

const summary = computed(() => {
  const snap = snapshot.value
  if (!snap) return []
  const live = snap.bot.shards.filter((shard) => shard.status === 'live')
  const botRss = live.reduce((total, shard) => total + shard.sample.rssBytes, 0)
  const botCpu = live.reduce((total, shard) => total + shard.sample.cpuPercent, 0)
  const lv = snap.lavalink.sample
  return [
    {
      label: 'Bot memory',
      value: live.length ? formatBytes(botRss) : '—',
      detail: `${live.length} of ${snap.bot.shards.length} shards live`,
      icon: 'i-lucide-memory-stick',
    },
    {
      label: 'Bot CPU',
      value: live.length ? formatPercent(botCpu) : '—',
      detail: 'Summed across live shards',
      icon: 'i-lucide-cpu',
    },
    {
      label: 'Active streams',
      value: lv ? String(lv.playingPlayers) : '—',
      detail: lv ? `${lv.players} players connected` : 'Lavalink unavailable',
      icon: 'i-lucide-audio-lines',
    },
    {
      label: 'Web memory',
      value: formatBytes(snap.web.rssBytes),
      detail: `CPU ${formatPercent(snap.web.cpuPercent)}`,
      icon: 'i-lucide-server',
    },
  ]
})
</script>

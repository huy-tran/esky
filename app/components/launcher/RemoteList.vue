<script setup lang="ts">
// GitHub, Jira and Sentry lists.
import type { Tone } from '~/composables/useRemote'

const L = useLauncher()
const s = L.s
const remote = L.remote
const box = ref<HTMLElement | null>(null)

const rows = computed(() => L.remoteModel.value)
const sel = computed(() => Math.min(s.remoteSel, Math.max(0, rows.value.length - 1)))
const src = computed(() => remote.source.value)

const TONE: Record<Tone, string[]> = {
  ok: ['var(--ok)', 'var(--ok-soft)'],
  warn: ['var(--warn)', 'var(--warn-soft)'],
  err: ['var(--err)', 'var(--err-soft)'],
  muted: ['var(--muted)', 'var(--tile)']
}

useKeepVisible(box, () => [s.remoteSel, s.remoteQuery])
</script>

<template>
  <div v-if="remote.status.value === 'error'" class="h-full flex flex-col items-center justify-center gap-2.5 text-center px-10">
    <Tile :icon="src?.icon ?? 'i-lucide-cloud-off'" :tile="src?.tile" :size="48" :icon-size="22" :radius="8" />
    <div class="text-[15px] font-semibold">Couldn’t load {{ src?.title.toLowerCase() }}</div>
    <div class="text-[13px] text-(--muted) max-w-[400px] leading-normal">{{ remote.error.value }}</div>
    <UButton label="Open settings" color="neutral" variant="outline" class="mt-1 h-8 rounded-[6px] text-[12.5px]" @click="openSettings({ tab: 'extensions', ext: src?.ext })" />
  </div>
  <div v-else-if="remote.status.value === 'loading' && !remote.rows.value.length" class="h-full flex items-center justify-center gap-2 text-[13px] text-(--muted)">
    <Spinner />Loading {{ src?.title.toLowerCase() }}…
  </div>
  <div v-else ref="box" class="relative h-full overflow-y-auto px-2 pt-1 pb-2 box-border scroll-thin">
    <div
      v-for="(r, i) in rows"
      :key="r.id"
      :data-sel="String(i === sel)"
      class="h-11 flex items-center gap-3 px-2.5 rounded-[6px] cursor-default"
      :class="i === sel ? 'bg-(--sel)' : 'bg-transparent'"
      @click="s.remoteSel = i"
      @dblclick="s.remoteSel = i; L.runAction('ropen')"
    >
      <Tile :icon="src?.icon ?? 'i-lucide-link'" :tile="src?.tile" :icon-size="15" />
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <span class="text-[13.5px] font-medium truncate">{{ r.title }}</span>
        <span class="text-(--muted) text-[11.5px] truncate">{{ r.sub }}</span>
      </div>
      <UBadge
        v-if="r.badge"
        :label="r.badge"
        class="flex-none h-5 px-[7px] rounded-[5px] text-[11px] font-semibold ring-0 capitalize"
        :style="{ color: TONE[r.tone ?? 'muted'][0], background: TONE[r.tone ?? 'muted'][1] }"
      />
    </div>
    <div v-if="!rows.length" class="py-10 px-3 text-center text-[13px] text-(--muted)">{{ s.remoteQuery ? 'No matches' : 'Nothing here' }}</div>
  </div>
</template>

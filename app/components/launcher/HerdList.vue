<script setup lang="ts">
import type { HerdSite } from '~/utils/herd'

const L = useLauncher()
const s = L.s
const box = ref<HTMLElement | null>(null)

const model = computed(() => L.herdModel.value)
const status = computed(() => L.herd.status.value)
const starts = computed(() => {
  let i = 0
  return model.value.groups.map((g) => {
    const at = i
    i += g.rows.length
    return at
  })
})

const run = (idx: number, x: HerdSite) => {
  s.herdSel = idx
  L.openSite(x)
}
const hover = (idx: number) => {
  if (s.herdSel !== idx) s.herdSel = idx
}

useKeepVisible(box, () => [s.herdSel, s.herdQuery])
</script>

<template>
  <div v-if="status === 'error' && !L.herd.sites.value.length" class="h-full flex flex-col items-center justify-center gap-2.5 text-center px-10">
    <Tile icon="i-lucide-feather" tile="#E11D48" :size="48" :icon-size="22" :radius="8" />
    <div class="text-[15px] font-semibold">Herd not found</div>
    <div class="text-[13px] text-(--muted) max-w-[340px] leading-normal">Esky reads your sites from <span class="font-mono text-[12px]">~\.config\herd</span>. Install Laravel Herd, then reload.</div>
    <div class="flex items-center gap-1.5 mt-1 text-[12px] text-(--muted)">Reload <Keys :keys="['Ctrl', 'R']" /></div>
  </div>
  <div v-else-if="status === 'loading' && !L.herd.sites.value.length" class="h-full flex items-center justify-center gap-2 text-[13px] text-(--muted)">
    <Spinner />Reading Herd sites…
  </div>
  <div v-else ref="box" class="relative h-full overflow-y-auto px-2 pt-1 pb-2 box-border scroll-thin">
    <template v-for="(g, gi) in model.groups" :key="g.title">
      <LauncherSectionLabel>{{ g.title }}</LauncherSectionLabel>
      <div
        v-for="(x, ri) in g.rows"
        :key="x.name"
        :data-sel="String(starts[gi]! + ri === s.herdSel)"
        class="h-11 flex items-center gap-3 px-2.5 rounded-[6px] cursor-default"
        :class="starts[gi]! + ri === s.herdSel ? 'bg-(--sel)' : 'bg-transparent'"
        @click="run(starts[gi]! + ri, x)"
        @mousemove="hover(starts[gi]! + ri)"
      >
        <Tile :icon="x.laravel ? 'i-lucide-feather' : 'i-lucide-globe'" :tile="x.laravel ? '#E11D48' : undefined" :icon-size="16" />
        <div class="flex-1 min-w-0 flex items-baseline gap-2 whitespace-nowrap overflow-hidden">
          <span class="text-[14px] font-medium">{{ x.name }}</span>
          <span class="text-(--muted) font-mono text-[12px] overflow-hidden text-ellipsis">{{ x.url.replace(/^https?:\/\//, '') }}</span>
        </div>
        <UIcon v-if="x.secured" name="i-lucide-lock" class="size-3.5 text-(--ok) flex-none" title="Secured (HTTPS)" />
        <UBadge v-if="x.laravel" label="Laravel" class="flex-none h-5 px-[7px] rounded-[5px] bg-(--accent-soft) text-(--accent-fg) text-[11px] font-semibold ring-0" />
      </div>
    </template>
    <div v-if="!model.flat.length" class="py-10 px-3 text-center text-[13px] text-(--muted)">No matches</div>
  </div>
</template>

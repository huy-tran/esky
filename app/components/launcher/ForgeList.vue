<script setup lang="ts">
import { STATUS, type Server } from '~/data/fixtures'

const L = useLauncher()
const s = L.s
const box = ref<HTMLElement | null>(null)

const model = computed(() => L.forgeModel.value)
const starts = computed(() => {
  let i = 0
  return model.value.groups.map((g) => {
    const at = i
    i += g.rows.length
    return at
  })
})

const run = (idx: number, r: Server) => {
  s.forgeSel = idx
  L.go('forgeDetail', { server: r })
}
const hover = (idx: number) => {
  if (s.forgeSel !== idx) s.forgeSel = idx
}

useKeepVisible(box, () => [s.forgeSel, s.forgeQuery])
</script>

<template>
  <div ref="box" class="relative h-full overflow-y-auto px-2 pt-1 pb-2 box-border scroll-thin">
    <template v-for="(g, gi) in model.groups" :key="g.title">
      <LauncherSectionLabel>{{ g.title }}</LauncherSectionLabel>
      <div
        v-for="(r, ri) in g.rows"
        :key="r.id"
        :data-sel="String(starts[gi]! + ri === s.forgeSel)"
        class="h-11 flex items-center gap-3 px-2.5 rounded-[6px] cursor-default"
        :class="starts[gi]! + ri === s.forgeSel ? 'bg-(--sel)' : 'bg-transparent'"
        @click="run(starts[gi]! + ri, r)"
        @mousemove="hover(starts[gi]! + ri)"
      >
        <Tile :icon="r.pIcon" :icon-size="16" />
        <div class="flex-1 min-w-0 flex items-baseline gap-2 whitespace-nowrap overflow-hidden">
          <span class="text-[14px] font-medium">{{ r.name }}</span>
          <span class="text-(--muted) font-mono text-[12px]">{{ r.ip }}</span>
        </div>
        <UBadge :label="`PHP ${r.php}`" class="flex-none h-5 px-[7px] rounded-[5px] bg-(--accent-soft) text-(--accent-fg) text-[11px] font-semibold ring-0" />
        <span class="flex-none w-[92px] flex items-center gap-1.5 text-[12px] text-(--muted)">
          <span class="size-2 rounded-full" :style="{ background: STATUS[r.status][1] }" />
          {{ STATUS[r.status][0] }}
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { programName } from '~/composables/useOpenWindows'

const L = useLauncher()
const s = L.s
const box = ref<HTMLElement | null>(null)
const rows = computed(() => L.switchModel.value)
const sel = computed(() => Math.min(s.switchSel, Math.max(0, rows.value.length - 1)))
const icons = computed(() => L.openWins.icons.value)

useKeepVisible(box, () => [s.switchSel, s.switchQuery])
</script>

<template>
  <div ref="box" class="relative h-full overflow-y-auto px-2 pt-1 pb-2 box-border scroll-thin">
    <div
      v-for="(w, i) in rows"
      :key="w.id"
      :data-sel="String(i === sel)"
      class="h-11 flex items-center gap-3 px-2.5 rounded-[6px] cursor-default"
      :class="i === sel ? 'bg-(--sel)' : 'bg-transparent'"
      @click="s.switchSel = i"
      @dblclick="s.switchSel = i; L.runAction('wfocus')"
    >
      <img v-if="w.exe && icons[w.exe]" :src="icons[w.exe]" alt="" class="size-6 flex-none">
      <Tile v-else icon="i-lucide-app-window" :icon-size="15" />
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <span class="text-[13.5px] font-medium truncate">{{ w.title }}</span>
        <span class="text-(--muted) text-[11.5px] truncate">{{ programName(w.exe) || 'Window' }}</span>
      </div>
      <UBadge v-if="w.minimized" label="Minimised" class="flex-none h-5 px-[7px] rounded-[5px] text-[11px] font-semibold ring-0 bg-(--tile) text-(--muted)" />
    </div>
    <div v-if="!rows.length" class="py-10 px-3 text-center text-[13px] text-(--muted)">{{ s.switchQuery ? 'No open windows match' : 'No open windows' }}</div>
  </div>
</template>

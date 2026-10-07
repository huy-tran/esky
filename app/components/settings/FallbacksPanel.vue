<script setup lang="ts">
// Settings → Quicklinks: which searches root search offers when nothing matches, in order.
import { fallbackOptions } from '~/utils/fallbacks'

const { settings } = useSettings()
const qls = useQuicklinks()
const options = computed(() => fallbackOptions(qls.list.value))

/** Chosen ones in their order, then the rest. */
const rows = computed(() => {
  const on = settings.value.fallbacks.map(id => options.value.find(o => o.id === id)).filter(o => !!o)
  return [...on.map(o => ({ ...o, on: true })), ...options.value.filter(o => !settings.value.fallbacks.includes(o.id)).map(o => ({ ...o, on: false }))]
})

function toggle(id: string, on: boolean) {
  const list = settings.value.fallbacks.filter(x => x !== id)
  settings.value.fallbacks = on ? [...list, id] : list
}
function move(id: string, by: number) {
  const list = [...settings.value.fallbacks]
  const i = list.indexOf(id)
  const j = i + by
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
  settings.value.fallbacks = list
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="text-[12px] font-semibold">When nothing matches</div>
    <div class="text-[12.5px] text-(--muted) leading-normal">Root search offers these for your text, in this order. Quicklinks with a <span class="font-mono text-(--fg)">{query}</span> can be used too.</div>
    <div class="flex flex-col border border-(--bd) rounded-[8px] bg-(--surface)">
      <div v-for="(r, i) in rows" :key="r.id" class="h-11 px-3 flex items-center gap-3" :class="i < rows.length - 1 ? 'border-b border-(--bd)' : ''">
        <UCheckbox :model-value="r.on" :aria-label="r.title" @update:model-value="(v: boolean | 'indeterminate') => toggle(r.id, v === true)" />
        <Tile :icon="r.icon" :tile="r.tile" :size="24" :icon-size="13" />
        <span class="flex-1 text-[13px]" :class="r.on ? 'text-(--fg)' : 'text-(--muted)'">{{ r.title }}</span>
        <template v-if="r.on">
          <UButton icon="i-lucide-chevron-up" color="neutral" variant="ghost" :aria-label="`Move ${r.title} up`" :disabled="i === 0" class="size-7 p-0 justify-center text-(--muted)" :ui="{ leadingIcon: 'size-3.5' }" @click="move(r.id, -1)" />
          <UButton icon="i-lucide-chevron-down" color="neutral" variant="ghost" :aria-label="`Move ${r.title} down`" :disabled="i === settings.fallbacks.length - 1" class="size-7 p-0 justify-center text-(--muted)" :ui="{ leadingIcon: 'size-3.5' }" @click="move(r.id, 1)" />
        </template>
      </div>
    </div>
  </div>
</template>

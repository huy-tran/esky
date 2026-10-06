<script setup lang="ts">
const L = useLauncher()
const s = L.s
const box = ref<HTMLElement | null>(null)

const model = computed(() => L.emojiModel.value)
const sel = computed(() => Math.min(s.splitSel, Math.max(0, model.value.flat.length - 1)))
const starts = computed(() => {
  let i = 0
  return model.value.groups.map((g) => {
    const at = i
    i += g.rows.length
    return at
  })
})
const hover = (idx: number) => {
  if (s.splitSel !== idx) s.splitSel = idx
}

useKeepVisible(box, () => [s.splitSel, s.splitQuery])
</script>

<template>
  <div ref="box" class="relative h-full overflow-y-auto pt-1 px-3 pb-3 box-border scroll-thin">
    <template v-for="(g, gi) in model.groups" :key="g.title">
      <div class="pt-2.5 px-0.5 pb-1.5 text-[11px] font-semibold tracking-[.04em] text-(--faint)">{{ g.title }}</div>
      <div class="grid grid-cols-[repeat(12,minmax(0,1fr))] gap-1">
        <div
          v-for="(em, ei) in g.rows"
          :key="em.e"
          :data-sel="String(starts[gi]! + ei === sel)"
          :title="em.n"
          class="aspect-square rounded-[6px] grid place-items-center text-[24px] cursor-default text-(--fg)"
          :class="starts[gi]! + ei === sel ? 'bg-(--sel) shadow-[inset_0_0_0_1.5px_var(--accent)]' : 'bg-transparent'"
          @click="L.closeWith(`Pasted ${em.e}`)"
          @mousemove="hover(starts[gi]! + ei)"
        >
          {{ em.e }}
        </div>
      </div>
    </template>
    <div v-if="!model.flat.length" class="py-10 px-3 text-center text-[13px] text-(--muted)">No matches</div>
  </div>
</template>

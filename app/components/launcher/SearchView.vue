<script setup lang="ts">
const L = useLauncher()
const s = L.s
const box = ref<HTMLElement | null>(null)

const model = computed(() => L.searchModel.value)
const sel = computed(() => Math.min(s.sel, Math.max(0, model.value.flat.length - 1)))
const offset = computed(() => model.value.card ? 1 : 0)

// Index of the first row of each section in the flat list.
const starts = computed(() => {
  let i = offset.value
  return model.value.sections.map((sec) => {
    const at = i
    i += sec.rows.length
    return at
  })
})

const hover = (i: number) => {
  if (s.sel !== i) s.sel = i
}

useKeepVisible(box, () => [s.sel, s.query, s.view])
</script>

<template>
  <div ref="box" class="relative h-full overflow-y-auto px-2 pt-1 pb-2 box-border scroll-thin">
    <LauncherQuickResultCard v-if="model.card" :card="model.card" :selected="sel === 0" @hover="hover(0)" @run="model.card.run()" />
    <template v-for="(sec, si) in model.sections" :key="sec.title">
      <LauncherSectionLabel>{{ sec.title }}</LauncherSectionLabel>
      <LauncherResultRow
        v-for="(row, ri) in sec.rows"
        :key="row.key"
        :row="row"
        :selected="starts[si]! + ri === sel"
        @hover="hover(starts[si]! + ri)"
        @run="row.run()"
      />
    </template>
  </div>
</template>

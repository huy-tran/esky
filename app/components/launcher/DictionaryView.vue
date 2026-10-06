<script setup lang="ts">
import { DICT_SENSES } from '~/composables/useLauncher'

const L = useLauncher()
const s = L.s
const d = L.dict
const box = ref<HTMLElement | null>(null)

// Flat index of the first sense of each part of speech, for ↑/↓ selection.
const starts = computed(() => {
  let i = 0
  return (d.entry?.parts ?? []).map((p) => {
    const at = i
    i += Math.min(p.senses.length, DICT_SENSES)
    return at
  })
})

/** "**run**s fast" → bold segments for the headword in examples. */
const exampleSegs = (t: string) => t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(x => x.startsWith('**') ? { t: x.slice(2, -2), b: true } : { t: x, b: false })

const pick = (i: number) => {
  s.dictSel = i
}

useKeepVisible(box, () => [s.dictSel, d.entry])
</script>

<template>
  <div v-if="d.status === 'idle'" class="h-full flex flex-col items-center justify-center gap-2.5 text-center px-10">
    <Tile icon="i-lucide-book-a" tile="#0369A1" :size="48" :icon-size="22" :radius="8" />
    <div class="text-[15px] font-semibold">Look up a word</div>
    <div class="text-[13px] text-(--muted) max-w-[340px] leading-normal">Definitions, word forms and examples from Wiktionary.</div>
    <div class="flex items-center gap-1.5 mt-1 text-[12px] text-(--muted)">From root search, type <Keys :keys="['define']" /> and a word</div>
  </div>

  <div v-else-if="d.status === 'empty' || d.status === 'error'" class="h-full flex flex-col items-center justify-center gap-2.5 text-center px-10">
    <Tile :icon="d.status === 'error' ? 'i-lucide-wifi-off' : 'i-lucide-search-x'" :size="48" :icon-size="22" :radius="8" />
    <div class="text-[15px] font-semibold">{{ d.status === 'error' ? 'Can’t reach Wiktionary' : `No definitions for “${s.dictWord.trim()}”` }}</div>
    <div class="text-[13px] text-(--muted) max-w-[340px] leading-normal">{{ d.status === 'error' ? d.error : 'Check the spelling, or try the base form of the word.' }}</div>
  </div>

  <div v-else ref="box" class="relative h-full overflow-y-auto py-4 px-[22px] box-border flex flex-col gap-3.5 scroll-thin">
    <div class="flex items-baseline gap-3">
      <div class="text-[24px] font-semibold tracking-[-.015em]">{{ d.status === 'ready' && d.entry ? d.entry.word : s.dictWord.trim() }}</div>
      <div v-if="d.entry?.ipa" class="font-mono text-[13px] text-(--muted)">{{ d.entry.ipa }}</div>
    </div>

    <LauncherStreamShimmer v-if="d.status === 'loading'" />

    <template v-else-if="d.entry">
      <section v-for="(p, pi) in d.entry.parts" :key="p.pos" class="flex flex-col gap-1">
        <div class="flex items-baseline gap-2 pb-0.5">
          <span class="text-[11px] font-semibold tracking-[.04em] text-(--faint) uppercase">{{ p.pos }}</span>
          <span v-if="p.senses.length > DICT_SENSES" class="text-[11px] text-(--faint)">{{ DICT_SENSES }} of {{ p.senses.length }} senses</span>
        </div>
        <div v-if="p.forms.length" class="flex flex-wrap gap-1.5 pb-1">
          <span v-for="f in p.forms" :key="f" class="h-5 inline-flex items-center px-[7px] rounded-[5px] bg-(--tile) text-[11.5px] text-(--muted)">{{ f }}</span>
        </div>
        <div
          v-for="(sense, si) in p.senses.slice(0, DICT_SENSES)"
          :key="si"
          :data-sel="String(starts[pi]! + si === s.dictSel)"
          class="flex gap-2.5 px-2.5 py-2 rounded-[6px] cursor-default"
          :class="starts[pi]! + si === s.dictSel ? 'bg-(--sel)' : 'bg-transparent'"
          @click="pick(starts[pi]! + si)"
        >
          <span class="w-4 flex-none text-right text-[12.5px] text-(--faint) tabular-nums leading-[1.6]">{{ si + 1 }}</span>
          <div class="flex-1 min-w-0 flex flex-col gap-1">
            <div class="text-[13.5px] leading-[1.6] text-pretty">{{ sense.text }}</div>
            <div v-for="(ex, ei) in sense.examples.slice(0, 2)" :key="ei" class="border-l-2 border-(--bd) pl-2.5 text-[12.5px] leading-normal text-(--muted)">
              <template v-for="(seg, k) in exampleSegs(ex)" :key="k">
                <span v-if="seg.b" class="text-(--accent-fg) font-semibold">{{ seg.t }}</span><span v-else>{{ seg.t }}</span>
              </template>
            </div>
          </div>
        </div>
      </section>
      <div class="text-[12px] text-(--muted) flex items-center gap-1.5 pt-1">More senses, etymology and translations on Wiktionary <Keys :keys="['Ctrl', 'O']" size="sm" /></div>
    </template>
  </div>
</template>

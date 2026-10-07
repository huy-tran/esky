<script setup lang="ts">
import { LANGS, langName, sameLang } from '~/utils/translate'

const L = useLauncher()
const s = L.s
const tr = L.tr
const items = LANGS.map(l => ({ value: l.code, label: l.name }))
const pair = computed(() => L.trLangs.value)
/** Which side of the pair the text was detected as (or -1 for a third language). */
const fromSide = computed(() => {
  const r = tr.result
  if (!r) return -1
  return sameLang(r.from, pair.value[0]) ? 0 : sameLang(r.from, pair.value[1]) ? 1 : -1
})

const selectUi = { base: 'h-8 rounded-[6px] border border-(--bd) bg-(--input-bg) text-(--fg) text-[13px] pl-2.5 pr-8', trailingIcon: 'size-3.5 text-(--muted)', content: 'bg-(--pop-bg) ring-(--win-bd) min-w-[220px]', item: 'text-[13px]', input: 'text-[13px]' }
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center gap-2 px-[22px] pt-3.5 pb-3 border-b border-(--bd)">
      <USelectMenu
        :model-value="pair[0]"
        :items="items"
        value-key="value"
        variant="none"
        trailing-icon="i-lucide-chevron-down"
        :search-input="{ placeholder: 'Search languages…' }"
        class="w-[200px]"
        :ui="selectUi"
        @update:model-value="(v: string) => L.setLang(0, v)"
      />
      <UButton
        icon="i-lucide-arrow-left-right"
        color="neutral"
        variant="ghost"
        title="Swap languages (Ctrl S)"
        class="size-8 justify-center rounded-[6px] text-(--muted) hover:text-(--fg)"
        @click="L.swapLangs()"
      />
      <USelectMenu
        :model-value="pair[1]"
        :items="items"
        value-key="value"
        variant="none"
        trailing-icon="i-lucide-chevron-down"
        :search-input="{ placeholder: 'Search languages…' }"
        class="w-[200px]"
        :ui="selectUi"
        @update:model-value="(v: string) => L.setLang(1, v)"
      />
      <span class="flex-1" />
      <span v-if="tr.result" class="text-[12px] text-(--muted)">
        {{ fromSide === -1 ? `Detected ${langName(tr.result.from)}` : langName(tr.result.from) }} → {{ langName(tr.result.to) }}
      </span>
    </div>

    <div v-if="tr.status === 'idle'" class="flex-1 flex flex-col items-center justify-center gap-2.5 text-center px-10">
      <Tile icon="i-lucide-languages" tile="#1A73E8" :size="48" :icon-size="22" :radius="8" />
      <div class="text-[15px] font-semibold">Translate between {{ langName(pair[0]) }} and {{ langName(pair[1]) }}</div>
      <div class="text-[13px] text-(--muted) max-w-[380px] leading-normal">Type in either language and it goes into the other. Your two languages are remembered.</div>
      <div class="flex items-center gap-1.5 mt-1 text-[12px] text-(--muted)">From root search, type <Keys :keys="['tr']" /> and your text</div>
    </div>

    <div v-else-if="tr.status === 'error'" class="flex-1 flex flex-col items-center justify-center gap-2.5 text-center px-10">
      <Tile icon="i-lucide-wifi-off" :size="48" :icon-size="22" :radius="8" />
      <div class="text-[15px] font-semibold">Can’t reach Google Translate</div>
      <div class="text-[13px] text-(--muted) max-w-[380px] leading-normal">{{ tr.error }}</div>
    </div>

    <div v-else class="flex-1 min-h-0 overflow-y-auto py-4 px-[22px] box-border flex flex-col gap-3 scroll-thin">
      <LauncherStreamShimmer v-if="tr.status === 'loading' && !tr.result" />
      <template v-else-if="tr.result">
        <div class="text-[11px] font-semibold tracking-[.04em] text-(--faint) uppercase">{{ langName(tr.result.to) }}</div>
        <div class="text-[17px] leading-[1.55] whitespace-pre-wrap select-text text-pretty" :class="tr.status === 'loading' ? 'opacity-60' : ''">{{ tr.result.text }}</div>
      </template>
    </div>
  </div>
</template>

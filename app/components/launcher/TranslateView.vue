<script setup lang="ts">
import { LANGS, langName, sameLang } from '~/utils/translate'

const L = useLauncher()
const s = L.s
const tr = L.tr
const items = LANGS.map(l => ({ value: l.code, label: l.name }))
const pair = computed(() => L.trLangs.value)
/** Did the text come in as a third language (neither side of the pair)? */
const detected = computed(() => {
  const r = tr.result
  return !!r && !sameLang(r.from, pair.value[0]) && !sameLang(r.from, pair.value[1])
})

onBeforeUnmount(() => {
  L.els.tr = null
})

const selectUi = { base: 'h-8 rounded-[6px] border border-(--bd) bg-(--input-bg) text-(--fg) text-[13px] pl-2.5 pr-8', trailingIcon: 'size-3.5 text-(--muted)', content: 'bg-(--pop-bg) ring-(--win-bd) min-w-[220px]', item: 'text-[13px]', input: 'text-[13px]' }
const pane = 'flex-1 min-w-0 flex flex-col rounded-[8px] border border-(--bd) overflow-hidden'
const paneHead = 'h-8 flex-none flex items-center gap-2 px-3 border-b border-(--bd) text-[11.5px] font-semibold tracking-[.04em] uppercase text-(--faint)'
const paneFoot = 'h-8 flex-none flex items-center gap-2 px-3 text-[12px] text-(--muted)'
</script>

<template>
  <div class="h-full pt-3 px-4 pb-4 box-border flex flex-col gap-3">
    <div class="flex items-center gap-2">
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
      <span class="text-[12px] text-(--muted)">Type in either language</span>
    </div>

    <div class="flex-1 min-h-0 flex gap-3">
      <!-- Your text -->
      <div :class="[pane, 'bg-(--input-bg) focus-within:border-(--accent)']">
        <div :class="paneHead">
          {{ tr.result ? (detected ? `Detected ${langName(tr.result.from)}` : langName(tr.result.from)) : 'Your text' }}
        </div>
        <UTextarea
          :ref="(c: any) => { L.els.tr = c?.textareaRef ?? null }"
          v-model="s.trText"
          placeholder="Type or paste text…"
          variant="none"
          autofocus
          class="flex-1 min-h-0 w-full"
          :ui="{ root: 'h-full', base: 'h-full px-3 py-2.5 resize-none bg-transparent text-[14.5px] leading-[1.6] text-(--fg) placeholder:text-(--faint) scroll-thin' }"
        />
        <div :class="paneFoot">
          <span>{{ s.trText.length.toLocaleString() }} characters</span>
          <span class="flex-1" />
          <span class="flex items-center gap-1">New line <Keys :keys="['Shift', '↵']" size="sm" /></span>
        </div>
      </div>

      <!-- Translation -->
      <div :class="[pane, 'bg-(--surface)']">
        <div :class="paneHead">
          {{ tr.result ? langName(tr.result.to) : 'Translation' }}
          <Spinner v-if="tr.status === 'loading'" :size="11" />
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 scroll-thin">
          <div v-if="tr.status === 'error'" class="text-[13px] text-(--err) leading-normal">{{ tr.error }}</div>
          <div v-else-if="tr.result" class="text-[14.5px] leading-[1.6] whitespace-pre-wrap select-text" :class="tr.status === 'loading' ? 'opacity-60' : ''">{{ tr.result.text }}</div>
          <div v-else-if="tr.status === 'idle'" class="text-[13px] text-(--faint) leading-normal">
            {{ langName(pair[0]) }} goes into {{ langName(pair[1]) }}, and {{ langName(pair[1]) }} back into {{ langName(pair[0]) }}.
          </div>
        </div>
        <div :class="paneFoot">
          <UButton
            v-if="tr.result"
            icon="i-lucide-copy"
            label="Copy"
            color="neutral"
            variant="ghost"
            class="h-6 px-1.5 -ml-1.5 gap-1 text-[12px] text-(--muted) hover:text-(--fg)"
            :ui="{ leadingIcon: 'size-3.5' }"
            @click="L.runAction('tcopy')"
          />
          <span class="flex-1" />
          <span v-if="tr.result" class="flex items-center gap-1">{{ s.target ? `Paste into ${s.target.app}` : 'Copy and close' }} <Keys :keys="['↵']" size="sm" /></span>
        </div>
      </div>
    </div>
  </div>
</template>

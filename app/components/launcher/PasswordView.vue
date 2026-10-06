<script setup lang="ts">
import { PW_LIMITS, SPECIAL } from '~/utils/password'

const L = useLauncher()
const pw = L.pw
const o = pw.opts

/** Digits and symbols in their own colours, as Bitwarden shows them. */
const segs = computed(() => [...pw.value.value].map(ch => ({
  ch,
  c: /\d/.test(ch) ? 'var(--accent-fg)' : SPECIAL.includes(ch) ? 'var(--err)' : undefined
})))

const set = <K extends keyof typeof o.value>(k: K, v: (typeof o.value)[K]) => {
  o.value = { ...o.value, [k]: v }
}
const num = (k: 'length' | 'minNumbers' | 'minSpecial' | 'words', v: number | null) => {
  const [lo, hi] = PW_LIMITS[k]
  if (v != null && Number.isFinite(v)) set(k, Math.min(hi, Math.max(lo, Math.round(v))))
}

const CHARSETS = [['uppercase', 'A-Z'], ['lowercase', 'a-z'], ['numbers', '0-9'], ['special', SPECIAL]] as const

const label = 'text-[12.5px] font-semibold text-(--fg)'
const numUi = { base: 'h-8 w-full border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-2.5 text-[13px] font-mono focus-visible:outline-2 focus-visible:outline-(--accent)' }
const switchUi = {
  root: 'items-center gap-2.5',
  base: 'w-[34px] border-[3px] data-[state=unchecked]:bg-(--tile) data-[state=checked]:bg-(--accent) focus-visible:outline-(--accent)',
  container: 'h-5',
  thumb: 'size-3.5 bg-white shadow-none data-[state=checked]:translate-x-3.5',
  wrapper: 'ms-0',
  label: 'text-[13px] font-medium text-(--fg)'
}
const checkUi = { root: 'items-center', base: 'size-4 rounded-[4px] ring-(--bd) data-[state=checked]:bg-(--accent) data-[state=checked]:ring-(--accent)', label: 'text-[13px] font-mono text-(--fg)', wrapper: 'ms-2' }
const sliderUi = { track: 'bg-(--tile)', range: 'bg-(--accent)', thumb: 'size-3.5 ring-2 ring-(--accent) bg-white' }
</script>

<template>
  <div class="h-full overflow-y-auto px-5 py-4 box-border flex flex-col gap-4">
    <div class="flex items-stretch gap-2">
      <div class="flex-1 min-w-0 min-h-[64px] flex items-center px-3.5 py-2.5 rounded-[8px] border border-(--bd) bg-(--surface) font-mono text-[17px] leading-[1.45] break-all select-all" aria-live="polite">
        <span v-for="(x, i) in segs" :key="i" :style="x.c ? { color: x.c } : undefined">{{ x.ch }}</span>
      </div>
      <div class="flex flex-col gap-1.5">
        <UButton icon="i-lucide-copy" title="Copy (Ctrl C)" color="neutral" variant="outline" tabindex="-1" class="size-[29px] p-0 justify-center rounded-[6px] ring-0 border border-(--bd) bg-(--surface) text-(--fg)" :ui="{ leadingIcon: 'size-3.5' }" @click="L.copyPassword(false)" />
        <UButton icon="i-lucide-refresh-cw" title="Regenerate (Ctrl R)" color="neutral" variant="outline" tabindex="-1" class="size-[29px] p-0 justify-center rounded-[6px] ring-0 border border-(--bd) bg-(--surface) text-(--fg)" :ui="{ leadingIcon: 'size-3.5' }" @click="pw.regenerate()" />
      </div>
    </div>

    <div class="flex items-center gap-3">
      <div class="inline-flex p-[3px] rounded-[7px] bg-(--tile)" role="tablist">
        <button
          v-for="t in (['password', 'passphrase'] as const)"
          :key="t"
          role="tab"
          :aria-selected="o.type === t"
          tabindex="-1"
          class="h-7 px-3.5 rounded-[5px] text-[12.5px] font-semibold capitalize"
          :class="o.type === t ? 'bg-(--surface) text-(--fg) shadow-sm' : 'text-(--muted)'"
          @click="pw.setType(t)"
        >
          {{ t }}
        </button>
      </div>
      <span class="text-[12px] text-(--muted) flex items-center gap-1.5">Switch <Keys :keys="['Ctrl', 'T']" size="sm" /></span>
    </div>

    <div v-if="o.type === 'password'" class="grid grid-cols-2 gap-x-6 gap-y-3.5">
      <div class="col-span-2 flex flex-col gap-1.5">
        <span :class="label">Length</span>
        <div class="flex items-center gap-3">
          <USlider :model-value="o.length" :min="PW_LIMITS.length[0]" :max="PW_LIMITS.length[1]" class="flex-1" :ui="sliderUi" @update:model-value="(v?: number) => num('length', v ?? null)" />
          <UInputNumber :model-value="o.length" :min="PW_LIMITS.length[0]" :max="PW_LIMITS.length[1]" :increment="false" :decrement="false" variant="none" class="w-[68px]" :ui="numUi" @update:model-value="(v: number | null) => num('length', v)" />
        </div>
      </div>
      <div class="col-span-2 flex flex-col gap-2">
        <span :class="label">Include</span>
        <div class="flex items-center gap-5">
          <UCheckbox v-for="[k, l] in CHARSETS" :key="k" :model-value="o[k]" :label="l" :ui="checkUi" @update:model-value="(v: boolean | 'indeterminate') => set(k, v === true)" />
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <span :class="label">Minimum numbers</span>
        <UInputNumber :model-value="o.minNumbers" :min="PW_LIMITS.minNumbers[0]" :max="PW_LIMITS.minNumbers[1]" :disabled="!o.numbers" variant="none" :ui="numUi" @update:model-value="(v: number | null) => num('minNumbers', v)" />
      </div>
      <div class="flex flex-col gap-1.5">
        <span :class="label">Minimum special</span>
        <UInputNumber :model-value="o.minSpecial" :min="PW_LIMITS.minSpecial[0]" :max="PW_LIMITS.minSpecial[1]" :disabled="!o.special" variant="none" :ui="numUi" @update:model-value="(v: number | null) => num('minSpecial', v)" />
      </div>
      <USwitch :model-value="o.avoidAmbiguous" label="Avoid ambiguous characters" class="col-span-2" :ui="switchUi" @update:model-value="(v: boolean) => set('avoidAmbiguous', v)" />
    </div>

    <div v-else class="grid grid-cols-2 gap-x-6 gap-y-3.5">
      <div class="col-span-2 flex flex-col gap-1.5">
        <span :class="label">Number of words</span>
        <div class="flex items-center gap-3">
          <USlider :model-value="o.words" :min="PW_LIMITS.words[0]" :max="PW_LIMITS.words[1]" class="flex-1" :ui="sliderUi" @update:model-value="(v?: number) => num('words', v ?? null)" />
          <UInputNumber :model-value="o.words" :min="PW_LIMITS.words[0]" :max="PW_LIMITS.words[1]" :increment="false" :decrement="false" variant="none" class="w-[68px]" :ui="numUi" @update:model-value="(v: number | null) => num('words', v)" />
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <span :class="label">Word separator</span>
        <UInput :model-value="o.separator" :maxlength="1" spellcheck="false" autocomplete="off" variant="none" class="w-[68px]" :ui="{ base: numUi.base + ' text-center' }" @update:model-value="(v: string | number) => set('separator', String(v).slice(0, 1))" />
      </div>
      <div class="flex flex-col gap-3 justify-end">
        <USwitch :model-value="o.capitalize" label="Capitalise" :ui="switchUi" @update:model-value="(v: boolean) => set('capitalize', v)" />
        <USwitch :model-value="o.includeNumber" label="Include number" :ui="switchUi" @update:model-value="(v: boolean) => set('includeNumber', v)" />
      </div>
    </div>
  </div>
</template>

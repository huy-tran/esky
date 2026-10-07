<script setup lang="ts">
import { ONB_HK, ONB_ROWS, ONB_STEPS } from '~/data/fixtures'

const L = useLauncher()
const s = L.s
const o = computed(() => s.onb!)
const step = computed(() => ONB_STEPS[o.value.step]!)
const toggles = computed(() => ONB_ROWS[o.value.step - 1] || [])
const tips = computed(() => ([
  ['Open Esky', ONB_HK[o.value.hk]![0]],
  ['Actions for any result', ['Ctrl', 'K']],
  ['Back, or hide Esky', ['Esc']],
  ['Chat with Claude', ['ai', 'Tab']],
  ['Settings and shortcuts', ['Ctrl', ',']]
] as [string, string[]][]))

const pickHk = (i: number) => {
  if (s.onb) s.onb = { ...s.onb, hk: i }
}
const toggle = (id: string) => {
  const c = s.onb
  if (c) s.onb = { ...c, tg: { ...c.tg, [id]: !c.tg[id] } }
}

const switchUi = {
  base: 'w-[34px] border-[3px] data-[state=unchecked]:bg-(--tile) data-[state=checked]:bg-(--accent)',
  container: 'h-5',
  thumb: 'size-3.5 bg-white shadow-none data-[state=checked]:translate-x-3.5'
}
const btn = 'h-8 gap-[7px] rounded-[6px] text-[13px] ring-0'
</script>

<template>
  <div class="absolute inset-0 bg-(--onb-bg) flex flex-col animate-[lp-in_.16s_ease-out]">
    <div class="flex-1 min-h-0 overflow-y-auto pt-[30px] px-10 pb-5 flex flex-col gap-5">
      <div class="flex items-center gap-1.5">
        <span
          v-for="i in [0, 1, 2, 3]"
          :key="i"
          class="h-1.5 rounded-[3px] transition-[width] duration-200"
          :style="{ width: i === o.step ? '24px' : '8px', background: i <= o.step ? 'var(--accent)' : 'var(--tile)' }"
        />
      </div>
      <div class="flex items-center gap-3.5">
        <EskyIcon :size="44" />
        <div>
          <div class="text-[24px] font-semibold tracking-[-.015em]">{{ step[0] }}</div>
          <div class="text-[14px] text-(--muted) mt-1.5 leading-[1.55] max-w-[520px] text-pretty">{{ step[1] }}</div>
        </div>
      </div>

      <div v-if="o.step === 0" class="grid grid-cols-3 gap-2.5">
        <div
          v-for="([keys, sub], i) in ONB_HK"
          :key="i"
          class="rounded-[8px] border-[1.5px] px-3.5 py-4 flex flex-col gap-2.5 cursor-pointer"
          :style="{ borderColor: o.hk === i ? 'var(--accent)' : 'var(--bd)', background: o.hk === i ? 'var(--sel)' : 'var(--surface)' }"
          @click="pickHk(i)"
        >
          <Keys :keys="keys" size="onb" />
          <div class="text-[12px] text-(--muted) leading-[1.45]">{{ sub }}</div>
        </div>
      </div>

      <div v-else-if="o.step === 1 || o.step === 2" class="flex flex-col gap-px bg-(--bd) border border-(--bd) rounded-[8px] overflow-hidden">
        <div v-for="[id, title, desc, icon] in toggles" :key="id" class="flex items-center gap-3 px-3.5 py-[11px] bg-(--onb-bg) cursor-pointer" @click="toggle(id)">
          <Tile :icon="icon" :icon-size="16" />
          <div class="flex-1 min-w-0">
            <div class="text-[13.5px] font-medium">{{ title }}</div>
            <div class="text-[12px] text-(--muted) mt-0.5">{{ desc }}</div>
          </div>
          <USwitch :model-value="!!o.tg[id]" tabindex="-1" :ui="switchUi" class="pointer-events-none" />
        </div>
      </div>

      <div v-else class="flex flex-col gap-px bg-(--bd) border border-(--bd) rounded-[8px] overflow-hidden">
        <div v-for="[t, keys] in tips" :key="t" class="h-11 flex items-center gap-3 px-3.5 bg-(--onb-bg) text-[13.5px]">
          <span class="flex-1">{{ t }}</span>
          <Keys :keys="keys" />
        </div>
      </div>
    </div>
    <div class="h-14 flex-none flex items-center gap-2 pr-4 pl-5 border-t border-(--bd) bg-(--footer-bg)">
      <button tabindex="-1" class="border-0 bg-transparent text-(--muted) text-[12.5px] cursor-pointer p-0" @click="L.onbSkip()">Skip setup</button>
      <span class="flex-1" />
      <UButton v-if="o.step > 0" tabindex="-1" :class="`${btn} pl-2.5 pr-2 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) font-medium`" @click="L.onbBack()">
        Back<Keys :keys="['Esc']" size="btn" />
      </UButton>
      <UButton tabindex="-1" :class="`${btn} pl-3 pr-2 bg-(--accent) hover:bg-(--accent) text-(--on-accent) font-semibold`" @click="L.onbNext()">
        {{ o.step === 3 ? 'Start using Esky' : 'Continue' }}<Keys :keys="['↵']" size="accent" />
      </UButton>
    </div>
  </div>
</template>

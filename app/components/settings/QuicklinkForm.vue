<script setup lang="ts">
// Name, keyword and URL fields for one quicklink.
import type { QuicklinkInput } from '~/composables/useQuicklinks'

defineProps<{ errors: string[], arg: string | null }>()
const model = defineModel<QuicklinkInput>({ required: true })

const label = 'text-[12px] font-semibold text-(--fg)'
const input = 'h-8 w-full border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-2.5 text-[12.5px] focus-visible:outline-2 focus-visible:outline-(--accent)'
</script>

<template>
  <div class="grid grid-cols-[1fr_120px] gap-x-3 gap-y-2.5">
    <label class="flex flex-col gap-1">
      <span :class="label">Name</span>
      <input v-model="model.name" placeholder="GitHub Search" :class="input">
    </label>
    <label class="flex flex-col gap-1">
      <span :class="label">Keyword</span>
      <input v-model="model.kw" placeholder="gh" spellcheck="false" :class="`${input} font-mono`">
    </label>
    <label class="col-span-2 flex flex-col gap-1">
      <span :class="label">URL</span>
      <input v-model="model.url" placeholder="https://github.com/search?q={query}" spellcheck="false" :class="`${input} font-mono`">
      <span class="text-[11.5px] text-(--muted)">
        <template v-if="arg">Asks for: <span class="text-(--fg)">{{ arg }}</span></template>
        <template v-else>Opens as is. Add a {placeholder} to type something into it.</template>
      </span>
    </label>
    <div v-if="errors.length" class="col-span-2 flex flex-col gap-0.5 text-[12px] text-(--err)">
      <span v-for="e in errors" :key="e">{{ e }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { tok } from '~/utils/text'

const props = defineProps<{ lang: string, file: string, code: string }>()
defineEmits<{ copy: [] }>()
const lines = computed(() => props.code.split('\n').map(l => tok(l)))
</script>

<template>
  <div class="border border-(--bd) rounded-[6px] overflow-hidden bg-(--code-bg)">
    <div class="h-8 flex items-center gap-2 pr-1.5 pl-3 border-b border-(--bd)">
      <span class="font-mono text-[11px] text-(--accent-fg) font-medium">{{ lang }}</span>
      <span class="text-[12px] text-(--muted)">{{ file }}</span>
      <span class="flex-1" />
      <UButton
        tabindex="-1"
        icon="i-lucide-copy"
        label="Copy"
        color="neutral"
        variant="ghost"
        class="h-6 gap-[5px] px-2 rounded-[5px] bg-(--tile) hover:bg-(--tile) text-(--fg) text-[11.5px] font-normal"
        :ui="{ leadingIcon: 'size-3' }"
        @click="$emit('copy')"
      />
    </div>
    <div class="px-3 py-2.5 overflow-x-auto font-mono text-[12px] leading-[18px]">
      <div v-for="(ln, i) in lines" :key="i" class="whitespace-pre min-h-[18px]"><span v-for="(t, j) in ln" :key="j" :style="{ color: t.c }">{{ t.t }}</span></div>
    </div>
  </div>
</template>

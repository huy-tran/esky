<script setup lang="ts">
import type { QuickCard } from '~/utils/quick'

defineProps<{ card: QuickCard, selected: boolean }>()
defineEmits<{ hover: [], run: [] }>()
</script>

<template>
  <UCard
    variant="subtle"
    :data-sel="String(selected)"
    class="mt-2 mx-0.5 mb-1.5 rounded-[8px] ring-0 border divide-y-0"
    :class="selected ? 'border-(--accent) bg-(--sel)' : 'border-(--bd) bg-(--surface)'"
    :ui="{ body: 'p-0 sm:p-0 px-[18px] py-[14px] sm:px-[18px] sm:py-[14px] flex flex-col gap-1' }"
    @click="$emit('run')"
    @mousemove="$emit('hover')"
  >
    <div class="flex items-center gap-1.5 text-(--faint) text-[11px] font-semibold tracking-[.05em] uppercase">
      <UIcon :name="card.icon" class="size-[13px]" />{{ card.label }}
    </div>
    <div class="text-[14px] text-(--muted) mt-1.5">{{ card.caption }}</div>
    <div class="text-[36px] font-semibold tracking-[-.02em] tabular-nums leading-[1.15]">{{ card.big }}</div>
    <div class="flex items-center gap-2 mt-1.5 min-h-[22px]">
      <span class="text-[12px] text-(--muted)">{{ card.meta }}</span>
      <span class="flex-1" />
      <span class="text-[12px] text-(--fg) font-medium">Copy</span>
      <Keys :keys="['↵']" />
    </div>
  </UCard>
</template>

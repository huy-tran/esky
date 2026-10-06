<script setup lang="ts">
import type { ToolStatus } from '~/data/fixtures'

const props = defineProps<{ cmd: string, status: ToolStatus, out?: string[] }>()

const ST: Record<ToolStatus, [string, string, string]> = {
  pending: ['Waiting for approval', 'var(--warn)', 'var(--warn-soft)'],
  running: ['Running…', 'var(--accent-fg)', 'var(--accent-soft)'],
  done: ['Completed', 'var(--ok)', 'var(--ok-soft)'],
  denied: ['Denied', 'var(--err)', 'var(--err-soft)']
}
const st = computed(() => ST[props.status])
</script>

<template>
  <div class="border border-(--bd) rounded-[6px] bg-(--surface) px-3 py-[9px] flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-square-terminal" class="size-[15px] text-(--muted)" />
      <span class="font-mono text-[12.5px]">{{ cmd }}</span>
      <span class="flex-1" />
      <UBadge :label="st[0]" class="h-5 px-[7px] rounded-[5px] text-[11px] font-semibold ring-0" :style="{ color: st[1], background: st[2] }" />
    </div>
    <div v-if="out && out.length" class="font-mono text-[11.5px] leading-[1.6] text-(--muted) whitespace-pre overflow-x-auto">{{ out.join('\n') }}</div>
  </div>
</template>

<script setup lang="ts">
import type { Row } from '~/composables/useLauncher'

defineProps<{ row: Row, selected: boolean }>()
defineEmits<{ hover: [], run: [] }>()
</script>

<template>
  <div
    :data-sel="String(selected)"
    class="h-11 flex items-center gap-3 px-2.5 rounded-[6px] cursor-default"
    :class="selected ? 'bg-(--sel)' : 'bg-transparent'"
    @click="$emit('run')"
    @mousemove="$emit('hover')"
  >
    <Tile :icon="row.icon" :tile="row.tile" />
    <div class="flex-1 min-w-0 flex items-baseline gap-2 whitespace-nowrap overflow-hidden">
      <span class="text-[14px] font-medium overflow-hidden text-ellipsis flex-none max-w-[70%]"><LauncherHlText :text="row.title" :q="row.hl" /></span>
      <span v-if="row.alias" class="flex-none self-center h-[18px] inline-flex items-center px-1.5 rounded-[5px] border border-(--bd) text-[11px] text-(--muted) font-mono">{{ row.alias }}</span>
      <span class="text-[13px] text-(--muted) overflow-hidden text-ellipsis min-w-0"><LauncherHlText :text="row.sub || ''" :q="row.hl" /></span>
    </div>
    <Keys v-if="row.keys && row.keys.length" :keys="row.keys" />
    <span v-else-if="row.label" class="flex-none text-[12px] text-(--muted)">{{ row.label }}</span>
  </div>
</template>

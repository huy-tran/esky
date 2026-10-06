<script setup lang="ts">
import { SEL } from '~/data/fixtures'

const L = useLauncher()
const s = L.s

const cmd = computed(() => L.aiCmd())
const stream = computed(() => s.stream && s.stream.target === 'ai' ? s.stream : null)
const text = computed(() => stream.value ? stream.value.text : (s.ai?.result ?? ''))
const streaming = computed(() => !!(stream.value && !stream.value.done))
const error = computed(() => s.ai?.error ?? '')
const origOpen = computed({
  get: () => !!s.ai?.origOpen,
  set: () => L.toggleOrig()
})
const sel = computed(() => s.selection || SEL)
</script>

<template>
  <div class="h-full overflow-y-auto pt-3 px-4 pb-4 box-border flex flex-col gap-3.5">
    <UCollapsible v-model:open="origOpen" class="flex-none border border-(--bd) rounded-[6px] bg-(--surface) cursor-default">
      <div class="h-9 flex items-center gap-2 px-2.5">
        <UIcon :name="origOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-3.5 text-(--muted)" />
        <span class="text-[12px] font-semibold text-(--muted) flex-none">Original · {{ sel.app }}</span>
        <span class="flex-1 min-w-0 text-[12.5px] text-(--muted) whitespace-nowrap overflow-hidden text-ellipsis">{{ origOpen ? '' : sel.text }}</span>
        <Keys :keys="['Ctrl', 'O']" size="sm" />
      </div>
      <template #content>
        <div class="pr-3 pb-3 pl-8 text-[13.5px] leading-[1.55] text-(--muted)">{{ sel.text }}</div>
      </template>
    </UCollapsible>
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <UIcon :name="cmd.icon" class="size-[15px] text-(--accent-fg)" />
        <span class="text-[13px] font-semibold">{{ cmd.title }}</span>
        <UBadge label="Claude" class="h-5 px-[7px] rounded-[5px] bg-(--accent-soft) text-(--accent-fg) text-[11px] font-semibold ring-0" />
        <span class="flex-1" />
        <span class="text-[12px]" :class="error ? 'text-(--err)' : 'text-(--muted)'">{{ error ? 'Failed' : streaming ? 'Writing…' : 'Done' }}</span>
      </div>
      <div v-if="error" class="flex gap-2 items-start px-3 py-2.5 rounded-[6px] bg-(--err-soft) text-(--err) text-[13px] leading-normal">
        <UIcon name="i-lucide-circle-x" class="size-4 mt-px flex-none" />{{ error }}
      </div>
      <div v-else class="text-[15px] leading-[1.6] whitespace-pre-wrap text-pretty">{{ text }}</div>
      <LauncherStreamShimmer v-if="streaming" />
    </div>
  </div>
</template>

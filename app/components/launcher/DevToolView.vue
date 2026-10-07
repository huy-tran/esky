<script setup lang="ts">
import { DEV_TOOLS, devTool } from '~/utils/devtools'

const L = useLauncher()
const s = L.s
const dev = L.dev
const tool = computed(() => devTool(s.devTool))
const items = DEV_TOOLS.map(t => ({ value: t.id, label: t.title, icon: t.icon }))

onBeforeUnmount(() => {
  L.els.dev = null
})

const selectUi = { base: 'h-8 rounded-[6px] border border-(--bd) bg-(--input-bg) text-(--fg) text-[13px] ps-8 pr-8', leading: 'ps-2.5', leadingIcon: 'size-3.5 text-(--muted)', trailingIcon: 'size-3.5 text-(--muted)', content: 'bg-(--pop-bg) ring-(--win-bd) min-w-[220px]', item: 'text-[13px]', input: 'text-[13px]' }
const pane = 'flex-1 min-w-0 flex flex-col rounded-[8px] border border-(--bd) overflow-hidden'
const paneHead = 'h-8 flex-none flex items-center gap-2 px-3 border-b border-(--bd) text-[11.5px] font-semibold tracking-[.04em] uppercase text-(--faint)'
const paneFoot = 'h-8 flex-none flex items-center gap-2 px-3 text-[12px] text-(--muted)'
</script>

<template>
  <div class="h-full pt-3 px-4 pb-4 box-border flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <USelectMenu
        v-model="s.devTool"
        :items="items"
        value-key="value"
        variant="none"
        :icon="tool.icon"
        trailing-icon="i-lucide-chevron-down"
        :search-input="{ placeholder: 'Search tools…' }"
        class="w-[230px]"
        :ui="selectUi"
      />
      <span class="flex-1" />
      <span class="text-[12px] text-(--muted)">Runs on this PC</span>
    </div>

    <div class="flex-1 min-h-0 flex gap-3">
      <div v-if="tool.input" :class="[pane, 'bg-(--input-bg) focus-within:border-(--accent)']">
        <div :class="paneHead">Input</div>
        <UTextarea
          :ref="(c: any) => { L.els.dev = c?.textareaRef ?? null }"
          v-model="s.devInput"
          :placeholder="tool.input"
          variant="none"
          autofocus
          class="flex-1 min-h-0 w-full"
          :ui="{ root: 'h-full', base: 'h-full px-3 py-2.5 resize-none bg-transparent font-mono text-[12.5px] leading-[1.6] text-(--fg) placeholder:text-(--faint) placeholder:font-sans scroll-thin' }"
        />
        <div :class="paneFoot">
          <span>{{ s.devInput.length.toLocaleString() }} characters</span>
          <span class="flex-1" />
          <span class="flex items-center gap-1">New line <Keys :keys="['Shift', '↵']" size="sm" /></span>
        </div>
      </div>

      <div :class="[pane, 'bg-(--surface)']">
        <div :class="paneHead">{{ tool.title }}</div>
        <div class="flex-1 min-h-0 overflow-auto px-3 py-2.5 scroll-thin">
          <div v-if="dev.error" class="text-[13px] text-(--err) leading-normal">{{ dev.error }}</div>
          <pre v-else-if="dev.out" class="m-0 font-mono text-[12.5px] leading-[1.6] whitespace-pre-wrap break-all select-text">{{ dev.out }}</pre>
          <div v-else class="text-[13px] text-(--faint)">The result shows here as you type.</div>
        </div>
        <div :class="paneFoot">
          <UButton
            v-if="dev.out"
            icon="i-lucide-copy"
            label="Copy"
            color="neutral"
            variant="ghost"
            class="h-6 px-1.5 -ml-1.5 gap-1 text-[12px] text-(--muted) hover:text-(--fg)"
            :ui="{ leadingIcon: 'size-3.5' }"
            @click="L.runAction('vcopy')"
          />
          <UButton
            v-if="!tool.input"
            icon="i-lucide-refresh-cw"
            label="New"
            color="neutral"
            variant="ghost"
            class="h-6 px-1.5 gap-1 text-[12px] text-(--muted) hover:text-(--fg)"
            :ui="{ leadingIcon: 'size-3.5' }"
            @click="L.runAction('vrun')"
          />
          <span class="flex-1" />
          <span v-if="dev.out" class="flex items-center gap-1">{{ s.target ? `Paste into ${s.target.app}` : 'Copy and close' }} <Keys :keys="['↵']" size="sm" /></span>
        </div>
      </div>
    </div>
  </div>
</template>

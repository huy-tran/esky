<script setup lang="ts">
import { CLIP_ICON, CLIP_LABEL, type ClipItem } from '~/data/fixtures'

const L = useLauncher()
const s = L.s
const box = ref<HTMLElement | null>(null)

const model = computed(() => L.clipModel.value)
const sel = computed(() => Math.min(s.clipSel, Math.max(0, model.value.flat.length - 1)))
const cur = computed(() => model.value.flat[sel.value])
const starts = computed(() => {
  let i = 0
  return model.value.groups.map((g) => {
    const at = i
    i += g.rows.length
    return at
  })
})

const paste = (idx: number) => {
  s.clipSel = idx
  L.runAction('cpaste')
}

const mono = (c: ClipItem) => c.mono ? 'font-mono' : ''

useKeepVisible(box, () => [s.clipSel, s.clipQuery])
</script>

<template>
  <div v-if="L.clip.value.length" class="flex h-full">
    <div ref="box" class="relative w-[40%] flex-none overflow-y-auto pt-1 pr-1.5 pb-2 pl-2 box-border border-r border-(--bd) scroll-thin">
      <template v-for="(g, gi) in model.groups" :key="g.title">
        <LauncherSectionLabel>{{ g.title }}</LauncherSectionLabel>
        <div
          v-for="(c, ci) in g.rows"
          :key="c.id"
          :data-sel="String(starts[gi]! + ci === sel)"
          class="h-11 flex items-center gap-2.5 px-2 rounded-[6px] cursor-default"
          :class="starts[gi]! + ci === sel ? 'bg-(--sel)' : 'bg-transparent'"
          @click="s.clipSel = starts[gi]! + ci"
          @dblclick="paste(starts[gi]! + ci)"
        >
          <div
            class="size-8 flex-none rounded-[6px] box-border text-(--fg) grid place-items-center"
            :style="{ background: c.type === 'color' ? c.preview : 'var(--tile)', border: c.type === 'color' ? '1px solid var(--bd)' : 'none' }"
          >
            <UIcon :name="CLIP_ICON[c.type]" class="size-[15px]" :class="c.type === 'color' ? 'opacity-0' : ''" />
          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis" :class="mono(c)">{{ c.preview }}</span>
            <span class="text-[11.5px] text-(--muted)">{{ c.time }} · {{ c.app }}</span>
          </div>
          <div :title="c.app" class="size-[18px] flex-none rounded-[5px] text-white grid place-items-center" :style="{ background: c.appTile }">
            <UIcon :name="c.appIcon" class="size-2.5" />
          </div>
        </div>
      </template>
      <div v-if="!model.flat.length" class="py-10 px-3 text-center text-[13px] text-(--muted)">No matches</div>
    </div>
    <div class="flex-1 min-w-0 flex flex-col">
      <template v-if="cur">
        <div class="flex-1 min-h-0 overflow-auto p-4">
          <div
            v-if="cur.type === 'text'"
            class="text-[13.5px] leading-[1.6] whitespace-pre-wrap wrap-break-word rounded-[6px]"
            :class="cur.mono ? 'font-mono bg-(--code-bg) px-3 py-2.5' : ''"
          >{{ cur.full || cur.preview }}</div>
          <div v-else-if="cur.type === 'link'" class="flex flex-col gap-2.5">
            <div class="flex items-center gap-2.5">
              <Tile icon="i-lucide-globe" :icon-size="16" />
              <div class="text-[14px] font-semibold">{{ cur.host }}</div>
            </div>
            <div class="text-[13px] text-(--accent-fg) break-all leading-normal">{{ cur.preview }}</div>
            <div class="flex items-center gap-1.5 text-[12px] text-(--muted)">Open in browser <Keys :keys="['Ctrl', 'O']" size="sm" /></div>
          </div>
          <template v-else-if="cur.type === 'image'">
            <div class="aspect-video rounded-[6px] border border-(--bd) bg-[repeating-linear-gradient(135deg,var(--surface)_0_8px,transparent_8px_16px)] grid place-items-center">
              <span class="font-mono text-[11.5px] text-(--muted)">screenshot · 1280×720</span>
            </div>
            <div class="text-[13px] font-medium mt-2.5">{{ cur.preview }}</div>
          </template>
          <template v-else-if="cur.type === 'color'">
            <div class="h-[120px] rounded-[8px] border border-(--bd)" :style="{ background: cur.preview }" />
            <div class="grid grid-cols-[56px_1fr] gap-x-3 gap-y-2 mt-3.5 text-[13px]">
              <span class="text-(--muted)">HEX</span><span class="font-mono">{{ cur.preview }}</span>
              <span class="text-(--muted)">RGB</span><span class="font-mono">{{ cur.rgb }}</span>
              <span class="text-(--muted)">HSL</span><span class="font-mono">{{ cur.hsl }}</span>
            </div>
          </template>
          <div v-else-if="cur.type === 'file'" class="flex items-center gap-3">
            <Tile icon="i-lucide-file-spreadsheet" tile="#15803D" :size="48" :icon-size="22" :radius="8" />
            <div class="min-w-0">
              <div class="text-[14px] font-semibold">{{ cur.preview }}</div>
              <div class="text-[12.5px] text-(--muted) mt-[3px] font-mono">{{ cur.path }}</div>
            </div>
          </div>
        </div>
        <dl class="flex-none border-t border-(--bd) pt-2.5 px-4 pb-3 grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-[12.5px] m-0">
          <dt class="text-(--muted)">Source</dt>
          <dd class="m-0 flex items-center gap-1.5">
            <span class="size-4 rounded-[4px] text-white grid place-items-center" :style="{ background: cur.appTile }"><UIcon :name="cur.appIcon" class="size-[9px]" /></span>{{ cur.app }}
          </dd>
          <dt class="text-(--muted)">Copied at</dt><dd class="m-0">{{ cur.copiedAt }}</dd>
          <dt class="text-(--muted)">Type</dt><dd class="m-0">{{ CLIP_LABEL[cur.type] }}</dd>
          <dt class="text-(--muted)">Size</dt><dd class="m-0">{{ cur.size }}</dd>
        </dl>
      </template>
    </div>
  </div>
  <UEmpty
    v-else
    title="Nothing copied yet"
    description="Copy text, links, images, colours or files and they'll show up here."
    variant="naked"
    class="h-full justify-center gap-2.5 p-0 sm:p-0 lg:p-0 px-10 sm:px-10 lg:px-10"
    :ui="{ header: 'gap-2.5 max-w-none', title: 'text-[15px] font-semibold text-(--fg)', description: 'text-[13px] text-(--muted) max-w-[320px] leading-normal text-wrap', body: 'mt-1' }"
  >
    <template #leading>
      <div class="size-12 rounded-[8px] bg-(--tile) grid place-items-center text-(--muted)">
        <UIcon name="i-lucide-clipboard" class="size-[22px]" />
      </div>
    </template>
    <template #actions>
      <div class="flex items-center gap-1.5 text-[12px] text-(--muted)">
        Try <Keys :keys="['Ctrl', 'C']" /> in any app
      </div>
    </template>
  </UEmpty>
</template>

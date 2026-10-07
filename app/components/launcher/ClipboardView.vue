<script setup lang="ts">
import { CLIP_ICON, CLIP_LABEL, clipPreview, clipSize, type ClipEntry } from '~/composables/useClipboard'

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

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const copiedAt = (at: number) => new Date(at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const mono = (c: ClipEntry) => c.kind === 'text' && /[{};=<>]|^\s{2,}|^\$ |^(git|npm|php|cd|ssh) /m.test(c.text ?? '') ? 'font-mono' : ''
const host = (url: string) => {
  try {
    return new URL(url.trim()).host
  } catch {
    return url
  }
}
const fileName = (p: string) => p.split(/[\\/]/).pop()

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
          <img v-if="c.kind === 'image' && c.thumb" :src="c.thumb" alt="" class="size-8 flex-none rounded-[6px] object-cover border border-(--bd)">
          <div
            v-else
            class="size-8 flex-none rounded-[6px] box-border text-(--fg) grid place-items-center"
            :style="{ background: c.kind === 'color' ? c.text : 'var(--tile)', border: c.kind === 'color' ? '1px solid var(--bd)' : 'none' }"
          >
            <UIcon :name="CLIP_ICON[c.kind]" class="size-[15px]" :class="c.kind === 'color' ? 'opacity-0' : ''" />
          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis" :class="mono(c)">{{ clipPreview(c) }}</span>
            <span class="text-[11.5px] text-(--muted) whitespace-nowrap overflow-hidden text-ellipsis">{{ time(c.at) }} · {{ c.app }}</span>
          </div>
          <UIcon v-if="c.pinned" name="i-lucide-pin" class="size-3 flex-none text-(--muted)" />
        </div>
      </template>
      <div v-if="!model.flat.length" class="py-10 px-3 text-center text-[13px] text-(--muted)">No matches</div>
    </div>
    <div class="flex-1 min-w-0 flex flex-col">
      <template v-if="cur">
        <div class="flex-1 min-h-0 overflow-auto p-4">
          <div
            v-if="cur.kind === 'text'"
            class="text-[13.5px] leading-[1.6] whitespace-pre-wrap wrap-break-word rounded-[6px]"
            :class="mono(cur) ? 'font-mono bg-(--code-bg) px-3 py-2.5' : ''"
          >{{ cur.text }}</div>
          <div v-else-if="cur.kind === 'link'" class="flex flex-col gap-2.5">
            <div class="flex items-center gap-2.5">
              <Tile icon="i-lucide-globe" :icon-size="16" />
              <div class="text-[14px] font-semibold">{{ host(cur.text!) }}</div>
            </div>
            <div class="text-[13px] text-(--accent-fg) break-all leading-normal">{{ cur.text }}</div>
            <div class="flex items-center gap-1.5 text-[12px] text-(--muted)">Open in browser <Keys :keys="['Ctrl', 'O']" size="sm" /></div>
          </div>
          <img v-else-if="cur.kind === 'image' && cur.thumb" :src="cur.thumb" alt="Copied image" class="max-w-full max-h-[260px] rounded-[6px] border border-(--bd) bg-[repeating-conic-gradient(var(--tile)_0_25%,transparent_0_50%)] bg-size-[16px_16px]">
          <template v-else-if="cur.kind === 'color'">
            <div class="h-[120px] rounded-[8px] border border-(--bd)" :style="{ background: cur.text }" />
            <div class="mt-3.5 font-mono text-[14px]">{{ cur.text }}</div>
          </template>
          <div v-else-if="cur.kind === 'files'" class="flex flex-col gap-1.5">
            <div v-for="f in cur.files" :key="f" class="flex items-center gap-2.5 min-w-0">
              <UIcon name="i-lucide-file" class="size-4 flex-none text-(--muted)" />
              <div class="min-w-0">
                <div class="text-[13px] font-medium truncate">{{ fileName(f) }}</div>
                <div class="text-[11.5px] text-(--muted) font-mono truncate">{{ f }}</div>
              </div>
            </div>
          </div>
        </div>
        <dl class="flex-none border-t border-(--bd) pt-2.5 px-4 pb-3 grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-[12.5px] m-0">
          <dt class="text-(--muted)">Source</dt><dd class="m-0">{{ cur.app }}</dd>
          <dt class="text-(--muted)">Copied at</dt><dd class="m-0">{{ copiedAt(cur.at) }}</dd>
          <dt class="text-(--muted)">Type</dt><dd class="m-0">{{ CLIP_LABEL[cur.kind] }}</dd>
          <dt class="text-(--muted)">Size</dt><dd class="m-0">{{ clipSize(cur) }}</dd>
        </dl>
      </template>
    </div>
  </div>
  <UEmpty
    v-else
    :title="L.settings.value.clipHistory ? 'Nothing copied yet' : 'Clipboard History is off'"
    :description="L.settings.value.clipHistory ? 'Copy text, links, images, colours or files and they\'ll show up here.' : 'Turn it on in Settings → Clipboard.'"
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
      <div v-if="L.settings.value.clipHistory" class="flex items-center gap-1.5 text-[12px] text-(--muted)">
        Try <Keys :keys="['Ctrl', 'C']" /> in any app
      </div>
    </template>
  </UEmpty>
</template>

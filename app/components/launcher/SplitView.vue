<script setup lang="ts">
const L = useLauncher()
const s = L.s
const box = ref<HTMLElement | null>(null)

const model = computed(() => L.splitModel.value)
const sel = computed(() => Math.min(s.splitSel, Math.max(0, model.value.flat.length - 1)))
const starts = computed(() => {
  let i = 0
  return model.value.groups.map((g) => {
    const at = i
    i += g.rows.length
    return at
  })
})
const det = computed(() => {
  const cr = model.value.flat[sel.value]
  return cr ? L.detail(cr.data) : null
})

const pick = (idx: number) => {
  s.splitSel = idx
}
const run = (idx: number) => {
  s.splitSel = idx
  nextTick(() => L.runSplit())
}

const tileFg = (tile?: string) => tile === 'var(--accent)' ? 'var(--on-accent)' : tile ? '#fff' : 'var(--fg)'

useKeepVisible(box, () => [s.splitSel, s.splitQuery, s.view])
</script>

<template>
  <div class="flex h-full">
    <div
      ref="box"
      class="relative flex-none overflow-y-auto pt-1 pr-1.5 pb-2 pl-2 box-border border-r border-(--bd) scroll-thin"
      :style="{ width: s.view === 'notes' ? '34%' : '42%' }"
    >
      <template v-for="(g, gi) in model.groups" :key="g.title">
        <LauncherSectionLabel>{{ g.title }}</LauncherSectionLabel>
        <div
          v-for="(r, ri) in g.rows"
          :key="r.key"
          :data-sel="String(starts[gi]! + ri === sel)"
          class="h-11 flex items-center gap-2.5 px-2 rounded-[6px] cursor-default"
          :class="starts[gi]! + ri === sel ? 'bg-(--sel)' : 'bg-transparent'"
          @click="pick(starts[gi]! + ri)"
          @dblclick="run(starts[gi]! + ri)"
        >
          <Tile :icon="r.icon" :tile="r.tile" :icon-size="16" />
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{{ r.title }}</span>
            <span class="text-[11.5px] text-(--muted) whitespace-nowrap overflow-hidden text-ellipsis" :class="r.mono ? 'font-mono' : ''">{{ r.sub }}</span>
          </div>
          <Keys v-if="r.keys && r.keys.length" :keys="r.keys" size="sm" />
          <span v-if="r.acc" class="flex-none text-[11.5px] font-medium" :class="r.accMono ? 'font-mono' : ''" :style="{ color: r.accColor || 'var(--muted)' }">{{ r.acc }}</span>
        </div>
      </template>
      <div v-if="!model.flat.length" class="py-10 px-3 text-center text-[13px] text-(--muted)">No matches</div>
    </div>
    <div class="flex-1 min-w-0 flex flex-col">
      <template v-if="det">
        <div class="flex-1 min-h-0 overflow-auto p-4 flex flex-col gap-3.5">
          <div v-if="det.head" class="flex items-center gap-3">
            <div class="size-10 flex-none rounded-[8px] grid place-items-center" :style="{ background: det.head.tile || 'var(--tile)', color: tileFg(det.head.tile) }">
              <UIcon :name="det.head.icon!" class="size-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[15px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{{ det.head.title }}</div>
              <div class="text-[12.5px] text-(--muted) mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{{ det.head.sub }}</div>
            </div>
            <UBadge v-if="det.head.badge" :label="det.head.badge" class="flex-none h-5 px-[7px] rounded-[5px] bg-(--accent-soft) text-(--accent-fg) text-[11px] font-semibold ring-0" />
            <UButton
              v-if="det.head.btn"
              tabindex="-1"
              color="neutral"
              variant="outline"
              class="flex-none h-[30px] gap-1.5 px-3 rounded-[6px] ring-0 border text-[12.5px] font-semibold"
              :style="{
                borderColor: det.head.btn.primary ? 'transparent' : 'var(--bd)',
                background: det.head.btn.primary ? 'var(--accent)' : 'var(--surface)',
                color: det.head.btn.primary ? 'var(--on-accent)' : det.head.btn.danger ? 'var(--err)' : 'var(--fg)'
              }"
              @click="det.head.btn.run()"
            >
              <Spinner v-if="det.head.btn.busy" />{{ det.head.btn.label }}
            </UButton>
          </div>

          <div v-if="det.screens" class="flex gap-2.5">
            <div v-for="sc in det.screens" :key="sc.name" class="flex-1 min-w-0 max-w-[300px] aspect-[16/10] rounded-[6px] border border-(--bd) bg-(--surface) relative overflow-hidden">
              <div v-if="sc.win" class="absolute p-1 box-border transition-all duration-200" :style="{ left: sc.win.l, top: sc.win.t, width: sc.win.w, height: sc.win.h }">
                <div class="size-full box-border rounded-[5px] bg-(--accent-soft) border-[1.5px] border-(--accent) grid place-items-center text-(--accent-fg) text-[11px] font-semibold">{{ L.s.target?.app ?? 'Window' }}</div>
              </div>
              <div class="absolute inset-x-0 bottom-0 h-[10%] bg-(--tile) flex items-center px-2 text-[10.5px] text-(--muted)">{{ sc.name }}</div>
            </div>
          </div>

          <div
            v-if="det.preview"
            class="max-h-[220px] rounded-[6px] border border-(--bd) bg-[repeating-linear-gradient(135deg,var(--surface)_0_8px,transparent_8px_16px)] grid place-items-center"
            :style="{ aspectRatio: det.preview.ratio }"
          >
            <span class="font-mono text-[11.5px] text-(--muted)">{{ det.preview.label }}</span>
          </div>

          <UFormField
            v-if="det.input"
            :label="det.input.label"
            :help="det.input.hint"
            :ui="{ root: 'flex flex-col gap-1.5', label: 'text-[12.5px] font-semibold text-(--fg)', container: 'mt-0', help: 'text-[12px] text-(--muted) mt-0' }"
          >
            <UInput
              :ref="(c: any) => { L.els.arg = c?.inputRef ?? null }"
              :model-value="det.input.val"
              :placeholder="det.input.ph"
              spellcheck="false"
              autocomplete="off"
              variant="none"
              class="w-full"
              :ui="{ base: 'h-[34px] border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-3 text-[13.5px] focus-visible:outline-2 focus-visible:outline-(--accent)' }"
              @update:model-value="(v: string | number) => det!.input!.on(String(v))"
            />
          </UFormField>

          <div
            v-if="det.body"
            class="leading-[1.6] whitespace-pre-wrap wrap-break-word rounded-[6px]"
            :class="det.body.mono ? 'font-mono text-[12px] bg-(--code-bg) px-3 py-2.5 border border-(--bd)' : 'text-[14px]'"
          ><span v-for="(sg, i) in det.body.segs" :key="i" :class="sg.chip ? 'text-(--accent-fg) bg-(--accent-soft) px-1 py-px rounded-[4px]' : ''" :style="sg.c ? { color: sg.c } : undefined">{{ sg.t }}</span></div>

          <div v-if="det.desc" class="text-[13.5px] leading-[1.6] text-pretty">{{ det.desc }}</div>

          <div v-if="det.items" class="flex flex-col">
            <div class="text-[11px] font-semibold tracking-[.04em] text-(--faint) pb-1">{{ det.items.title }}</div>
            <div v-for="it in det.items.list" :key="it.t" class="h-8 flex items-center gap-2.5 text-[13px] border-b border-(--bd)">
              <UIcon :name="it.icon" class="size-3.5 text-(--muted)" />{{ it.t }}
            </div>
          </div>

          <UTextarea
            v-if="det.edit"
            :ref="(c: any) => { L.els.note = c?.textareaRef ?? null }"
            :model-value="det.edit.val"
            placeholder="Start typing…"
            variant="none"
            class="flex-1 w-full"
            :ui="{ base: 'h-full min-h-[200px] p-0 resize-none text-[14px] leading-[1.6] text-(--fg) placeholder:text-(--faint)' }"
            @update:model-value="(v: string) => det!.edit!.on(v)"
          />
        </div>
        <dl v-if="det.meta && det.meta.length" class="m-0 flex-none border-t border-(--bd) pt-2.5 px-4 pb-3 grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
          <template v-for="m in det.meta" :key="m[0]">
            <dt class="text-(--muted)">{{ m[0] }}</dt>
            <dd class="m-0 whitespace-nowrap overflow-hidden text-ellipsis" :class="m[2] ? 'font-mono' : ''">{{ m[1] }}</dd>
          </template>
        </dl>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { summary, type GitChange, type GitRepo } from '~/utils/git'

const L = useLauncher()
const s = L.s
const box = ref<HTMLElement | null>(null)

const model = computed(() => L.gitModel.value)
const status = computed(() => L.git.status.value)
const sel = computed(() => Math.min(s.gitSel, Math.max(0, model.value.flat.length - 1)))
const cur = computed(() => model.value.flat[sel.value])
const starts = computed(() => {
  let i = 0
  return model.value.groups.map((g) => {
    const at = i
    i += g.rows.length
    return at
  })
})

/** VS Code's letters and colours for each kind of change. */
const CHANGE: Record<GitChange, [string, string, string]> = {
  modified: ['M', 'var(--warn)', 'Modified'],
  added: ['A', 'var(--ok)', 'Added'],
  deleted: ['D', 'var(--err)', 'Deleted'],
  renamed: ['R', 'var(--accent-fg)', 'Renamed'],
  untracked: ['U', 'var(--ok)', 'New, not tracked yet'],
  conflict: ['!', 'var(--err)', 'Merge conflict']
}
const SHOWN = 200

const sub = (r: GitRepo) => [r.branch ?? 'detached HEAD', summary(r)].join(' · ')
const pushState = (r: GitRepo) => [r.ahead && `${r.ahead} to push`, r.behind && `${r.behind} to pull`].filter(Boolean).join(' · ') || (r.upstream ? 'Up to date' : 'No upstream')

const pick = (idx: number) => {
  s.gitSel = idx
}
const run = (idx: number) => {
  s.gitSel = idx
  L.runAction('gopen')
}

useKeepVisible(box, () => [s.gitSel, s.gitQuery])
</script>

<template>
  <div v-if="!model.checked && status === 'loading'" class="h-full flex items-center justify-center gap-2 text-[13px] text-(--muted)">
    <Spinner />Checking your repos…
  </div>
  <div v-else-if="status === 'error'" class="h-full flex flex-col items-center justify-center gap-2.5 text-center px-10">
    <Tile icon="i-lucide-git-branch" tile="#F05032" :size="48" :icon-size="22" :radius="8" />
    <div class="text-[15px] font-semibold">Couldn’t check your repos</div>
    <div class="text-[13px] text-(--muted) max-w-[380px] leading-normal">{{ L.git.error.value }}</div>
    <div class="flex items-center gap-1.5 mt-1 text-[12px] text-(--muted)">Try again <Keys :keys="['Ctrl', 'R']" /></div>
  </div>
  <div v-else-if="!model.checked" class="h-full flex flex-col items-center justify-center gap-2.5 text-center px-10">
    <Tile icon="i-lucide-folder-search" tile="#F05032" :size="48" :icon-size="22" :radius="8" />
    <div class="text-[15px] font-semibold">No repos found</div>
    <div class="text-[13px] text-(--muted) max-w-[380px] leading-normal">Esky checks the folders listed in Settings → Extensions → Git, and the folders directly inside them.</div>
    <UButton label="Choose folders" color="neutral" variant="outline" class="mt-1 h-8 rounded-[6px] text-[12.5px]" @click="openSettings({ tab: 'extensions', ext: 'git' })" />
  </div>
  <div v-else-if="!model.flat.length && !s.gitQuery" class="h-full flex flex-col items-center justify-center gap-2.5 text-center px-10">
    <Tile icon="i-lucide-circle-check" tile="#15803D" :size="48" :icon-size="22" :radius="8" />
    <div class="text-[15px] font-semibold">All clean</div>
    <div class="text-[13px] text-(--muted)">Nothing to commit or push in {{ model.checked }} repos.</div>
  </div>
  <div v-else class="flex h-full">
    <div ref="box" class="relative flex-none w-[44%] overflow-y-auto pt-1 pr-1.5 pb-2 pl-2 box-border border-r border-(--bd) scroll-thin">
      <template v-for="(g, gi) in model.groups" :key="g.title">
        <LauncherSectionLabel>{{ g.title }}</LauncherSectionLabel>
        <div
          v-for="(r, ri) in g.rows"
          :key="r.path"
          :data-sel="String(starts[gi]! + ri === sel)"
          class="h-11 flex items-center gap-2.5 px-2 rounded-[6px] cursor-default"
          :class="starts[gi]! + ri === sel ? 'bg-(--sel)' : 'bg-transparent'"
          @click="pick(starts[gi]! + ri)"
          @dblclick="run(starts[gi]! + ri)"
        >
          <Tile :icon="r.error ? 'i-lucide-triangle-alert' : 'i-lucide-git-branch'" :tile="r.error ? undefined : '#F05032'" :icon-size="16" />
          <div class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{{ r.name }}</span>
            <span class="text-[11.5px] text-(--muted) whitespace-nowrap overflow-hidden text-ellipsis">{{ sub(r) }}</span>
          </div>
          <span v-if="r.ahead" class="flex-none text-[11.5px] font-medium font-mono text-(--accent-fg)" :title="`${r.ahead} commit${r.ahead > 1 ? 's' : ''} not pushed`">↑{{ r.ahead }}</span>
        </div>
      </template>
      <div v-if="!model.flat.length" class="py-10 px-3 text-center text-[13px] text-(--muted)">No matches</div>
    </div>

    <div v-if="cur" class="flex-1 min-w-0 flex flex-col">
      <div class="flex-1 min-h-0 overflow-auto p-4 flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <Tile icon="i-lucide-git-branch" tile="#F05032" :size="40" :icon-size="20" :radius="8" />
          <div class="flex-1 min-w-0">
            <div class="text-[15px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{{ cur.name }}</div>
            <div class="text-[12.5px] text-(--muted) mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{{ summary(cur) }}</div>
          </div>
          <Spinner v-if="status === 'loading'" :size="13" />
        </div>

        <div v-if="cur.error" class="text-[12.5px] text-(--err) leading-normal font-mono whitespace-pre-wrap">{{ cur.error }}</div>
        <div v-else-if="!cur.files.length" class="text-[13px] text-(--muted) leading-normal">
          Everything is committed. {{ cur.ahead }} commit{{ cur.ahead > 1 ? 's are' : ' is' }} waiting to be pushed to <span class="font-mono text-[12px]">{{ cur.upstream }}</span>.
        </div>
        <div v-else class="flex flex-col">
          <div class="text-[11px] font-semibold tracking-[.04em] text-(--faint) pb-1">CHANGES</div>
          <div v-for="f in cur.files.slice(0, SHOWN)" :key="f.path" class="h-7 flex items-center gap-2.5 text-[12.5px] border-b border-(--bd)" :title="CHANGE[f.change][2] + (f.staged ? ' · staged' : '')">
            <span class="w-3 flex-none text-center font-mono font-semibold text-[12px]" :style="{ color: CHANGE[f.change][1] }">{{ CHANGE[f.change][0] }}</span>
            <!-- rtl puts the ellipsis at the start, so long paths keep their file name visible. -->
            <span class="flex-1 min-w-0 font-mono text-[12px] text-left whitespace-nowrap overflow-hidden text-ellipsis" dir="rtl" :title="f.path"><bdi>{{ f.path }}</bdi></span>
            <span v-if="f.staged" class="flex-none text-[11px] text-(--muted)">staged</span>
          </div>
          <div v-if="cur.files.length > SHOWN" class="pt-1.5 text-[12px] text-(--muted)">and {{ cur.files.length - SHOWN }} more</div>
        </div>
      </div>
      <dl class="m-0 flex-none border-t border-(--bd) pt-2.5 px-4 pb-3 grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
        <dt class="text-(--muted)">Branch</dt>
        <dd class="m-0 font-mono whitespace-nowrap overflow-hidden text-ellipsis">{{ cur.branch ?? 'detached HEAD' }}</dd>
        <dt class="text-(--muted)">Remote</dt>
        <dd class="m-0 whitespace-nowrap overflow-hidden text-ellipsis">{{ pushState(cur) }}</dd>
        <dt class="text-(--muted)">Where</dt>
        <dd class="m-0 font-mono whitespace-nowrap overflow-hidden text-ellipsis" :title="cur.path">{{ cur.path }}</dd>
      </dl>
    </div>
  </div>
</template>

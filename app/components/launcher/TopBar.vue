<script setup lang="ts">
import { SPLIT_PH } from '~/data/fixtures'

const L = useLauncher()
const s = L.s
const input = ref<{ inputRef?: HTMLInputElement | null } | null>(null)

watchEffect(() => {
  L.els.top = input.value?.inputRef ?? null
})

interface Top { ph: string, get: () => string, set: (q: string) => void }

const top = computed((): Top | null => {
  const v = s.view
  if (v === 'search') return { ph: s.selection ? 'Search, or pick an AI command for the selection…' : 'Search apps, commands, files…', get: () => s.query, set: (q) => { s.query = q; s.sel = 0 } }
  if (v === 'clipboard') return { ph: 'Search clipboard…', get: () => s.clipQuery, set: (q) => { s.clipQuery = q; s.clipSel = 0 } }
  if (v === 'forgeList') return { ph: 'Search servers…', get: () => s.forgeQuery, set: (q) => { s.forgeQuery = q; s.forgeSel = 0 } }
  if (v === 'herdList') return { ph: 'Search Herd sites…', get: () => s.herdQuery, set: (q) => { s.herdQuery = q; s.herdSel = 0 } }
  if (v === 'gitList') return { ph: 'Search repos or branches…', get: () => s.gitQuery, set: (q) => { s.gitQuery = q; s.gitSel = 0 } }
  if (v === 'remoteList') return { ph: L.remote.source.value?.placeholder ?? 'Search…', get: () => s.remoteQuery, set: (q) => { s.remoteQuery = q; s.remoteSel = 0 } }
  if (v === 'dockerList') return { ph: `Search ${({ containers: 'containers', compose: 'Compose projects', images: 'images' } as const)[L.docker.kind.value]}…`, get: () => s.dockerQuery, set: (q) => { s.dockerQuery = q; s.dockerSel = 0 } }
  if (v === 'dictionary') return { ph: 'Type a word to define…', get: () => s.dictWord, set: (q) => { s.dictWord = q } }
  if (v === 'aiResult' && !s.ai?.needsInput) return { ph: 'Ask a follow-up, then Tab to continue in chat…', get: () => s.followUp, set: (q) => { s.followUp = q } }
  if (SPLIT_PH[v]) return { ph: SPLIT_PH[v]!, get: () => s.splitQuery, set: (q) => { s.splitQuery = q; s.splitSel = 0 } }
  return null
})

const value = computed({
  get: () => top.value?.get() ?? '',
  set: (q: string) => top.value?.set(q)
})

const title = computed(() => s.view === 'forgeDetail' ? s.server?.name ?? '' : s.view === 'deploy' ? 'Deploy Site' : s.view === 'password' ? 'Generate Password' : s.view === 'translate' ? 'Google Translate' : s.view === 'devtool' ? 'Developer Tools' : s.view === 'aiResult' ? L.aiCmd().title : '')

const chip = computed(() => {
  const fc = L.forgeModel.value.flat.length
  const map: Record<string, { icon: string, text: string }> = {
    search: s.selection ? { icon: 'i-lucide-text-cursor-input', text: `Selected text · ${s.selection.app}` } : { icon: 'i-lucide-layout-grid', text: 'All' },
    clipboard: { icon: 'i-lucide-clipboard-list', text: `${L.clip.value.length} items` },
    forgeList: { icon: 'i-lucide-hammer', text: `Laravel Forge · ${fc}` },
    forgeDetail: { icon: 'i-lucide-hammer', text: 'Laravel Forge' },
    deploy: { icon: 'i-lucide-hammer', text: 'Laravel Forge' },
    aiResult: { icon: 'i-lucide-sparkles', text: 'Quick AI' },
    snippets: { icon: 'i-lucide-text-quote', text: L.settings.value.textExpansion ? 'Expansion on' : 'Expansion off' },
    quicklinks: { icon: 'i-lucide-link', text: `${L.qls.list.value.length} quicklinks` },
    windows: { icon: 'i-lucide-app-window', text: s.target?.app ?? 'No window' },
    files: { icon: 'i-lucide-hard-drive', text: L.files.status.value === 'indexing' ? 'Indexing…' : `${L.files.indexed.value.toLocaleString()} files` },
    store: { icon: 'i-lucide-store', text: `${L.installed.value.length} installed` },
    colors: { icon: 'i-lucide-pipette', text: 'Colour Picker' },
    notes: { icon: 'i-lucide-sticky-note', text: `${L.notes.value.length} notes` },
    emoji: { icon: 'i-lucide-smile', text: 'Emoji & Symbols' },
    herdList: { icon: 'i-lucide-feather', text: `Laravel Herd · ${L.herd.sites.value.length}` },
    gitList: { icon: 'i-lucide-git-branch', text: L.git.status.value === 'loading' ? 'Checking…' : `${L.gitModel.value.flat.length} of ${L.gitModel.value.checked} repos` },
    password: { icon: 'i-lucide-shield-check', text: 'Generated on this PC' },
    remoteList: { icon: L.remote.source.value?.icon ?? 'i-lucide-link', text: L.remote.status.value === 'loading' ? 'Loading…' : `${L.remote.source.value?.title ?? ''} · ${L.remoteModel.value.length}` },
    dockerList: { icon: 'i-lucide-container', text: L.docker.status.value === 'loading' ? 'Loading…' : `Docker · ${L.dockerModel.value.length}` },
    dictionary: { icon: 'i-lucide-book-a', text: 'English · Wiktionary' },
    translate: { icon: 'i-lucide-languages', text: `${langName(L.trLangs.value[0])} ↔ ${langName(L.trLangs.value[1])}` },
    devtool: { icon: 'i-lucide-wrench', text: 'Developer Tools' }
  }
  return map[s.view]!
})
</script>

<template>
  <div class="h-14 flex-none flex items-center gap-3 pr-3.5 pl-4 border-b border-(--bd)">
    <UButton
      v-if="s.view !== 'search'"
      tabindex="-1"
      title="Back (Esc)"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="size-7 flex-none p-0 justify-center rounded-[6px] bg-(--tile) hover:bg-(--tile) text-(--fg)"
      :ui="{ leadingIcon: 'size-[15px]' }"
      @click="L.back()"
    />
    <UIcon v-else name="i-lucide-search" class="size-[18px] text-(--muted) flex-none" />
    <UInput
      v-if="top"
      ref="input"
      v-model="value"
      :placeholder="top.ph"
      spellcheck="false"
      autocomplete="off"
      variant="none"
      size="xl"
      class="flex-1 min-w-0 h-full"
      :ui="{ root: 'h-full', base: 'h-full py-0 px-0.5 text-[18px] font-normal text-(--fg) placeholder:text-(--faint)' }"
    />
    <div v-else class="flex-1 min-w-0 text-[18px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{{ title }}</div>
    <UBadge
      :icon="chip.icon"
      :label="chip.text"
      color="neutral"
      variant="soft"
      class="flex-none h-6 gap-1.5 px-[9px] rounded-full bg-(--tile) text-(--muted) text-[12px] font-medium ring-0"
      :ui="{ leadingIcon: 'size-[13px]' }"
    />
  </div>
</template>

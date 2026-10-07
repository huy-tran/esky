<script setup lang="ts">
// Settings window (900 × 620, native title bar).
import type { TableColumn } from '@nuxt/ui'
import type { SettingsState } from '~/composables/useSettings'
import { ACCENT_IDS, accentLabel, accentVars } from '~/utils/accents'
import { EXTENSIONS, extById, type ExtensionDef } from '~/extensions/registry'
import type { ClaudeStatus } from '~/utils/claude'

const { settings } = useSettings()
const S = settings
const colorMode = useColorMode()

const TABS = [
  { value: 'general', label: 'General', icon: 'i-lucide-settings' },
  { value: 'shortcuts', label: 'Shortcuts', icon: 'i-lucide-keyboard' },
  { value: 'extensions', label: 'Extensions', icon: 'i-lucide-puzzle' },
  { value: 'clipboard', label: 'Clipboard', icon: 'i-lucide-clipboard-list' },
  { value: 'ai', label: 'AI', icon: 'i-lucide-sparkles' },
  { value: 'appearance', label: 'Appearance', icon: 'i-lucide-palette' },
  { value: 'about', label: 'About', icon: 'i-lucide-info' }
]
/** Browser build: draw the 900 × 620 window frame (the desktop app has a real one). */
const framed = !isTauri()

const tab = ref('general')
const tabTitle = computed(() => TABS.find(t => t.value === tab.value)!.label)

const generalSwitches: [keyof SettingsState, string, string][] = [
  ['startLogin', 'Start at login', 'Esky runs quietly in the tray after you sign in to Windows.'],
  ['activeMonitor', 'Show on active monitor', 'Opens on the screen with your mouse cursor instead of the primary display.'],
  ['closeBlur', 'Close when focus is lost', 'Hides the window when you click outside it.']
]

watch(() => S.value.startLogin, on => setAutostart(on))

// Extensions: installed ones (built-ins included); install more from the Store in the launcher.
const exts = useExtensions()
const extRows = computed(() => EXTENSIONS.filter(x => exts.isInstalled(x.id)))
const cfg = ref('forge')
const cfgExt = computed(() => extById(cfg.value) && exts.isInstalled(cfg.value) ? extById(cfg.value)! : extRows.value[0]!)
const extColumns: TableColumn<ExtensionDef>[] = [
  { accessorKey: 'name', header: 'EXTENSION' },
  { id: 'cmds', header: 'COMMANDS', meta: { class: { th: 'w-[80px]', td: 'w-[80px]' } } },
  { id: 'on', header: 'ON', meta: { class: { th: 'w-[56px]', td: 'w-[56px]' } } }]

/** Open on a tab (and extension) when asked: from the URL, or from the launcher in the desktop app. */
const route = useRoute()
function openTarget(t: { tab?: unknown, ext?: unknown }) {
  if (typeof t.tab === 'string' && TABS.some(x => x.value === t.tab)) tab.value = t.tab
  if (typeof t.ext === 'string' && extById(t.ext)) {
    tab.value = 'extensions'
    cfg.value = t.ext
  }
}
watch(() => route.query, q => openTarget(q), { immediate: true })
let unlistenOpen: (() => void) | undefined
onMounted(async () => {
  if (!isTauri()) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  unlistenOpen = await getCurrentWindow().listen<{ tab?: string, ext?: string }>('settings:open', e => openTarget(e.payload))
})
onBeforeUnmount(() => unlistenOpen?.())

// Clipboard
const histOpts = [{ value: '100', label: '100 items' }, { value: '500', label: '500 items' }, { value: '1000', label: '1,000 items' }, { value: '0', label: 'Unlimited' }]
const newApp = ref('')
function addApp() {
  const n = newApp.value.trim()
  if (!n) return
  S.value.ignored = [...S.value.ignored, { name: n, icon: 'i-lucide-app-window', tile: '#52525B' }]
  newApp.value = ''
}

// AI
const backends = [
  { value: 'cc', label: 'Claude Code (your subscription)', description: 'Uses the Claude Code CLI signed in on this PC. No API billing.' },
  { value: 'api', label: 'Anthropic API key', description: 'Pay per token with a key from console.anthropic.com.' }
]
const permOpts = [{ value: 'ask', label: 'Ask before every tool' }, { value: 'edits', label: 'Allow edits, ask for commands' }, { value: 'plan', label: 'Plan only (read-only)' }]
// Claude Code connection and plan usage (AI tab).
const claude = useClaude()
const status = ref<ClaudeStatus | null>(null)
const checking = ref(false)
const checkedAt = ref(0)
async function checkConn() {
  checking.value = true
  status.value = await claude.status()
  checkedAt.value = Date.now()
  checking.value = false
}
onMounted(checkConn)

const PLANS: Record<string, string> = { pro: 'Pro plan', max: 'Max plan', team: 'Team plan', enterprise: 'Enterprise plan' }
const conn = computed(() => {
  const st = status.value
  if (!st) return { tone: 'var(--faint)', title: 'Checking Claude Code…', sub: '' }
  if (!st.installed) return { tone: 'var(--err)', title: 'Claude Code not found', sub: 'Install it with npm install -g @anthropic-ai/claude-code, then check again.' }
  if (!st.loggedIn) return { tone: 'var(--warn)', title: 'Claude Code isn’t signed in', sub: `Claude Code ${st.version} · run “claude login” in a terminal, then check again.` }
  const plan = PLANS[st.subscriptionType ?? ''] ?? 'Claude subscription'
  return { tone: 'var(--ok)', title: `Connected as ${st.email}`, sub: [`Claude Code ${st.version}`, plan, st.orgName].filter(Boolean).join(' · ') }
})

// Plan usage comes from Claude Code's replies; Refresh asks Claude for a one-word answer to get fresh numbers.
const now = ref(Date.now())
const clock = setInterval(() => { now.value = Date.now() }, 30000)
onBeforeUnmount(() => clearInterval(clock))
const refreshing = ref(false)
const refreshError = ref('')
async function refreshUsage() {
  refreshing.value = true
  refreshError.value = ''
  const before = claude.usage.value?.at
  await claude.refreshUsage()
  if (claude.usage.value?.at === before) refreshError.value = 'Claude Code didn’t return usage. Try again in a moment.'
  refreshing.value = false
  now.value = Date.now()
}

const ago = (t: number) => {
  const m = Math.round((now.value - t) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}
const resets = (sec: number) => {
  const d = new Date(sec * 1000)
  const sameDay = d.toDateString() === new Date(now.value).toDateString()
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  return sameDay ? `Resets ${time}` : `Resets ${d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`
}
const usageRows = computed(() => {
  const u = claude.usage.value
  if (!u) return []
  return ([['5-hour session', u.fiveHour], ['This week', u.sevenDay]] as const)
    .filter(([, w]) => w)
    .map(([label, w]) => {
      const pct = Math.round(w!.utilization * 100)
      return { label, pct, resets: resets(w!.resetsAt), color: pct >= 90 ? 'var(--err)' : pct >= 70 ? 'var(--warn)' : 'var(--accent)' }
    })
})
const newTool = ref('')
function addTool() {
  const n = newTool.value.trim()
  if (!n) return
  S.value.tools = [...S.value.tools, n]
  newTool.value = ''
}
const toolIcon = (p: string) => p.startsWith('Bash') ? 'i-lucide-square-terminal' : p.startsWith('Web') ? 'i-lucide-globe' : 'i-lucide-file-search'

// Appearance
const themeItems = [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]
const theme = computed({
  get: () => colorMode.preference,
  set: (v: string) => { colorMode.preference = v }
})

// ←/→ move between accent swatches, like a native radio group.
function onAccentKey(e: KeyboardEvent) {
  const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!d) return
  e.preventDefault()
  const group = e.currentTarget as HTMLElement
  const i = ACCENT_IDS.indexOf(S.value.accent)
  S.value.accent = ACCENT_IDS[(i + d + ACCENT_IDS.length) % ACCENT_IDS.length]!
  nextTick(() => group.querySelector<HTMLElement>('[aria-checked=true]')?.focus())
}

// About
const sys = useSystemInfo()
const upd = ref(0)
function checkUpdates() {
  upd.value = 1
  setTimeout(() => { upd.value = 2 }, 1000)
}

// Ctrl 1-6 jump between sections, Esc closes the window.
function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key) && TABS[+e.key - 1]) {
    e.preventDefault()
    tab.value = TABS[+e.key - 1]!.value
    nextTick(() => document.querySelector<HTMLElement>('[role=tab][data-state=active]')?.focus())
  } else if (e.key === 'Escape' && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement as HTMLElement | null)?.tagName ?? '')) {
    closeSettings()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

useHead({ title: 'Esky Settings' })

// Shared skins
const card = 'flex flex-col border border-(--bd) rounded-[8px] bg-(--surface)'
const row = 'px-4 py-3.5 flex items-center gap-4'
const field = 'h-8 border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) text-[12.5px] focus-visible:outline-2 focus-visible:outline-(--accent)'
const ghostBtn = 'h-8 px-3 gap-1.5 rounded-[6px] ring-0 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) text-[12.5px] font-normal'
const switchLg = {
  base: 'w-[38px] border-[3px] data-[state=unchecked]:bg-(--tile) data-[state=checked]:bg-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)',
  container: 'h-[22px]',
  thumb: 'size-4 bg-white shadow-none data-[state=checked]:translate-x-4'
}
const switchSm = {
  base: 'w-[34px] border-[3px] data-[state=unchecked]:bg-(--tile) data-[state=checked]:bg-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)',
  container: 'h-5',
  thumb: 'size-3.5 bg-white shadow-none data-[state=checked]:translate-x-3.5'
}
const selectUi = { trailingIcon: 'size-3.5 text-(--muted)', content: 'bg-(--pop-bg) ring-(--bd)', item: 'text-[12.5px]' }
</script>

<template>
  <!--
    Desktop: the native window is exactly 900 × 620, so the page fills it.
    Browser: preview that window at its real size, with a stand-in for the Windows title bar.
  -->
  <div :class="framed ? 'min-h-screen grid place-items-center p-6' : 'h-screen'">
    <div
      :class="framed ? 'w-[900px] flex flex-col rounded-[8px] border border-(--win-bd) shadow-(--shadow) overflow-hidden' : 'h-full flex flex-col'"
    >
      <div v-if="framed" class="h-8 flex-none flex items-center gap-2 pl-3 bg-(--side) border-b border-(--bd) select-none text-(--fg)">
        <EskyIcon :size="16" />
        <span class="text-[12px]">Esky Settings</span>
        <span class="flex-1" />
        <button title="Minimise" class="w-[46px] h-8 grid place-items-center hover:bg-(--hover)" @click="closeSettings()">
          <UIcon name="i-lucide-minus" class="size-3.5" />
        </button>
        <span class="w-[46px] h-8 grid place-items-center text-(--muted)"><UIcon name="i-lucide-square" class="size-3" /></span>
        <button title="Close" class="w-[46px] h-8 grid place-items-center hover:bg-[#C42B1C] hover:text-white" @click="closeSettings()">
          <UIcon name="i-lucide-x" class="size-[15px]" />
        </button>
      </div>
      <div class="settings flex bg-(--win) text-(--fg) text-[13.5px]" :class="framed ? 'h-[620px]' : 'flex-1 min-h-0'">
        <UTabs
          v-model="tab"
          :items="TABS"
          orientation="vertical"
          variant="link"
          :content="false"
          class="w-[216px] flex-none bg-(--side) border-r border-(--bd) items-stretch"
          :ui="{
            root: 'flex-col gap-0',
            list: 'flex-1 w-full flex-col gap-0.5 px-2 py-2.5 border-0',
            indicator: 'hidden',
            trigger: 'h-[34px] w-full flex items-center gap-2.5 px-2.5 py-0 rounded-[6px] text-[13px] text-(--fg) data-[state=inactive]:text-(--fg) data-[state=active]:text-(--fg) font-normal data-[state=active]:font-semibold data-[state=active]:bg-(--sel) hover:data-[state=inactive]:bg-transparent focus-visible:outline-2 focus-visible:outline-(--accent) after:hidden',
            leadingIcon: 'size-[15px] text-(--muted) group-data-[state=active]:text-(--accent-fg)',
            label: 'flex-1 text-left'
          }"
        >
          <template #trailing="{ index }">
            <span class="text-[10.5px] text-(--faint) font-normal">Ctrl {{ index + 1 }}</span>
          </template>
          <template #list-trailing>
            <span class="flex-1" />
            <div class="px-2.5 py-2 text-[11.5px] text-(--faint) leading-normal font-normal">↑ ↓ switch sections<br>Ctrl 1–{{ TABS.length }} jump<br>Esc closes</div>
          </template>
        </UTabs>

        <main class="flex-1 min-w-0 overflow-y-auto pt-6 px-7 pb-7">
          <div class="text-[20px] font-semibold tracking-[-.01em] mb-[18px]">{{ tabTitle }}</div>

          <!-- General -->
          <div v-if="tab === 'general'" :class="card">
            <div v-for="([k, title, desc], j) in generalSwitches" :key="k" :class="[row, j < generalSwitches.length - 1 ? 'border-b border-(--bd)' : '']">
              <SettingsRow :title="title" :desc="desc" />
              <USwitch v-model="(S[k] as boolean)" :aria-label="title" :ui="switchLg" />
            </div>
          </div>

          <!-- Shortcuts -->
          <SettingsShortcutsPanel v-else-if="tab === 'shortcuts'" />

          <!-- Extensions -->
          <div v-else-if="tab === 'extensions'" class="flex gap-4 items-start">
            <div class="flex-1 min-w-0 flex flex-col gap-2.5">
              <UTable
                :data="extRows"
                :columns="extColumns"
                :meta="{ class: { tr: (r: any) => r.original.id === cfgExt.id ? 'bg-(--sel)!' : '' } }"
                :on-select="(_e: Event, r: any) => { cfg = r.original.id }"
                class="border border-(--bd) rounded-[8px] overflow-hidden"
                :ui="{
                  base: 'table-fixed w-full',
                  thead: 'bg-(--surface)',
                  tbody: 'divide-y-0 [&>tr]:data-[selectable=true]:cursor-pointer [&>tr]:data-[selectable=true]:hover:bg-(--hover) [&>tr]:data-[selectable=true]:focus-visible:outline-2 [&>tr]:data-[selectable=true]:focus-visible:outline-(--accent)',
                  tr: 'border-b border-(--bd)',
                  th: 'h-[34px] py-0 px-1 first:pl-3 last:pr-3 text-[11.5px] font-semibold text-(--faint) border-b border-(--bd)',
                  td: 'h-12 py-0 px-1 first:pl-3 last:pr-3 text-[13.5px] text-(--fg)',
                  separator: 'hidden'
                }"
              >
                <template #name-cell="{ row: r }">
                  <div class="flex items-center gap-2.5 min-w-0" :class="exts.isActive(r.original.id) ? '' : 'opacity-60'">
                    <Tile :icon="r.original.icon" :tile="r.original.tile" :size="28" :icon-size="14" />
                    <div class="min-w-0">
                      <div class="font-medium truncate">{{ r.original.name }}</div>
                      <div class="text-[11.5px] text-(--muted)">{{ r.original.author }}</div>
                    </div>
                  </div>
                </template>
                <template #cmds-cell="{ row: r }">
                  <span class="text-[12.5px] text-(--muted)">{{ r.original.commands.length }}</span>
                </template>
                <template #on-cell="{ row: r }">
                  <USwitch
                    :model-value="exts.isActive(r.original.id)"
                    :aria-label="`Enable ${r.original.name}`"
                    :ui="switchSm"
                    @update:model-value="(on: boolean) => exts.setEnabled(r.original.id, on)"
                  />
                </template>
              </UTable>
              <div class="text-[12px] text-(--muted) leading-normal">Turned-off extensions keep their preferences but drop out of search. Install more from <span class="font-medium text-(--fg)">Store</span> in the launcher.</div>
            </div>
            <SettingsExtensionPrefs v-if="cfgExt" :ext="cfgExt" @open-tab="(t: string) => tab = t" />
          </div>

          <!-- Clipboard -->
          <div v-else-if="tab === 'clipboard'" :class="card">
            <div :class="[row, 'border-b border-(--bd)']">
              <SettingsRow title="History length" desc="Older entries are removed first. Pinned items are always kept." />
              <USelect v-model="S.histLen" :items="histOpts" variant="none" :class="`${field} w-[150px] px-2`" :ui="selectUi" />
            </div>
            <div :class="[row, 'border-b border-(--bd)']">
              <SettingsRow title="Keep for" desc="Entries older than this are deleted automatically." />
              <span class="flex items-center gap-2">
                <UInputNumber
                  v-model="S.keepDays"
                  :min="1"
                  :max="365"
                  :increment="false"
                  :decrement="false"
                  variant="none"
                  class="w-[70px]"
                  :ui="{ base: `${field} w-[70px] px-2.5 text-left` }"
                />
                <span class="text-[12.5px] text-(--muted)">days</span>
              </span>
            </div>
            <div :class="[row, 'border-b border-(--bd)']">
              <SettingsRow title="Ignore password managers" desc="Skips anything copied from 1Password, Bitwarden, KeePassXC and content marked as concealed." />
              <USwitch v-model="S.ignorePm" aria-label="Ignore password managers" :ui="switchLg" />
            </div>
            <div class="px-4 py-3.5 flex flex-col gap-2.5">
              <SettingsRow title="Ignored apps" desc="Nothing copied in these apps is saved." />
              <div v-for="ig in S.ignored" :key="ig.name" class="flex items-center gap-2.5 h-9 pr-1.5 pl-2.5 border border-(--bd) rounded-[6px] bg-(--input-bg)">
                <Tile :icon="ig.icon" :tile="ig.tile" :size="20" :icon-size="11" :radius="5" />
                <span class="flex-1 text-[13px]">{{ ig.name }}</span>
                <UButton
                  icon="i-lucide-x"
                  :aria-label="`Remove ${ig.name}`"
                  color="neutral"
                  variant="ghost"
                  class="size-[26px] p-0 justify-center rounded-[6px] text-(--muted)"
                  :ui="{ leadingIcon: 'size-[13px]' }"
                  @click="S.ignored = S.ignored.filter(x => x !== ig)"
                />
              </div>
              <div class="flex gap-2">
                <UInput v-model="newApp" placeholder="App name, e.g. Signal" variant="none" class="flex-1" :ui="{ base: `${field} px-2.5` }" @keydown.enter="addApp" />
                <UButton icon="i-lucide-plus" label="Add app" color="neutral" variant="outline" :class="ghostBtn" :ui="{ leadingIcon: 'size-[13px]' }" @click="addApp" />
              </div>
            </div>
          </div>

          <!-- AI -->
          <div v-else-if="tab === 'ai'" class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <div class="text-[12px] font-semibold">Backend</div>
              <URadioGroup
                v-model="S.backend"
                :items="backends"
                variant="card"
                orientation="horizontal"
                :ui="{
                  fieldset: 'grid grid-cols-2 gap-2.5',
                  item: 'text-left px-3.5 py-3 rounded-[8px] border border-(--bd) bg-(--surface) has-data-[state=checked]:border-(--accent) has-data-[state=checked]:bg-(--accent-soft) gap-2.5 cursor-pointer',
                  container: 'h-auto mt-px',
                  base: 'size-4 ring-2 ring-inset ring-(--muted) data-[state=checked]:ring-(--accent) bg-transparent',
                  indicator: 'bg-transparent after:size-1.5 after:bg-(--accent)',
                  wrapper: 'ms-0',
                  label: 'block font-medium text-[13.5px] text-(--fg)',
                  description: 'block text-[12px] text-(--muted) mt-[3px] leading-[1.45]'
                }"
              />
            </div>
            <UFormField v-if="S.backend === 'api'" label="Anthropic API key" class="max-w-[420px]" :ui="{ root: 'flex flex-col gap-[5px]', label: 'text-[12px] font-semibold text-(--fg)', container: 'mt-0' }">
              <UInput model-value="sk-ant-api03-••••••••••••••••" type="password" variant="none" class="w-full" :ui="{ base: `${field} px-2.5 font-mono text-[12px]` }" />
            </UFormField>
            <div v-if="S.backend === 'cc'" class="flex flex-col border border-(--bd) rounded-[8px] bg-(--surface)">
              <div class="flex items-center gap-3 px-3.5 py-3">
                <span class="size-2 rounded-full flex-none" :style="{ background: conn.tone }" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium">{{ conn.title }}</div>
                  <div class="text-[12px] text-(--muted) mt-0.5">{{ conn.sub }}<template v-if="checkedAt"> · Checked {{ ago(checkedAt) }}</template></div>
                </div>
                <UButton color="neutral" variant="outline" :class="`${ghostBtn} h-[30px]`" @click="checkConn">
                  <Spinner v-if="checking" :size="13" />{{ checking ? 'Checking…' : 'Check' }}
                </UButton>
              </div>
              <div v-if="status?.loggedIn" class="border-t border-(--bd) px-3.5 py-3 flex flex-col gap-2.5">
                <div class="flex items-center gap-3">
                  <div class="flex-1 text-[12px] font-semibold">Plan usage</div>
                  <UButton color="neutral" variant="outline" :class="`${ghostBtn} h-[26px] px-2.5 text-[12px]`" :disabled="refreshing" icon="i-lucide-refresh-cw" :ui="{ leadingIcon: `size-3 ${refreshing ? 'animate-[lp-spin_.8s_linear_infinite]' : ''}` }" @click="refreshUsage">
                    {{ refreshing ? 'Refreshing…' : 'Refresh' }}
                  </UButton>
                </div>
                <div v-for="r in usageRows" :key="r.label" class="flex flex-col gap-1">
                  <div class="flex items-baseline gap-2 text-[12.5px]">
                    <span class="flex-1">{{ r.label }}</span>
                    <span class="font-medium tabular-nums">{{ r.pct }}% used</span>
                  </div>
                  <UProgress :model-value="r.pct" size="sm" :ui="{ base: 'bg-(--tile) h-1.5', indicator: 'rounded-full' }" :style="{ '--ui-primary': r.color }" />
                  <div class="text-[11.5px] text-(--muted)">{{ r.resets }}</div>
                </div>
                <div v-if="!usageRows.length" class="text-[12px] text-(--muted) leading-normal">No usage yet. Send a message in AI Chat, or press Refresh.</div>
                <div class="text-[11.5px] text-(--muted) leading-normal">
                  <template v-if="claude.usage.value">Updated {{ ago(claude.usage.value.at) }} from Claude Code. </template>Refresh sends Claude a one-word request, which uses a tiny amount of your plan.
                </div>
                <div v-if="refreshError" class="text-[12px] text-(--err)">{{ refreshError }}</div>
              </div>
            </div>
            <div v-else class="flex items-center gap-3 px-3.5 py-3 border border-(--bd) rounded-[8px] bg-(--surface)">
              <span class="size-2 rounded-full bg-(--faint)" />
              <div class="flex-1">
                <div class="font-medium">API key backend isn’t connected yet</div>
                <div class="text-[12px] text-(--muted) mt-0.5">AI Chat and Quick AI currently run through Claude Code. Switch back to use them.</div>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <SettingsRow title="Default permission mode" desc="Applies when Agent mode is on in AI Chat." />
              <USelect v-model="S.permMode" :items="permOpts" variant="none" :class="`${field} w-[240px] px-2`" :ui="selectUi" />
            </div>
            <div class="flex flex-col gap-2">
              <SettingsRow title="Allowed tools" desc="These run without an approval prompt." />
              <div class="border border-(--bd) rounded-[8px] overflow-hidden">
                <div v-for="p in S.tools" :key="p" class="flex items-center gap-2.5 h-[38px] pr-1.5 pl-3 border-b border-(--bd)">
                  <UIcon :name="toolIcon(p)" class="size-3.5 text-(--muted)" />
                  <span class="flex-1 font-mono text-[12.5px]">{{ p }}</span>
                  <UButton
                    icon="i-lucide-x"
                    aria-label="Remove"
                    color="neutral"
                    variant="ghost"
                    class="size-[26px] p-0 justify-center rounded-[6px] text-(--muted)"
                    :ui="{ leadingIcon: 'size-[13px]' }"
                    @click="S.tools = S.tools.filter(x => x !== p)"
                  />
                </div>
                <div class="flex gap-2 p-2">
                  <UInput v-model="newTool" placeholder="Bash(npm run test:*)" variant="none" class="flex-1" :ui="{ base: `${field} h-[30px] px-2.5 font-mono text-[12px]` }" @keydown.enter="addTool" />
                  <UButton label="Add" color="neutral" variant="outline" :class="`${ghostBtn} h-[30px]`" @click="addTool" />
                </div>
              </div>
            </div>
          </div>

          <!-- Appearance -->
          <div v-else-if="tab === 'appearance'" :class="card">
            <div :class="[row, 'border-b border-(--bd)']">
              <SettingsRow title="Theme" desc="System follows Windows personalisation settings." />
              <UTabs
                v-model="theme"
                :items="themeItems"
                variant="pill"
                :content="false"
                :ui="{
                  root: 'gap-0',
                  list: 'w-auto p-[3px] rounded-[6px] bg-(--tile) gap-0.5',
                  indicator: 'rounded-[6px] bg-(--win) shadow-none',
                  trigger: 'grow-0 h-7 px-3.5 py-0 rounded-[6px] text-[12.5px] font-normal text-(--fg) data-[state=active]:text-(--fg) data-[state=inactive]:text-(--fg) before:hidden'
                }"
              />
            </div>
            <div :class="row">
              <SettingsRow title="Accent colour" desc="Used for selection, focus rings and primary buttons." />
              <div role="radiogroup" aria-label="Accent colour" class="flex items-center gap-2.5" @keydown="onAccentKey">
                <button
                  v-for="id in ACCENT_IDS"
                  :key="id"
                  role="radio"
                  :aria-checked="S.accent === id"
                  :aria-label="accentLabel(id)"
                  :title="accentLabel(id)"
                  :tabindex="S.accent === id ? 0 : -1"
                  class="size-[18px] rounded-full border-0 p-0 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--fg)"
                  :style="{
                    background: accentVars(id, colorMode.value === 'light' ? 'light' : 'dark')['--accent'],
                    boxShadow: S.accent === id ? '0 0 0 2px var(--win), 0 0 0 4px var(--accent)' : 'none'
                  }"
                  @click="S.accent = id"
                />
                <span class="w-12 text-[12.5px] text-(--muted)">{{ accentLabel(S.accent) }}</span>
              </div>
            </div>
          </div>

          <!-- About -->
          <div v-else class="flex flex-col gap-3.5 items-start">
            <div class="flex items-center gap-3.5">
              <EskyIcon :size="52" />
              <div>
                <div class="text-[16px] font-semibold">Esky</div>
                <div class="text-[12.5px] text-(--muted) mt-0.5">Version {{ sys.version }}<template v-if="sys.os.value"> · {{ sys.os.value }}</template></div>
              </div>
            </div>
            <UButton color="neutral" variant="outline" :class="ghostBtn" @click="checkUpdates">
              <Spinner v-if="upd === 1" :size="13" />{{ ['Check for updates', 'Checking…', 'You’re on the latest version'][upd] }}
            </UButton>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style>
/* Settings window tokens (slightly different from the launcher's), per theme. */
:root:not(.light) .settings {
  --bd: rgba(255, 255, 255, .08);
  --surface: rgba(255, 255, 255, .035);
  --kbd-bd: rgba(255, 255, 255, .12);
}

:root.light .settings {
  --bd: rgba(0, 0, 0, .09);
  --surface: rgba(0, 0, 0, .02);
  --kbd-bg: #FFFFFF;
}
</style>

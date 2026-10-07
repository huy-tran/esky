// Launcher state and behaviour.
import {
  AI_CMDS, EMOJI, FAVS, GROUPS,
  ITEMS, KIND_LABEL, NOTES_INIT, ONB_HK, RECENT,
  SPLIT, SPLIT_FOOT, SPLIT_KEYS, SUGGEST, SYS_CONFIRM, USAGE_INIT, WIN_CMDS,
  type ChatMsg, type Emoji, type FileEntry, type Note, type Quicklink,
  type Selection, type Snippet, type SplitView, type WinCmd
} from '~/data/fixtures'
import { EXTENSIONS, commandFor, extById, type ExtensionDef } from '~/extensions/registry'
import { quick, resolveQ as resolveQuicklink, type QuickCard } from '~/utils/quick'
import { useAliases, useExtensions } from './useExtensions'
import { useClaude, type ClaudeRun } from './useClaude'
import type { ClaudeStatus } from '~/utils/claude'
import { markdownBlocks } from '~/utils/markdown'
import { lookup, type DictEntry } from '~/utils/dictionary'
import type { HerdSite } from '~/utils/herd'
import { useHerd } from './useHerd'
import { parseFolders } from '~/utils/git'
import { openTerminal, useGitRepos } from './useGitRepos'
import { usePassword, wordlist } from './usePassword'
import { appName, useApps } from './useApps'
import { useHotkeys } from './useHotkeys'
import { useRates } from './useRates'
import { useQuicklinks } from './useQuicklinks'
import { useSnippets } from './useSnippets'
import { fileKind, useFiles } from './useFiles'
import { useDocker, type DockerKind } from './useDocker'
import { useForge, type ForgeServer } from './useForge'
import { jiraLogWork, remoteSources, useRemote } from './useRemote'
import { formatColour, useColours, type ColourFormat, type SavedColour } from './useColours'
import { clipDay, clipPreview, copyPrivate, useClipboard, type ClipEntry } from './useClipboard'
import { comboOf, formatBytes, phSegs, trunc, type BodySeg } from '~/utils/text'
import { captureTarget, clearTarget, copyText, ejectDrive, floatNote, hideWindow, isTauri, openSettings, openUrl, pasteToTarget, readClipboardText, recycleBinInfo, removableDrives, revealPath, openSsh, showWindow, systemAction, windowLayout, type SystemAction } from './usePlatform'
import { persistRef } from './usePersist'
import { useSettings } from './useSettings'

export type View = 'search' | 'clipboard' | 'chat' | 'aiResult' | 'forgeList' | 'forgeDetail' | 'deploy' | 'emoji' | 'herdList' | 'gitList' | 'password' | 'dockerList' | 'remoteList' | 'dictionary' | SplitView

/** Senses shown per part of speech; the rest are one Ctrl O away on Wiktionary. */
export const DICT_SENSES = 8

export interface Row {
  key: string
  id?: string
  title: string
  sub: string
  icon: string
  tile?: string
  kind?: string
  keys?: string[]
  label?: string
  alias?: string
  hl?: string
  path?: string
  run: () => void
}

export interface Section { title: string, rows: Row[] }

export interface Hint { label: string, keys: string[], run: () => void, primary?: boolean }

export interface ActionDef { id: string, title: string, icon: string, keys: string[], danger?: boolean }

export interface SplitRow {
  key: string
  title: string
  sub: string
  icon: string
  tile?: string
  mono?: boolean
  acc?: string
  accMono?: boolean
  accColor?: string
  keys?: string[]
  data: SplitData
  g: string
}

export type SplitData = Snippet | Quicklink | WinCmd | FileEntry | ExtensionDef | Note | SavedColour

export interface Detail {
  head?: { icon?: string, tile?: string, title?: string, sub?: string, badge?: string, btn?: { label: string, primary: boolean, danger: boolean, busy: boolean, run: () => void } }
  screens?: { name: string, win: null | { l: string, t: string, w: string, h: string } }[]
  preview?: { ratio: string, label: string } | null
  /** A picture to show (a file's thumbnail). */
  image?: string
  input?: { label: string, val: string, ph: string, hint: string, on: (v: string) => void } | null
  body?: { segs: BodySeg[], mono?: boolean } | null
  desc?: string
  items?: { title: string, list: { t: string, icon: string }[] }
  edit?: { val: string, on: (v: string) => void }
  meta?: [string, string, (1 | undefined)?][]
}

type ToastKind = 'success' | 'error' | 'info'
interface ToastAction { label: string, run: () => void }

interface Stream { target: 'chat' | 'ai', text: string, pos: number, done?: boolean }

/** A saved AI conversation. `sessionId` continues it in Claude Code; `context` primes chats started from Quick AI. */
export interface SavedChat { id: string, title: string, sessionId?: string, context?: string, messages: ChatMsg[], updated: number }

function createLauncher() {
  const toastApi = useToast()
  const colorMode = useColorMode()
  const { settings } = useSettings()

  const s = reactive({
    // The desktop window starts hidden in the tray; the browser build starts open.
    open: !isTauri(),
    view: 'search' as View,
    query: '',
    sel: 0,
    selection: null as Selection | null,
    /** The app Esky was opened from with a hotkey, where Paste goes. */
    target: null as null | { app: string },
    actionsOpen: false,
    actionsQuery: '',
    actionsSel: 0,
    clipSel: 0,
    clipQuery: '',
    messages: [] as ChatMsg[],
    chatInput: '',
    showChats: true,
    claudeReady: true,
    setupStep: 0,
    checking: false,
    attach: null as string | null,
    chatTitle: 'New chat',
    chatId: '',
    attachText: '',
    claudeStatus: null as ClaudeStatus | null,
    stream: null as Stream | null,
    /** Quick AI: the command, the text it works on and where that came from, and the outcome. `needsInput` asks for the text first. */
    ai: null as null | { cmd: string, input: string, source: string, origOpen: boolean, result?: string, error?: string, needsInput?: boolean },
    /** Text typed or pasted for a Quick AI command run without a selection. */
    aiInput: '',
    followUp: '',
    forgeQuery: '',
    forgeSel: 0,
    server: null as ForgeServer | null,
    /** Deploy Site: the chosen site, and the deployment while it runs and once it ends. */
    deploy: { siteId: '' },
    deploying: false,
    deployRun: null as null | { site: string, status: string, log?: string, ok?: boolean },
    deployFrom: 'forgeDetail' as View,
    splitQuery: '',
    splitSel: 0,
    args: {} as Record<string, string>,
    hk: null as null | { id: string, title: string, combo: string[] | null, conflict: string, ownerId?: string | null, reserved?: boolean, note?: string },
    al: null as null | { id: string, title: string, value: string },
    confirm: null as null | { title: string, desc: string, label: string, run: () => void },
    onb: null as null | { step: number, hk: number, tg: Record<string, boolean> },
    notice: '',
    herdQuery: '',
    herdSel: 0,
    gitQuery: '',
    dockerQuery: '',
    remoteQuery: '',
    remoteSel: 0,
    /** Jira Log Work dialog. */
    logWork: null as null | { key: string, title: string, time: string, comment: string, error: string, busy: boolean },
    dockerSel: 0,
    gitSel: 0,
    dictWord: '',
    dictSel: 0
  })

  // Persisted state
  const favs = ref<string[]>([...FAVS])
  const disabled = ref<string[]>([])
  const usage = ref<Record<string, number>>({ ...USAGE_INIT })
  const recent = ref<string[]>([...RECENT])
  const aliases = useAliases()
  const hk = useHotkeys()
  const hotkeys = hk.hotkeys
  const exts = useExtensions()
  const installed = exts.installed
  const notes = ref<Note[]>(NOTES_INIT.map(n => ({ ...n })))
  const clipboard = useClipboard()
  const clip = clipboard.history
  const floatId = ref<string | null>(null)
  const chats = ref<SavedChat[]>([])
  const claude = useClaude()
  const onboarded = ref(false)

  const ready = Promise.all([
    persistRef('favs', favs),
    persistRef('disabled', disabled),
    persistRef('usage', usage),
    persistRef('recent', recent),
    hk.ready,
    exts.ready,
    persistRef('notes', notes),
    clipboard.ready,
    persistRef('floatId', floatId),
    persistRef('onboarded', onboarded),
    persistRef('chats', chats)
  ])

  // DOM elements the key map needs to focus or compare against.
  const els = shallowReactive({
    top: null as HTMLInputElement | null,
    chat: null as HTMLTextAreaElement | null,
    deploy: null as HTMLElement | null,
    act: null as HTMLInputElement | null,
    arg: null as HTMLInputElement | null,
    note: null as HTMLTextAreaElement | null,
    aiInput: null as HTMLTextAreaElement | null,
    al: null as HTMLInputElement | null
  })

  let nt: ReturnType<typeof setTimeout> | undefined

  const theme = () => (colorMode.value === 'light' ? 'light' : 'dark')

  // ---------- helpers ----------

  const rowKeys = hk.keysFor
  const comboOwner = hk.ownerOf

  const aliasOwner = (v: string, ex: string) => Object.keys(aliases.value).find(id => id !== ex && aliases.value[id] === v) || null

  function toast(kind: ToastKind, title: string, desc = '', action: ToastAction | null = null) {
    const icon = { success: 'i-lucide-circle-check', error: 'i-lucide-circle-x', info: 'i-lucide-info' }[kind]
    const color = { success: 'success', error: 'error', info: 'primary' }[kind] as 'success' | 'error' | 'primary'
    const id = `t${Date.now()}${Math.random()}`
    toastApi.add({
      id,
      title,
      description: desc || undefined,
      icon,
      color,
      duration: 4500,
      orientation: 'horizontal',
      ui: { root: 'items-start', actions: 'items-start', ...(kind === 'info' ? { icon: 'text-(--accent-fg)' } : {}) },
      close: { ui: { leadingIcon: 'size-[13px]' } },
      actions: action
        ? [{ label: action.label, color: 'neutral', variant: 'outline', class: 'h-6 px-2 rounded-[6px] ring-0 border border-(--bd) bg-(--surface) text-(--fg) text-[12px] font-normal', onClick: () => {
            action.run()
            toastApi.remove(id)
          } }]
        : undefined
    })
  }

  function focus() {
    requestAnimationFrame(() => {
      if (!s.open) return
      const el = s.al ? els.al : s.actionsOpen ? els.act : s.view === 'chat' ? els.chat : s.view === 'deploy' ? els.deploy : s.view === 'aiResult' && s.ai?.needsInput ? els.aiInput : els.top
      el?.focus?.()
    })
  }

  const hasInputSel = () => {
    const a = document.activeElement as HTMLInputElement | null
    return !!a && a.selectionStart != null && a.selectionStart !== a.selectionEnd
  }

  const ok = (id: string) => {
    const it = ITEMS[id]!
    if (disabled.value.includes(id) || (it.ext && !exts.isActive(it.ext))) return false
    // Settings → General: which kinds of apps show up.
    if (it.app) return it.app.store ? settings.value.storeApps : settings.value.desktopApps
    return true
  }

  // ---------- extension preferences ----------

  /** Quicklink URL with the Laravel Docs version preference applied (the "ld" quicklink). */
  const resolveQ = (q: Quicklink, arg: string) =>
    resolveQuicklink(q, arg).replace(/laravel\.com\/(?:framework\/)?docs\/[^/]+\//, `laravel.com/framework/docs/${exts.prefsFor('docs').version || 'master'}/`)

  /** Calculator preferences, and quicklinks resolved as above. */
  const quickOpts = () => {
    const p = exts.prefsFor('calc')
    return { decimals: Number(p.decimals ?? 6), separators: p.separators !== false, resolve: resolveQ, rates: rates.rates.value, quicklinks: qls.list.value }
  }

  /** Ask for missing setup instead of running a command that can't work. */
  function needsSetup(ext: ExtensionDef, keys: string[]) {
    const p = exts.prefsFor(ext.id)
    const missing = ext.prefs.filter(f => keys.includes(f.key) && !p[f.key])
    if (!missing.length) return false
    toast('info', `Set up ${ext.name} first`, `Add your ${missing.map(f => f.label.toLowerCase()).join(' and ')} in Settings.`, { label: 'Open Settings', run: () => openSettings({ tab: 'extensions', ext: ext.id }) })
    return true
  }

  // ---------- models ----------

  const apps = useApps()
  const rates = useRates()
  const qls = useQuicklinks()
  const sn = useSnippets()
  const files = useFiles()
  /** File Search results for the Files view, and the few shown in root search. */
  const fileHits = shallowRef<FileEntry[]>([])
  const rootFiles = shallowRef<FileEntry[]>([])
  const kindOf = (x: FileEntry) => { const k = fileKind(x.name); return { icon: k.icon, tile: k.tile } }
  const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  const mk = (id: string, hl?: string): Row => {
    const it = ITEMS[id]!
    return { key: id, id, title: it.title, sub: it.sub, icon: apps.icons.value[id] ?? it.icon, tile: it.tile, kind: it.kind, keys: rowKeys(id), label: KIND_LABEL[it.kind], alias: aliases.value[id] || '', hl, path: it.app?.path ?? undefined, run: () => activate(id) }
  }

  /** How well a title matches the query: 3 starts with it, 2 a word or the initials start with it, 1 contains it, 0 no match. */
  function matchScore(title: string, q: string) {
    const t = title.toLowerCase()
    if (t.startsWith(q)) return 3
    const words = t.split(/[\s\-_.()]+/).filter(Boolean)
    if (words.some(w => w.startsWith(q)) || words.map(w => w[0]).join('').startsWith(q)) return 2
    return t.includes(q) ? 1 : 0
  }

  // ---------- Herd sites ----------

  const herd = useHerd()

  const herdRow = (x: HerdSite, hl?: string): Row => ({
    key: `herd:${x.name}`,
    title: x.name,
    sub: x.url.replace(/^https?:\/\//, ''),
    icon: x.laravel ? 'i-lucide-feather' : 'i-lucide-globe',
    tile: x.laravel ? '#E11D48' : undefined,
    kind: 'herd',
    label: 'Herd Site',
    hl,
    path: x.path,
    run: () => openSite(x)
  })

  function openSite(x: HerdSite) {
    usage.value = { ...usage.value, [`herd:${x.name}`]: (usage.value[`herd:${x.name}`] || 0) + 1 }
    closeWith(`Opened ${x.url}`, () => openUrl(x.url))
  }

  /** Sites after the Herd preferences: hidden entirely when the extension is off. */
  const herdSites = computed(() => {
    if (!exts.isActive('herd')) return []
    const all = exts.prefsFor('herd').showAll !== false
    return herd.sites.value.filter(x => all || x.laravel)
  })

  const herdModel = computed(() => {
    const q = s.herdQuery.trim().toLowerCase()
    const list = herdSites.value.filter(x => !q || x.name.toLowerCase().includes(q) || x.path.toLowerCase().includes(q))
    const groups = [...new Set(list.map(x => x.group))].map(g => ({ title: g, rows: list.filter(x => x.group === g) }))
    return { groups, flat: groups.flatMap(g => g.rows) }
  })
  const curSite = () => herdModel.value.flat[s.herdSel]

  const loadHerd = () => herd.load(String(exts.prefsFor('herd').configDir || ''))

  function openHerd() {
    go('herdList', { herdQuery: '', herdSel: 0 })
    loadHerd()
  }

  const EDITORS: Record<string, { name: string, short: string, url: (path: string) => string }> = {
    vscode: { name: 'Visual Studio Code', short: 'VS Code', url: p => `vscode://file/${p.replace(/\\/g, '/')}` },
    cursor: { name: 'Cursor', short: 'Cursor', url: p => `cursor://file/${p.replace(/\\/g, '/')}` },
    zed: { name: 'Zed', short: 'Zed', url: p => `zed://file/${p.replace(/\\/g, '/')}` },
    phpstorm: { name: 'PhpStorm', short: 'PhpStorm', url: p => `phpstorm://open?file=${encodeURIComponent(p)}` }
  }
  /** An extension's "Open … with" preference. */
  const editorFor = (ext: string) => EDITORS[String(exts.prefsFor(ext).editor)] ?? EDITORS.vscode!
  const herdEditor = () => editorFor('herd')

  // ---------- Git repos ----------

  const git = useGitRepos()
  const gitFolders = () => parseFolders(String(exts.prefsFor('git').folders || ''))
  const loadGit = () => git.load(gitFolders())

  /** Repos that need attention: uncommitted changes, and (if turned on) commits not pushed yet. */
  const gitModel = computed(() => {
    const unpushed = exts.prefsFor('git').unpushed !== false
    const q = s.gitQuery.trim().toLowerCase()
    const list = git.repos.value
      .filter(r => r.error || r.files.length || (unpushed && r.ahead))
      .filter(r => !q || r.name.toLowerCase().includes(q) || (r.branch || '').toLowerCase().includes(q))
    const groups = [...new Set(list.map(r => r.root))].map(g => ({ title: g, rows: list.filter(r => r.root === g) }))
    return { groups, flat: groups.flatMap(g => g.rows), checked: git.repos.value.length }
  })
  const curRepo = () => gitModel.value.flat[Math.min(s.gitSel, Math.max(0, gitModel.value.flat.length - 1))]

  function openGit() {
    go('gitList', { gitQuery: '', gitSel: 0 })
    loadGit()
  }

  // ---------- Password Generator ----------

  const pw = usePassword()

  function openPassword() {
    go('password')
    pw.regenerate()
    // Ready for a switch to Passphrase.
    wordlist()
  }

  function copyPassword(close = true) {
    if (!pw.value.value) return
    // Kept out of Clipboard History and Windows' Win+V history.
    copyPrivate(pw.value.value)
    const what = pw.opts.value.type === 'password' ? 'Password' : 'Passphrase'
    if (close) closeWith(`${what} copied`)
    else toast('success', `${what} copied`)
  }

  // ---------- Dictionary ----------

  const dict = reactive({
    status: 'idle' as 'idle' | 'loading' | 'ready' | 'empty' | 'error',
    entry: null as DictEntry | null,
    error: ''
  })
  let dictTimer: ReturnType<typeof setTimeout> | undefined
  let dictSeq = 0

  /** Look up `s.dictWord` after typing pauses. */
  watch(() => s.dictWord, (w) => {
    clearTimeout(dictTimer)
    const word = w.trim()
    if (!word) {
      Object.assign(dict, { status: 'idle', entry: null, error: '' })
      return
    }
    Object.assign(dict, { status: 'loading', entry: null })
    const seq = ++dictSeq
    dictTimer = setTimeout(async () => {
      try {
        const entry = await lookup(word, (full) => {
          // Pronunciation and forms arrive later; swap in a copy so the view updates.
          if (seq === dictSeq) dict.entry = { ...full, parts: full.parts.map(p => ({ ...p })) }
        })
        if (seq !== dictSeq) return
        Object.assign(dict, { status: entry ? 'ready' : 'empty', entry, error: '' })
        s.dictSel = 0
      } catch (e) {
        if (seq !== dictSeq) return
        Object.assign(dict, { status: 'error', entry: null, error: (e as Error).message })
      }
    }, 350)
  })

  /** Every sense in display order, for ↑/↓ selection. */
  const dictFlat = computed(() => (dict.entry?.parts ?? []).flatMap(p => p.senses.slice(0, DICT_SENSES).map((sense, i) => ({ pos: p.pos, n: i + 1, sense }))))
  const curSense = () => dictFlat.value[s.dictSel]

  const defineRow = (word: string): Row => ({ key: `def:${word}`, title: `Define “${word}”`, sub: 'Dictionary', icon: 'i-lucide-book-a', tile: '#0369A1', kind: 'dict', run: () => openDictionary(word) })

  function openDictionary(word = '') {
    go('dictionary', { dictWord: word, dictSel: 0, query: '' })
  }

  const searchModel = computed(() => {
    void apps.version.value // app and quicklink items in ITEMS changed
    void qls.version.value
    void sn.version.value
    const q = s.query.trim()
    const ql = q.toLowerCase()
    let card: (QuickCard & { run: () => void }) | null = null
    const sections: Section[] = []
    let def: RegExpMatchArray | null
    if (!q) {
      if (s.selection) sections.push({ title: 'Use selected text', rows: AI_CMDS.map(c => ({ key: c.id, title: c.title, sub: 'Quick AI', icon: c.icon, keys: c.keys, kind: 'ai', run: () => runAi(c.id) })) })
      sections.push({ title: 'Favourites', rows: favs.value.filter(id => ITEMS[id] && ok(id)).map(id => mk(id)) })
      sections.push({ title: 'Recent', rows: recent.value.filter(id => ITEMS[id] && ok(id)).map(id => mk(id)) })
      sections.push({ title: 'Suggestions', rows: SUGGEST.filter(ok).map(id => mk(id)) })
    } else if ((def = q.match(/^(?:define|def)\s+(.+)$/i))) {
      sections.push({ title: 'Dictionary', rows: [defineRow(def[1]!.trim())] })
    } else {
      const t = quick(q, quickOpts())
      if (t && 'card' in t) {
        const c = t.card
        card = { ...c, run: () => copyCard(c) }
      }
      if (t && 'rows' in t) {
        sections.push({ title: t.title, rows: t.rows.map(r => ({ ...r, run: () => closeWith(r.action.msg, () => openFromMsg(r.key, r.sub, q)) })) })
      }
      if (ql === 'ai' || ql.startsWith('ai ')) {
        const rest = q.slice(2).trim()
        sections.push({ title: 'AI', rows: [{ key: 'askai', title: rest ? `Ask AI: ${rest}` : 'Ask AI', sub: 'Chat with Claude', icon: 'i-lucide-sparkles', keys: ['Tab'], kind: 'chat', run: () => openChat(rest) }] })
      }
      const aliasHit = t ? [] : Object.keys(aliases.value).filter(id => ITEMS[id] && ok(id) && aliases.value[id] === ql)
      if (aliasHit.length) sections.push({ title: 'Alias', rows: aliasHit.map(id => mk(id)) })
      if (!t) {
        // Best title match first, then the most used. A subtitle or alias match counts as a weak match.
        const score = (id: string) => {
          const it = ITEMS[id]!
          return matchScore(it.title, ql) || (it.sub.toLowerCase().includes(ql) || (aliases.value[id] || '').startsWith(ql) ? 1 : 0)
        }
        for (const [k, name] of GROUPS) {
          const rows = Object.keys(ITEMS)
            .filter(id => ITEMS[id]!.kind === k && ok(id) && !aliasHit.includes(id))
            .map(id => ({ id, sc: score(id) }))
            .filter(x => x.sc > 0)
            .sort((a, b) => b.sc - a.sc || (usage.value[b.id] || 0) - (usage.value[a.id] || 0))
            // There are 150+ apps; a short query would otherwise flood the list.
            .slice(0, k === 'app' ? 8 : undefined)
            .map(x => mk(x.id, ql))
          if (rows.length) sections.push({ title: name, rows })
        }
        // Herd sites sit right after Applications and Commands.
        const sites = herdSites.value
          .filter(x => x.name.toLowerCase().includes(ql))
          .sort((a, b) => (usage.value[`herd:${b.name}`] || 0) - (usage.value[`herd:${a.name}`] || 0))
          .slice(0, 8)
          .map(x => herdRow(x, ql))
        if (sites.length) {
          const at = sections.findLastIndex(x => x.title === 'Applications' || x.title === 'Commands' || x.title === 'Alias') + 1
          sections.splice(at, 0, { title: 'Herd Sites', rows: sites })
        }
        // A few file matches at the end (File Search preferences).
        const fileRows = rootFiles.value.slice(0, 5).map((x): Row => ({ key: `file:${x.id}`, title: x.name, sub: x.dir, ...kindOf(x), kind: 'file', label: 'File', hl: ql, path: x.id, run: () => closeWith(`Opened ${x.name}`, () => openUrl(x.id)) }))
        if (fileRows.length) sections.push({ title: 'Files', rows: fileRows })
      }
      const web: Row[] = [
        { key: 'g', title: `Search Google for “${q}”`, sub: 'Web', icon: 'i-lucide-globe', tile: '#2563EB', run: () => closeWith(`Searching Google for “${q}”`, () => openUrl(`https://www.google.com/search?q=${encodeURIComponent(q)}`)) },
        { key: 'askq', title: `Ask AI “${q}”`, sub: 'Claude', icon: 'i-lucide-sparkles', kind: 'chat', run: () => openChat(q) },
        ...(/^[a-z][a-z'-]*$/i.test(q) && !card ? [defineRow(q)] : [])
      ]
      if (card) sections.push({ title: `Use “${q}” with…`, rows: web })
      else if (!sections.length) sections.push({ title: 'No matches · search elsewhere', rows: web })
    }
    const flat: Row[] = [...(card ? [{ key: 'card', title: card.big, sub: '', icon: card.icon, kind: 'card', run: card.run }] : []), ...sections.flatMap(x => x.rows)]
    return { card, sections, flat }
  })

  function openFromMsg(key: string, sub: string, q: string) {
    const m = q.trim().match(/^g\s+(.+)$/i)
    const t = encodeURIComponent(m?.[1] ?? '')
    if (key === 'wg') return openUrl(`https://www.google.com/search?q=${t}`)
    if (key === 'wgh') return openUrl(`https://github.com/search?q=${t}`)
    if (key === 'wl') return openUrl(`https://laravel.com/framework/docs/search?q=${t}`)
    if (key === 'ql') return openUrl(sub)
  }

  const clipModel = computed(() => {
    const q = s.clipQuery.trim().toLowerCase()
    const list = clip.value.filter(c => !q || clipPreview(c).toLowerCase().includes(q) || (c.text ?? '').toLowerCase().includes(q) || c.app.toLowerCase().includes(q))
    const groups = (['Pinned', 'Today', 'Yesterday', 'This week', 'Older'] as const)
      .map(t => ({ title: t, rows: list.filter(c => (c.pinned ? 'Pinned' : clipDay(c.at)) === t) }))
      .filter(g => g.rows.length)
    return { groups, flat: groups.flatMap(g => g.rows) }
  })
  const curClip = () => clipModel.value.flat[s.clipSel]

  const forgeModel = computed(() => {
    const q = s.forgeQuery.trim().toLowerCase()
    const list = forge.servers.value.filter(x => !q || x.name.toLowerCase().includes(q) || x.ip.includes(q) || x.provider.toLowerCase().includes(q))
    const groups = [...new Set(list.map(x => x.provider))].map(p => ({ title: p, rows: list.filter(x => x.provider === p) }))
    return { groups, flat: groups.flatMap(g => g.rows) }
  })

  const splitModel = computed(() => {
    const v = s.view
    const q = s.splitQuery.trim().toLowerCase()
    const has = (...xs: (string | undefined)[]) => !q || xs.some(x => (x || '').toLowerCase().includes(q))
    const grp = (rows: SplitRow[], order?: string[]) =>
      (order || [...new Set(rows.map(r => r.g))]).map(t => ({ title: t.toUpperCase(), rows: rows.filter(r => r.g === t) })).filter(g => g.rows.length)
    let groups: { title: string, rows: SplitRow[] }[] = []
    if (v === 'snippets') groups = grp(sn.list.value.filter(x => has(x.name, x.kw, x.text)).map(x => ({ key: x.id, title: x.name, sub: x.text.split('\n')[0]!, icon: 'i-lucide-text-quote', acc: x.kw, accMono: true, data: x, g: x.folder })), sn.folders.value)
    if (v === 'quicklinks') groups = grp(qls.list.value.filter(x => has(x.name, x.kw, x.url)).map(x => ({ key: x.id, title: x.name, sub: x.url, mono: true, icon: x.icon, tile: x.tile, acc: x.kw, accMono: true, data: x, g: 'Quicklinks' })))
    if (v === 'windows') groups = grp(WIN_CMDS.filter(x => has(x.title)).map(x => ({ key: x.id, title: x.title, sub: x.g, icon: x.icon, keys: rowKeys(x.id), data: x, g: x.g })))
    if (v === 'files') groups = grp((q ? fileHits.value : files.recent.value).map(x => ({ key: x.id, title: x.name, sub: x.dir, ...kindOf(x), acc: shortDate(x.modified), data: x, g: q ? 'Files' : 'Recent files' })))
    if (v === 'store') {
      groups = grp(EXTENSIONS.filter(x => !x.builtIn && has(x.name, x.desc)).map((x) => {
        const inst = installed.value.includes(x.id)
        return { key: x.id, title: x.name, sub: x.desc, icon: x.icon, tile: x.tile, acc: inst ? 'Installed' : '', accColor: inst ? 'var(--ok)' : 'var(--muted)', data: x, g: inst ? 'Installed' : 'Available' }
      }), ['Installed', 'Available'])
    }
    if (v === 'colors') groups = grp(colours.list.value.filter(x => has(formatColour(x, 'hex'), formatColour(x, 'rgb'))).map(x => ({ key: x.id, title: colourText(x), sub: formatColour(x, 'rgb'), icon: 'i-lucide-pipette', tile: formatColour(x, 'hex'), acc: shortDate(x.at), data: x, g: 'Picked' })))
    if (v === 'notes') groups = grp(notes.value.filter(x => has(x.body)).map(x => ({ key: x.id, title: x.body.split('\n')[0] || 'Untitled note', sub: x.updated, icon: 'i-lucide-sticky-note', acc: floatId.value === x.id ? 'Floating' : '', accColor: 'var(--warn)', data: x, g: 'Notes' })))
    return { groups, flat: groups.flatMap(g => g.rows) }
  })
  const curSplit = () => {
    const f = splitModel.value.flat
    return f[Math.min(s.splitSel, f.length - 1)]?.data as (SplitData & { id: string }) | undefined
  }

  const emojiModel = computed(() => {
    const q = s.splitQuery.trim().toLowerCase()
    const groups = EMOJI.map(g => ({ title: g.title, rows: g.items.filter(x => !q || x.n.includes(q)) })).filter(g => g.rows.length)
    return { groups, flat: groups.flatMap(g => g.rows) }
  })
  const curEmoji = (): Emoji | undefined => {
    const f = emojiModel.value.flat
    return f[Math.min(s.splitSel, f.length - 1)]
  }

  function screens(w: WinCmd): Detail['screens'] {
    const one = (name: string, r: number[] | null | undefined) => ({ name, win: r ? { l: r[0] + '%', t: (r[1]! * 0.9) + '%', w: r[2] + '%', h: (r[3]! * 0.9) + '%' } : null })
    return w.display ? [one('This display', null), one('Next display', [0, 0, 100, 100])] : [one('Screen', w.r ?? (w.id === 'wCenter' ? [20, 15, 60, 70] : [14, 12, 52, 60]))]
  }

  function detail(x: SplitData | undefined): Detail | null {
    const v = s.view
    if (!x) return null
    const setArg = (val: string) => { s.args = { ...s.args, [x.id]: val } }
    if (v === 'snippets') {
      const n = x as Snippet
      return { head: { icon: 'i-lucide-text-quote', title: n.name, sub: !n.kw ? 'No keyword: paste it from Esky' : settings.value.textExpansion ? `Type ${n.kw} in any app to expand` : 'Text expansion is off' }, body: { segs: phSegs(n.text), mono: n.mono }, meta: [['Keyword', n.kw, 1], ['Folder', n.folder], ['Placeholders', (n.text.match(/\{\w+\}/g) || []).join(', ') || 'None'], ['Last used', n.lastUsed ? new Date(n.lastUsed).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never']] }
    }
    if (v === 'quicklinks') {
      const n = x as Quicklink
      const val = s.args[n.id] ?? ''
      return { head: { icon: n.icon, tile: n.tile, title: n.name, sub: n.arg ? resolveQ(n, val || '…') : n.url }, input: n.arg ? { label: n.arg, val, ph: `Type a ${n.arg.toLowerCase()}`, hint: `Tip: type “${n.kw} ${n.arg.toLowerCase()}” in root search to skip this step.`, on: setArg } : null, body: { segs: phSegs(n.url), mono: true }, meta: [['Keyword', n.kw, 1], ['Opens in', n.url.startsWith('http') ? 'Your default browser' : 'File Explorer'], ['Alias', aliases.value[n.id] || 'None']] }
    }
    if (v === 'windows') {
      const n = x as WinCmd
      return { head: { icon: n.icon, title: n.title, sub: `Applies to ${s.target?.app ?? 'the window you open Esky from'}` }, screens: screens(n), meta: [['Hotkey', (rowKeys(n.id) || []).join(' + ') || 'None'], ['Display', n.display ? 'Display 1 → Display 2' : 'Display 1']] }
    }
    if (v === 'files') {
      const n = x as FileEntry
      const k = fileKind(n.name)
      const p = files.preview(n.id)
      return { head: { icon: k.icon, tile: k.tile, title: n.name, sub: n.dir }, image: p?.image ?? undefined, preview: p ? null : { ratio: '4/3', label: 'Loading preview…' }, body: p?.text ? { segs: [{ t: p.text }], mono: true } : null, meta: [['Where', n.dir, 1], ['Size', formatBytes(n.size)], ['Modified', new Date(n.modified).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })], ['Kind', k.label]] }
    }
    if (v === 'store') {
      const n = x as ExtensionDef
      const inst = installed.value.includes(n.id)
      return { head: { icon: n.icon, tile: n.tile, title: n.name, sub: `by ${n.author}`, btn: { label: inst ? 'Uninstall' : 'Install', primary: !inst, danger: inst, busy: false, run: () => inst ? askUninstall(n) : install(n) } }, desc: n.desc, items: { title: 'COMMANDS', list: n.commands.map(c => ({ t: c.title, icon: n.icon })) }, meta: [['Author', n.author], ['Version', n.ver], ['Status', inst ? (exts.isActive(n.id) ? 'Installed' : 'Installed · turned off') : 'Not installed']] }
    }
    if (v === 'colors') {
      const n = x as SavedColour
      return { head: { icon: 'i-lucide-pipette', tile: formatColour(n, 'hex'), title: colourText(n), sub: `Picked ${new Date(n.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` }, meta: [['HEX', formatColour(n, 'hex'), 1], ['RGB', formatColour(n, 'rgb'), 1], ['HSL', formatColour(n, 'hsl'), 1]] }
    }
    if (v === 'notes') {
      const n = x as Note
      const words = n.body.trim() ? n.body.trim().split(/\s+/).length : 0
      return { edit: { val: n.body, on: val => editNote(n.id, val) }, meta: [['Updated', n.updated], ['Words', String(words)], ['Floating', floatId.value === n.id ? 'Yes' : 'No']] }
    }
    return null
  }

  const aiCmd = () => AI_CMDS.find(c => c.id === (s.ai ? s.ai.cmd : 'grammar'))!

  const actionsModel = computed(() => {
    let target = ''
    let list: ActionDef[] = []
    const O = (id: string, title: string, icon: string, keys: string[], danger?: boolean): ActionDef => ({ id, title, icon, keys, danger })
    if (s.view === 'search') {
      const e = searchModel.value.flat[s.sel]
      target = e ? e.title : ''
      const fav = !!e?.id && favs.value.includes(e.id)
      // Only results with a file behind them (apps with a known .exe, Herd sites) can be revealed or run elevated.
      list = [O('open', 'Open', 'i-lucide-corner-down-left', ['↵']), ...(e?.path && e.kind === 'app' ? [O('admin', 'Run as Administrator', 'i-lucide-shield', ['Ctrl', 'Shift', '↵'])] : []), ...(e?.path ? [O('reveal', 'Reveal in Explorer', 'i-lucide-folder-search', ['Ctrl', 'Shift', 'E']), O('path', 'Copy Path', 'i-lucide-copy', ['Ctrl', 'Shift', 'C'])] : []), O('pin', fav ? 'Unpin from Favourites' : 'Pin to Favourites', 'i-lucide-pin', ['Ctrl', 'Shift', 'P']), O('alias', 'Add Alias', 'i-lucide-at-sign', ['Ctrl', 'Shift', 'A']), O('hotkey', 'Set Hotkey', 'i-lucide-keyboard', ['Ctrl', 'Shift', 'H']), O('disable', 'Disable Result', 'i-lucide-eye-off', ['Ctrl', 'Shift', 'D'], true)]
    } else if (s.view === 'clipboard') {
      const c = curClip()
      target = c ? trunc(clipPreview(c), 40) : 'Clipboard'
      list = [O('cpaste', s.target ? `Paste into ${s.target.app}` : 'Copy and Close', 'i-lucide-clipboard-paste', ['↵']), O('ccopy', 'Copy', 'i-lucide-copy', ['Ctrl', 'C']), O('cpin', c?.pinned ? 'Unpin' : 'Pin', 'i-lucide-pin', ['Ctrl', 'P']), O('cdelete', 'Delete', 'i-lucide-trash-2', ['Ctrl', '⌫'], true), O('cclear', 'Clear History', 'i-lucide-eraser', [], true)]
    } else if (s.view === 'forgeList' || s.view === 'forgeDetail') {
      const sv = s.view === 'forgeList' ? forgeModel.value.flat[s.forgeSel] : s.server
      target = sv ? sv.name : ''
      list = [...(s.view === 'forgeList' ? [O('fopen', 'Show Details', 'i-lucide-panel-right', ['↵'])] : []), O('fdeploy', 'Deploy Site', 'i-lucide-rocket', ['Ctrl', 'D']), O('fforge', 'Open in Forge', 'i-lucide-external-link', ['Ctrl', 'O']), O('fip', 'Copy IP Address', 'i-lucide-copy', ['Ctrl', 'Shift', 'C']), O('fssh', 'SSH into Server', 'i-lucide-square-terminal', ['Ctrl', 'Shift', 'S'])]
    } else if (s.view === 'chat') {
      target = s.chatTitle
      list = [O('newchat', 'New Chat', 'i-lucide-square-pen', ['Ctrl', 'N']), O('togglechats', s.showChats ? 'Hide Chat List' : 'Show Chat List', 'i-lucide-panel-left', ['Ctrl', 'B']), O('attach', 'Attach Clipboard', 'i-lucide-paperclip', ['Ctrl', 'Shift', 'V'])]
    } else if (s.view === 'herdList') {
      const x = curSite()
      target = x ? x.name : 'Herd Sites'
      list = [O('hopen', 'Open in Browser', 'i-lucide-globe', ['↵']), O('hcode', `Open in ${herdEditor().name}`, 'i-lucide-code-xml', ['Ctrl', 'O']), O('hreveal', 'Reveal in Explorer', 'i-lucide-folder-search', ['Ctrl', 'Shift', 'E']), O('hurl', 'Copy URL', 'i-lucide-link', ['Ctrl', 'Shift', 'C']), O('hpath', 'Copy Path', 'i-lucide-copy', ['Ctrl', 'Shift', 'P']), O('hreload', 'Reload Sites', 'i-lucide-refresh-cw', ['Ctrl', 'R'])]
    } else if (s.view === 'gitList') {
      const r = curRepo()
      target = r ? r.name : 'Uncommitted Changes'
      list = [O('gopen', `Open in ${editorFor('git').name}`, 'i-lucide-code-xml', ['↵']), O('gterm', 'Open in Terminal', 'i-lucide-square-terminal', ['Ctrl', 'T']), O('greveal', 'Reveal in Explorer', 'i-lucide-folder-search', ['Ctrl', 'Shift', 'E']), O('gpath', 'Copy Path', 'i-lucide-copy', ['Ctrl', 'Shift', 'C']), O('greload', 'Check Again', 'i-lucide-refresh-cw', ['Ctrl', 'R'])]
    } else if (s.view === 'remoteList') {
      const r = curRemote()
      const src = remote.source.value
      target = r?.title ?? src?.title ?? ''
      const jira = src?.ext === 'jira'
      list = [
        ...(src?.cmd === 'work' ? [O('rlog', 'Log Work', 'i-lucide-timer', ['↵']), O('ropen', 'Open in Browser', 'i-lucide-external-link', ['Ctrl', 'O'])] : [O('ropen', 'Open in Browser', 'i-lucide-external-link', ['↵'])]),
        ...(jira && src?.cmd !== 'work' ? [O('rlog', 'Log Work', 'i-lucide-timer', ['Ctrl', 'L'])] : []),
        O('rcopy', r?.copy && r.copy !== r.url ? (jira ? 'Copy Issue Key' : src?.cmd === 'repos' ? 'Copy Clone URL' : 'Copy ID') : 'Copy Link', 'i-lucide-copy', ['Ctrl', 'Shift', 'C']),
        O('rreload', 'Refresh', 'i-lucide-refresh-cw', ['Ctrl', 'R'])
      ]
    } else if (s.view === 'dockerList') {
      const r = curDocker()
      const k = docker.kind.value
      target = r?.title ?? 'Docker'
      list = k === 'images'
        ? [O('dcopy', 'Copy Image ID', 'i-lucide-copy', ['↵']), O('dreload', 'Refresh', 'i-lucide-refresh-cw', ['Ctrl', 'R']), O('dremove', 'Remove Image', 'i-lucide-trash-2', ['Ctrl', '⌫'], true)]
        : [
            O('dprimary', r?.running ? 'Stop' : 'Start', r?.running ? 'i-lucide-square' : 'i-lucide-play', ['↵']),
            O('drestart', 'Restart', 'i-lucide-rotate-ccw', ['Ctrl', 'Shift', 'R']),
            ...(k === 'containers' ? [O('dlogs', 'Show Logs', 'i-lucide-scroll-text', ['Ctrl', 'L']), O('dcopy', 'Copy Container ID', 'i-lucide-copy', ['Ctrl', 'Shift', 'C'])] : []),
            O('dreload', 'Refresh', 'i-lucide-refresh-cw', ['Ctrl', 'R']),
            ...(k === 'containers' ? [O('dremove', 'Remove Container', 'i-lucide-trash-2', ['Ctrl', '⌫'], true)] : [])
          ]
    } else if (s.view === 'password') {
      target = pw.opts.value.type === 'password' ? 'Password' : 'Passphrase'
      list = [O('pwcopy', 'Copy and Close', 'i-lucide-copy', ['↵']), O('pwnew', 'Generate Another', 'i-lucide-refresh-cw', ['Ctrl', 'R']), O('pwtype', pw.opts.value.type === 'password' ? 'Switch to Passphrase' : 'Switch to Password', 'i-lucide-arrow-left-right', ['Ctrl', 'T'])]
    } else if (s.view === 'dictionary') {
      target = dict.entry?.word || 'Dictionary'
      list = [O('dcopy', 'Copy Definition', 'i-lucide-copy', ['↵']), O('dword', 'Copy Word', 'i-lucide-type', ['Ctrl', 'Shift', 'C']), O('dopen', 'Open in Wiktionary', 'i-lucide-external-link', ['Ctrl', 'O'])]
    } else if (s.view === 'aiResult') {
      target = aiCmd().title
      list = s.ai?.needsInput ? [O('airun', 'Run', 'i-lucide-play', ['↵'])] : [s.target ? O('aipaste', `Paste into ${s.target.app}`, 'i-lucide-clipboard-paste', ['↵']) : O('aipaste', 'Copy and Close', 'i-lucide-clipboard-copy', ['↵']), O('aicopy', 'Copy', 'i-lucide-copy', ['Ctrl', 'C']), O('aichat', 'Continue in Chat', 'i-lucide-message-square', ['Tab']), O('regen', 'Regenerate', 'i-lucide-refresh-cw', ['Ctrl', 'R'])]
    } else if (SPLIT[s.view] || s.view === 'emoji') {
      const x = s.view === 'emoji' ? curEmoji() : curSplit()
      const any = x as Record<string, any> | undefined
      target = any ? (any.name || any.title || (any.body != null ? (any.body.split('\n')[0] || 'Untitled note') : any.n)) : ''
      const sx = x as (SplitData & { id: string }) | undefined
      list = ({
        snippets: [O('split', 'Paste', 'i-lucide-clipboard-paste', ['↵']), O('sncopy', 'Copy', 'i-lucide-copy', ['Ctrl', 'C']), O('snexpand', settings.value.textExpansion ? 'Turn Off Text Expansion' : 'Turn On Text Expansion', 'i-lucide-keyboard', []), O('snedit', 'Edit Snippets', 'i-lucide-pencil', ['Ctrl', 'E'])],
        quicklinks: [O('split', 'Open', 'i-lucide-external-link', ['↵']), O('qedit', 'Edit Quicklinks', 'i-lucide-pencil', ['Ctrl', 'E']), O('qcopy', 'Copy URL', 'i-lucide-copy', ['Ctrl', 'Shift', 'C']), O('alias', 'Add Alias', 'i-lucide-at-sign', ['Ctrl', 'Shift', 'A']), O('hotkey', 'Set Hotkey', 'i-lucide-keyboard', ['Ctrl', 'Shift', 'H'])],
        windows: [O('split', 'Apply Layout', 'i-lucide-app-window', ['↵']), O('hotkey', 'Set Hotkey', 'i-lucide-keyboard', ['Ctrl', 'Shift', 'H'])],
        files: [O('split', 'Open', 'i-lucide-corner-down-left', ['↵']), O('fwith', 'Open With Visual Studio Code', 'i-lucide-code-xml', ['Ctrl', 'O']), O('fpath', 'Copy Path', 'i-lucide-copy', ['Ctrl', 'Shift', 'C']), O('freveal', 'Reveal in Explorer', 'i-lucide-folder-search', ['Ctrl', 'Shift', 'E']), O('fattach', 'Attach to AI Chat', 'i-lucide-sparkles', ['Ctrl', 'Shift', 'A'])],
        store: sx && installed.value.includes(sx.id) ? [O('split', 'Configure', 'i-lucide-settings', ['↵']), O('xuninstall', 'Uninstall', 'i-lucide-trash-2', ['Ctrl', '⌫'], true)] : [O('split', 'Install', 'i-lucide-download', ['↵'])],
        colors: [O('split', 'Copy', 'i-lucide-copy', ['↵']), O('colhex', 'Copy HEX', 'i-lucide-hash', []), O('colrgb', 'Copy RGB', 'i-lucide-palette', []), O('colhsl', 'Copy HSL', 'i-lucide-palette', []), O('colpick', 'Pick New Colour', 'i-lucide-pipette', ['Ctrl', 'N']), O('coldelete', 'Delete', 'i-lucide-trash-2', ['Ctrl', '⌫'], true)],
        notes: [O('nnew', 'New Note', 'i-lucide-square-pen', ['Ctrl', 'N']), O('nfloat', sx && floatId.value === sx.id ? 'Stop Floating' : 'Float on Desktop', 'i-lucide-picture-in-picture-2', ['Ctrl', 'Shift', 'F']), O('ndelete', 'Delete Note', 'i-lucide-trash-2', ['Ctrl', '⌫'], true)],
        emoji: [O('epaste', 'Paste', 'i-lucide-clipboard-paste', ['↵']), O('ecopy', 'Copy', 'i-lucide-copy', ['Ctrl', 'C'])]
      } as Record<string, ActionDef[]>)[s.view]!
    } else {
      target = 'Deploy Site'
      list = [O('deploy', 'Deploy', 'i-lucide-rocket', ['Ctrl', '↵']), O('back', 'Cancel', 'i-lucide-x', ['Esc'])]
    }
    const q = s.actionsQuery.trim().toLowerCase()
    if (q) list = list.filter(a => a.title.toLowerCase().includes(q))
    return { target, list }
  })

  // ---------- navigation ----------

  function go(view: View, extra: Partial<typeof s> = {}) {
    cancelRun()
    Object.assign(s, { open: true, view, sel: 0, actionsOpen: false, stream: null }, extra)
  }

  function openWin() {
    Object.assign(s, { open: true, view: 'search', query: '', sel: 0, actionsOpen: false })
  }


  /**
   * Remember the app in front (so Paste can go back to it) and read what's selected there, for
   * Quick AI. Used when Esky opens from a hotkey; the tray has no app to come back to.
   */
  async function captureFrom(readSelection: boolean) {
    s.target = null
    s.selection = null
    if (!isTauri()) return
    try {
      const t = await captureTarget(readSelection)
      if (!t.app_path) return
      const app = appName(t.app_path)
      s.target = { app }
      if (t.selection) s.selection = { text: t.selection, app }
    } catch {
      // Opening Esky matters more than the selection.
    }
  }

  /** Esky's hotkey. */
  async function openFromHotkey() {
    await captureFrom(settings.value.readSelection)
    openWin()
  }

  /** The tray, or a second launch of Esky. */
  function openFromTray() {
    s.target = null
    s.selection = null
    clearTarget()
    openWin()
  }

  /** A command's own hotkey, pressed while Esky is hidden. Quick AI commands work on the selection. */
  async function activateFromHotkey(id: string) {
    await captureFrom(!!ITEMS[id]?.ai && settings.value.readSelection)
    activate(id)
  }

  /** Paste a Clipboard History entry (text, image or files) back into the app Esky was opened from. */
  function pasteClip(c: ClipEntry) {
    const what = trunc(clipPreview(c), 40)
    if (!isTauri() || !s.target) return closeWith(`Copied “${what}”. Paste it with Ctrl V.`, () => clipboard.copy(c))
    const app = s.target.app
    closeWith(`Pasted “${what}” into ${app}`, () => clipboard.paste(c).catch((e) => {
      clipboard.copy(c)
      s.open = true
      toast('error', `Couldn’t paste into ${app}`, `${String(e)}. It's on the clipboard instead.`)
    }))
  }

  /** A snippet's text with {date}, {time} and {clipboard} filled in, and {cursor} dropped. */
  async function snippetText(text: string) {
    const now = new Date()
    let out = text
      .replace(/\{date\}/g, now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }))
      .replace(/\{time\}/g, now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))
      .replace(/\{cursor\}/g, '')
    if (out.includes('{clipboard}')) out = out.replace(/\{clipboard\}/g, await readClipboardText())
    return out
  }

  // ---------- Docker ----------

  const docker = useDocker()
  const forge = useForge()
  const dockerModel = computed(() => {
    const q = s.dockerQuery.trim().toLowerCase()
    return docker.rows.value.filter(r => !q || r.title.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q))
  })
  const curDocker = () => dockerModel.value[Math.min(s.dockerSel, Math.max(0, dockerModel.value.length - 1))]

  function openDocker(kind: DockerKind) {
    go('dockerList', { dockerQuery: '', dockerSel: 0 })
    docker.load(kind)
  }

  /** Run a Docker action on the selected row, with a toast for the result. */
  function dockerDo(action: string, label: string) {
    const r = curDocker()
    if (!r) return
    docker.act(action, r.id)
      .then(() => action !== 'logs' && toast('success', `${label}: ${r.title}`))
      .catch(e => toast('error', `Couldn’t ${label.toLowerCase()} ${r.title}`, String(e)))
  }

  // ---------- GitHub, Jira, Sentry ----------

  const remote = useRemote()
  const sources = remoteSources()
  const remoteModel = computed(() => {
    const src = remote.source.value
    const q = s.remoteQuery.trim().toLowerCase()
    // Live sources search on the server; the others filter what's loaded.
    if (!src || src.live || !q) return remote.rows.value
    return remote.rows.value.filter(r => r.title.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q))
  })
  const curRemote = () => remoteModel.value[Math.min(s.remoteSel, Math.max(0, remoteModel.value.length - 1))]

  function openRemote(key: string) {
    const src = sources[key]
    if (!src) return
    go('remoteList', { remoteQuery: '', remoteSel: 0 })
    remote.load(src)
  }

  let remoteTimer: ReturnType<typeof setTimeout> | undefined
  watch(() => s.remoteQuery, (q) => {
    const src = remote.source.value
    if (s.view !== 'remoteList' || !src?.live) return
    clearTimeout(remoteTimer)
    remoteTimer = setTimeout(() => {
      remote.load(src, q)
      s.remoteSel = 0
    }, 350)
  })

  function openLogWork() {
    const r = curRemote()
    if (r && remote.source.value?.ext === 'jira') s.logWork = { key: r.id, title: r.title, time: '', comment: '', error: '', busy: false }
  }

  async function submitLogWork() {
    const w = s.logWork
    if (!w || w.busy) return
    if (!/^\s*(\d+(\.\d+)?\s*[wdhm]\s*)+$/i.test(w.time)) {
      s.logWork = { ...w, error: 'Use Jira’s format, e.g. 1h 30m, 45m or 2d.' }
      return
    }
    s.logWork = { ...w, busy: true, error: '' }
    try {
      await jiraLogWork(w.key, w.time.trim(), w.comment)
      s.logWork = null
      toast('success', `Logged ${w.time.trim()} on ${w.key}`)
    } catch (e) {
      s.logWork = { ...w, busy: false, error: String(e) }
    }
  }

  // ---------- Colour Picker ----------

  const colours = useColours()
  /** The "Copy as" preference, and HEX case. */
  const colourFormat = () => (exts.prefsFor('colour').format || 'hex') as ColourFormat
  const colourText = (c: SavedColour) => formatColour(c, colourFormat(), exts.prefsFor('colour').upper !== false)

  function copyColour(c: SavedColour, format: ColourFormat) {
    const text = formatColour(c, format, exts.prefsFor('colour').upper !== false)
    copyText(text)
    toast('success', `Copied ${text}`)
  }

  /** Hide, wait for a click anywhere, then copy that colour and show it in Saved Colours. */
  function pickColour() {
    if (!isTauri()) return toast('info', 'The Colour Picker works in the desktop app')
    closeWith('Click anywhere to pick a colour. Esc cancels.', async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const picked = await invoke<{ r: number, g: number, b: number } | null>('colour_pick')
        if (!picked) return
        const c = colours.add(picked)
        go('colors', { splitQuery: '', splitSel: 0 })
        copyColour(c, colourFormat())
      } catch (e) {
        s.open = true
        toast('error', 'Couldn’t pick a colour', String(e))
      }
    })
  }

  // ---------- Media Controls ----------

  /** Play/pause or skip in whatever is playing (Spotify only, if that's the preference). */
  async function controlMedia(action: 'toggle' | 'next' | 'previous') {
    if (!isTauri()) return toast('info', 'Media Controls work in the desktop app')
    const spotifyOnly = exts.prefsFor('spotify').player === 'spotify'
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const now = await invoke<{ title: string, artist: string, playing: boolean }>('media_control', { action, spotifyOnly })
      const what = [now.title, now.artist].filter(Boolean).join(' · ')
      closeWith(now.playing ? `Playing ${what}` : `Paused ${what}`)
    } catch (e) {
      toast('error', 'Couldn’t control playback', String(e))
    }
  }

  /** Typed-keyword expansion (desktop app): Rust watches for the keywords and asks for the text. */
  async function startExpansion() {
    if (!isTauri()) return
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    await sn.ready
    watch(() => settings.value.textExpansion ? sn.list.value.map(x => x.kw).filter(Boolean) : [], keywords => invoke('snippet_keywords', { keywords }), { immediate: true, deep: true })
    await listen<string>('snippet://typed', async (e) => {
      const n = sn.list.value.find(x => x.kw === e.payload)
      if (!n) return
      sn.used(n.id)
      invoke('snippet_expand', { keywordChars: [...e.payload].length, text: await snippetText(n.text) })
        .catch(err => toast('error', `Couldn’t expand ${n.kw}`, String(err)))
    })
  }

  async function pasteSnippet(n: Snippet) {
    sn.used(n.id)
    pasteText(await snippetText(n.text), n.name)
  }

  /**
   * Put `text` into the app Esky was opened from (as if typed), then hide. Without one (opened from
   * the tray, or the browser preview) it's copied instead, ready for Ctrl V.
   */
  function pasteText(text: string, what: string) {
    if (!isTauri() || !s.target) return closeWith(`Copied ${what}. Paste it with Ctrl V.`, () => copyText(text))
    const app = s.target.app
    closeWith(`Pasted ${what} into ${app}`, () => pasteToTarget(text).catch((e) => {
      copyText(text)
      s.open = true
      toast('error', `Couldn’t paste into ${app}`, `${String(e)}. It's on the clipboard instead.`)
    }))
  }

  /** Run the action, then hide Esky. `msg` describes what happened (shown as a notice in the browser build). */
  function closeWith(msg: string, effect?: () => unknown) {
    Object.assign(s, { open: false, notice: msg, actionsOpen: false, selection: null })
    clearTimeout(nt)
    nt = setTimeout(() => { s.notice = '' }, 2800)
    effect?.()
  }

  function copyCard(c: QuickCard) {
    copyText(c.copy)
    toast('success', `Copied ${c.copy}`, c.caption.replace(/ =$/, ''))
  }

  /** Open an installed app (or run it as administrator), then hide Esky. If Windows refuses, Esky comes back with the reason. */
  function launchApp(id: string, admin = false) {
    const it = ITEMS[id]
    if (!it?.app) return
    const app = it.app
    if (admin) {
      usage.value = { ...usage.value, [id]: (usage.value[id] || 0) + 1 }
      recent.value = [id, ...recent.value.filter(x => x !== id)].slice(0, 5)
    }
    closeWith(`Opened ${it.title}${admin ? ' as administrator' : ''}`, () => apps.launch(app, admin).catch((e) => {
      s.open = true
      toast('error', `Couldn’t open ${it.title}`, admin ? 'Windows didn’t start it as administrator (the prompt may have been cancelled).' : String(e))
    }))
  }

  function activate(id: string) {
    const it = ITEMS[id]!
    usage.value = { ...usage.value, [id]: (usage.value[id] || 0) + 1 }
    recent.value = [id, ...recent.value.filter(x => x !== id)].slice(0, 5)
    if (it.app) return launchApp(id)
    if ((it.go && SPLIT[it.go]) || it.go === 'emoji') return go(it.go as View, { splitQuery: '', splitSel: 0 })
    if (it.go === 'onboard') return Object.assign(s, { open: true, actionsOpen: false, onb: onbStart() })
    if (it.qlink) {
      const q = it.qlink
      if (!q.arg) return closeWith(`Opened ${q.url}`, () => openUrl(q.url))
      go('quicklinks', { splitQuery: '', splitSel: Math.max(0, qls.list.value.findIndex(x => x.id === q.id)) })
      return focusArg()
    }
    if (it.snip) return pasteSnippet(it.snip)
    if (it.win) return applyWin(it.win)
    const ec = !it.go ? commandFor(id) : null
    if (ec) {
      if (ec.cmd.needs && needsSetup(ec.ext, ec.cmd.needs)) return
      if (ec.cmd.url) {
        const url = ec.cmd.url(exts.prefsFor(ec.ext.id))
        return closeWith(`Opened ${ec.ext.name} › ${ec.cmd.title}`, () => openUrl(url))
      }
      if (ec.ext.id === 'docker') return openDocker(ec.cmd.id as DockerKind)
      if (ec.ext.id === 'github' || ec.ext.id === 'sentry') return openRemote(ec.cmd.id)
      if (ec.ext.id === 'jira') return openRemote(`jira:${ec.cmd.id}`)
      if (ec.ext.id === 'spotify') return controlMedia(ec.cmd.id === 'prev' ? 'previous' : ec.cmd.id as 'toggle' | 'next')
      if (ec.ext.id === 'colour') return ec.cmd.id === 'pick' ? pickColour() : go('colors', { splitQuery: '', splitSel: 0 })
      return closeWith(`Opened ${it.sub} › ${it.title}`)
    }
    if (id === 'emptyBin') return askEmptyBin()
    if (SYS_CONFIRM[id]) return Object.assign(s, { open: true, confirm: sysConfirm(id) })
    if (id === 'sleep') return closeWith('Going to sleep…', () => runSystem('sleep'))
    if (id === 'lock') return closeWith('Screen locked', () => runSystem('lock'))
    // Windows has no public API for Do Not Disturb, so open the page where it's one click.
    if (id === 'dnd') return closeWith('Opened notification settings', () => openUrl('ms-settings:notifications'))
    if (id === 'eject') return ejectAll()
    if (it.go === 'clipboard') return go('clipboard', { clipQuery: '', clipSel: 0 })
    if (it.go === 'chat') return openChat('')
    if (it.go === 'forgeList') return openForgeList()
    if (it.go === 'herdList') return openHerd()
    if (it.go === 'gitList') return openGit()
    if (it.go === 'password') return openPassword()
    if (it.go === 'dictionary') return openDictionary()
    if (it.go === 'deploy') return openDeployDefault()
    if (it.go === 'theme') {
      colorMode.preference = theme() === 'dark' ? 'light' : 'dark'
      return
    }
    if (it.go === 'settings') return openSettings()
    if (it.go === 'shortcuts') return openSettings({ tab: 'shortcuts' })
    if (it.ai) return runAi(it.ai)
    closeWith(`Opened ${it.title}`)
  }

  function back() {
    if (s.view === 'search') {
      if (s.query) Object.assign(s, { query: '', sel: 0 })
      else if (s.selection) Object.assign(s, { selection: null, sel: 0 })
      else s.open = false
      return
    }
    if (s.view === 'forgeDetail') return go('forgeList')
    if (s.view === 'deploy') return go(s.deployFrom)
    go('search', { query: '' })
  }

  // ---------- split views ----------

  const focusArg = () => setTimeout(() => els.arg?.focus(), 40)

  function runSplit() {
    const x = curSplit()
    if (!x) return
    switch (s.view) {
      case 'snippets': {
        const n = x as Snippet
        return pasteSnippet(n)
      }
      case 'quicklinks': {
        const n = x as Quicklink
        const a = (s.args[n.id] || '').trim()
        if (n.arg && !a) {
          toast('info', `Enter a ${n.arg.toLowerCase()} first`)
          return focusArg()
        }
        const url = n.arg ? resolveQ(n, a) : n.url
        return closeWith(`Opened ${url}`, () => openUrl(url))
      }
      case 'windows': return applyWin(x as WinCmd)
      case 'files': return closeWith(`Opened ${(x as FileEntry).name}`, () => openUrl(x.id))
      case 'store':
        if (installed.value.includes(x.id)) return openSettings({ tab: 'extensions', ext: x.id })
        return install(x as ExtensionDef)
      case 'colors': return copyColour(x as SavedColour, colourFormat())
      case 'notes':
        setTimeout(() => els.note?.focus(), 40)
    }
  }

  /** Arrange the window Esky was opened from. */
  function applyWin(w: WinCmd) {
    const layout = w.display ? 'next-display' : w.id === 'wMax' ? 'maximize' : w.id === 'wRestore' ? 'restore' : w.id === 'wCenter' ? 'center' : 'rect'
    if (!isTauri() || !s.target) {
      return toast('info', 'Open Esky from the window to arrange', 'Press your Esky hotkey (or this layout’s hotkey) while that window is in front.')
    }
    const app = s.target.app
    closeWith(`${app} · ${w.title}`, () => windowLayout(layout, w.r).catch((e) => {
      s.open = true
      toast('error', `Couldn’t arrange ${app}`, String(e))
    }))
  }

  /** Extensions ship with Esky, so installing just adds their commands to search. */
  function install(x: ExtensionDef) {
    exts.install(x.id)
    const n = x.commands.length
    const required = x.prefs.some(f => f.required)
    toast('success', `Installed ${x.name}`, `${n} command${n > 1 ? 's' : ''} added to search${required ? '. It needs setting up before use.' : ''}`, required ? { label: 'Set up', run: () => openSettings({ tab: 'extensions', ext: x.id }) } : null)
  }

  function askUninstall(x: ExtensionDef) {
    s.confirm = { title: `Uninstall ${x.name}?`, desc: `Its ${x.commands.length} commands will be removed from search. Your preferences are kept in case you reinstall.`, label: 'Uninstall', run: () => {
      exts.uninstall(x.id)
      toast('info', `Uninstalled ${x.name}`)
    } }
  }

  function editNote(id: string, body: string) {
    notes.value = notes.value.map(n => n.id === id ? { ...n, body, updated: 'Just now' } : n)
  }

  function newNote() {
    const id = 'n' + Date.now()
    notes.value = [{ id, body: '', updated: 'Just now' }, ...notes.value]
    s.splitSel = 0
    s.splitQuery = ''
    setTimeout(() => els.note?.focus(), 40)
  }

  function toggleFloat() {
    const x = curSplit()
    if (!x) return
    const on = floatId.value !== x.id
    floatId.value = on ? x.id : null
    toast('success', on ? 'Floating on desktop' : 'Stopped floating', on ? 'The note stays on top of other windows, even when Esky is closed.' : '')
  }

  function deleteNote() {
    const x = curSplit() as Note | undefined
    if (!x) return
    const old = notes.value
    notes.value = notes.value.filter(n => n.id !== x.id)
    if (floatId.value === x.id) floatId.value = null
    s.splitSel = 0
    toast('info', 'Note deleted', trunc(x.body.split('\n')[0] || 'Untitled note', 40), { label: 'Undo', run: () => { notes.value = old } })
  }

  // ---------- hotkeys, aliases, confirm, onboarding ----------

  function recordKey(e: KeyboardEvent) {
    const h = s.hk!
    const k = e.key
    if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(k)) return
    const plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
    if (plain && k === 'Escape') {
      s.hk = null
      return
    }
    if (plain && k === 'Enter') return saveHk()
    if (plain && k === 'Backspace') {
      s.hk = { ...h, combo: null, conflict: '', ownerId: null, reserved: false, note: '' }
      return
    }
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      s.hk = { ...h, note: 'Include Ctrl, Alt or Win in the combination.' }
      return
    }
    const combo = comboOf(e)
    const c = hk.check(combo, h.id)
    if (c.error) {
      s.hk = { ...h, combo, reserved: true, ownerId: null, conflict: c.error, note: '' }
      return
    }
    const owner = c.ownerId ?? null
    s.hk = { ...h, combo, reserved: false, ownerId: owner, conflict: owner ? `Already used by ${ITEMS[owner]!.title}. Saving moves the hotkey here.` : c.warning ? `${c.warning} Esky would override it.` : '', note: '' }
  }

  function saveHk() {
    const h = s.hk
    if (!h || !h.combo || h.reserved) return
    hk.assign(h.id, h.combo)
    s.hk = null
    toast('success', 'Hotkey saved', `${h.combo.join(' + ')} · ${h.title}${h.ownerId ? ` (removed from ${ITEMS[h.ownerId]!.title})` : ''}`)
  }

  function clearHk() {
    const h = s.hk
    if (!h) return
    hk.assign(h.id, [])
    s.hk = null
    toast('info', 'Hotkey removed', h.title)
  }

  function saveAl() {
    const al = s.al
    if (!al) return
    const v = al.value.trim().toLowerCase()
    const owner = v ? aliasOwner(v, al.id) : null
    const a = { ...aliases.value }
    if (owner) delete a[owner]
    if (v) a[al.id] = v
    else delete a[al.id]
    aliases.value = a
    s.al = null
    toast('success', v ? 'Alias saved' : 'Alias removed', v ? `Type “${v}” to open ${al.title}` : al.title)
  }

  /** Run a system action; if Windows refuses, Esky comes back and says why. */
  function runSystem(action: SystemAction) {
    systemAction(action).catch((e) => {
      s.open = true
      toast('error', 'Windows didn’t do that', String(e))
    })
  }

  function sysConfirm(id: string) {
    const [title, desc, label, msg] = SYS_CONFIRM[id]!
    return { title, desc, label, run: () => closeWith(msg, () => runSystem(id as SystemAction)) }
  }

  /** Confirm with the Recycle Bin's real contents first. */
  async function askEmptyBin() {
    try {
      const bin = await recycleBinInfo()
      if (!bin.items) return toast('info', 'The Recycle Bin is already empty')
      const what = `${bin.items.toLocaleString()} item${bin.items === 1 ? '' : 's'} (${formatBytes(bin.bytes)})`
      s.confirm = { title: 'Empty Recycle Bin?', desc: `${what} will be permanently deleted.`, label: 'Empty Recycle Bin', run: () => {
        systemAction('emptyBin')
          .then(() => toast('success', 'Recycle Bin emptied', `${formatBytes(bin.bytes)} freed`))
          .catch(e => toast('error', 'Couldn’t empty the Recycle Bin', String(e)))
      } }
    } catch (e) {
      toast('error', 'Couldn’t read the Recycle Bin', String(e))
    }
  }

  /** Eject every removable drive the way File Explorer does. */
  async function ejectAll() {
    try {
      const drives = await removableDrives()
      if (!drives.length) return toast('info', 'No removable drives', 'Nothing to eject.')
      const results = await Promise.allSettled(drives.map(d => ejectDrive(d.letter)))
      const name = (d: { letter: string, label: string }) => d.label ? `${d.label} (${d.letter})` : d.letter
      const done = drives.filter((_, i) => results[i]!.status === 'fulfilled')
      const failed = drives.filter((_, i) => results[i]!.status === 'rejected')
      if (done.length) toast('success', 'Safe to remove', done.map(name).join(', '))
      if (failed.length) toast('error', 'Couldn’t eject', `${failed.map(name).join(', ')}. Close any files open on it and try again.`)
    } catch (e) {
      toast('error', 'Couldn’t eject drives', String(e))
    }
  }

  function cfOk() {
    const c = s.confirm
    s.confirm = null
    c?.run()
  }

  /** Onboarding opened from your current settings. */
  function onbStart() {
    const st = settings.value
    const hk = ONB_HK.findIndex(([keys]) => keys.join('+') === st.hotkey.join('+'))
    return { step: 0, hk: Math.max(0, hk), tg: { apps: st.desktopApps, store: st.storeApps, herd: exts.isActive('herd'), sel: st.readSelection, clip: st.clipHistory, expand: st.textExpansion, startup: st.startLogin } }
  }

  function onbNext() {
    const o = s.onb
    if (!o) return
    if (o.step < 3) {
      s.onb = { ...o, step: o.step + 1 }
      return
    }
    s.onb = null
    onboarded.value = true
    const t = o.tg
    settings.value = { ...settings.value, hotkey: ONB_HK[o.hk]![0], startLogin: !!t.startup, desktopApps: !!t.apps, storeApps: !!t.store, readSelection: !!t.sel, clipHistory: !!t.clip, textExpansion: !!t.expand }
    exts.setEnabled('herd', !!t.herd)
    toast('success', 'Setup complete', `Press ${ONB_HK[o.hk]![0].join(' + ')} to open Esky.`)
  }

  function onbBack() {
    const o = s.onb
    if (o && o.step) s.onb = { ...o, step: o.step - 1 }
    else onbSkip()
  }

  function onbSkip() {
    s.onb = null
    onboarded.value = true
  }

  // ---------- AI ----------

  // Real AI goes through the user's Claude Code (useClaude). Chats are saved and continue the same
  // Claude session; Quick AI runs once per command without a session.

  let run: ClaudeRun | null = null

  /** Stop whatever Claude is writing (Esc, new chat, switching chats or views). */
  function cancelRun() {
    run?.cancel()
    run = null
    if (s.stream && !s.stream.done) s.stream = null
  }

  const plainText = (m: ChatMsg) => m.blocks.map(b => b.type === 'p' ? b.text : b.type === 'list' ? b.items.map(x => `- ${x}`).join('\n') : '```' + b.lang + '\n' + b.code + '\n```').join('\n\n')

  const currentChat = () => chats.value.find(c => c.id === s.chatId)

  /** Write the open conversation into the saved chat list (most recent first, 50 kept). */
  function saveChat(patch: Partial<SavedChat> = {}) {
    if (!s.chatId || !s.messages.length) return
    const prev = currentChat()
    const entry: SavedChat = { ...(prev ?? { id: s.chatId }), title: s.chatTitle, messages: s.messages, updated: Date.now(), ...patch }
    chats.value = [entry, ...chats.value.filter(c => c.id !== s.chatId)].slice(0, 50)
  }

  /** Saved chats for the sidebar, grouped by day. */
  const chatGroups = computed(() => {
    const today = new Date().setHours(0, 0, 0, 0)
    const groups: [string, (t: number) => boolean][] = [['Today', t => t >= today], ['Yesterday', t => t >= today - 864e5], ['Earlier', () => true]]
    const left = [...chats.value].sort((a, b) => b.updated - a.updated)
    return groups.map(([g, test]) => {
      const items = left.filter(c => test(c.updated))
      items.forEach(c => left.splice(left.indexOf(c), 1))
      return { g, items }
    }).filter(x => x.items.length)
  })

  /** Is Claude Code installed and signed in? Drives the "Connect Claude Code" screen. */
  async function checkClaude() {
    s.checking = true
    const st = await claude.status()
    s.checking = false
    s.claudeStatus = st
    s.setupStep = !st.installed ? 0 : !st.loggedIn ? 1 : 2
    s.claudeReady = s.setupStep === 2
    return st
  }

  // Switching backend in Settings → AI changes what "ready" means.
  watch(() => settings.value.backend, () => {
    s.claudeStatus = null
    checkClaude()
  })

  function startNewChat() {
    Object.assign(s, { chatId: `chat${Date.now()}`, messages: [], chatTitle: 'New chat', attach: null, attachText: '' })
  }

  function openSavedChat(id: string) {
    const c = chats.value.find(x => x.id === id)
    if (!c) return
    cancelRun()
    Object.assign(s, { chatId: c.id, messages: c.messages, chatTitle: c.title, stream: null, chatInput: '' })
    focus()
  }

  function openChat(prompt: string) {
    cancelRun()
    Object.assign(s, { view: 'chat' as View, chatInput: '', stream: null, actionsOpen: false, query: '' })
    startNewChat()
    checkClaude().then(() => {
      if (!prompt) return
      if (s.claudeReady) send(prompt)
      else s.chatInput = prompt
    })
  }

  function newChat() {
    cancelRun()
    startNewChat()
    focus()
  }

  function finishReply(chatId: string, text: string, error?: string) {
    run = null
    if (s.chatId !== chatId) return
    const ms = s.messages.slice()
    const i = ms.length - 1
    ms[i] = { ...ms[i]!, blocks: error ? [{ type: 'p', text: `Couldn’t get a reply: ${error}` }] : markdownBlocks(text), text: error ? undefined : text }
    Object.assign(s, { messages: ms, stream: null })
    saveChat()
    if (error) toast('error', 'Claude didn’t reply', error)
  }

  async function send(input?: string) {
    const text = (input ?? s.chatInput).trim()
    if (!text || (s.stream && !s.stream.done) || !s.claudeReady) return
    const chat = currentChat()
    const chatId = s.chatId
    const attachText = s.attachText
    // Earlier turns, for the API key backend. Failed replies are left out with the message that got them.
    const history: { role: 'user' | 'assistant', content: string }[] = []
    s.messages.forEach((m, i) => {
      const next = s.messages[i + 1]
      if (m.role === 'user' && next?.text) history.push({ role: 'user', content: m.text ?? plainText(m) }, { role: 'assistant', content: next.text })
    })
    const user: ChatMsg = { role: 'user', blocks: [{ type: 'p', text }], attach: s.attach }
    const title = s.messages.length ? s.chatTitle : trunc(text, 40)
    Object.assign(s, { messages: [...s.messages, user, { role: 'assistant', blocks: [] }], chatInput: '', attach: null, attachText: '', chatTitle: title, stream: { target: 'chat', text: '', pos: 0 } })
    saveChat()
    // A chat continued from Quick AI has no Claude session yet, so its first message carries the context.
    const context = !chat?.sessionId && chat?.context ? `${chat.context}\n\n` : ''
    const clip = attachText ? `Clipboard:\n\`\`\`\n${attachText}\n\`\`\`\n\n` : ''
    let reply = ''
    const prompt = context + clip + text
    user.text = prompt
    run = await claude.stream({ mode: 'chat', prompt, system: 'chat', sessionId: chat?.sessionId, history }, (e) => {
      if (e.type === 'session') {
        // Keep the latest session id so the next message continues this conversation.
        chats.value = chats.value.map(c => c.id === chatId ? { ...c, sessionId: e.id, context: undefined } : c)
      } else if (e.type === 'text') {
        reply += e.text
        if (s.chatId === chatId) s.stream = { target: 'chat', text: reply, pos: reply.length }
      } else if (e.type === 'done') {
        finishReply(chatId, e.text || reply)
      } else if (e.type === 'error') {
        finishReply(chatId, '', e.message)
      }
    })
  }

  /**
   * Run a Quick AI command on `text`, or on the selected text. With neither, ask for the text first
   * (prefilled from the clipboard), since reading the selection in other apps isn't built yet.
   */
  async function runAi(cmd: string, text?: string, source = 'Your text') {
    cancelRun()
    const input = text ?? s.selection?.text ?? ''
    if (!input.trim()) {
      Object.assign(s, { view: 'aiResult', ai: { cmd, input: '', source, origOpen: false, needsInput: true }, aiInput: '', followUp: '', actionsOpen: false, stream: null })
      readClipboardText().then((clip) => {
        if (s.ai?.cmd === cmd && s.ai.needsInput && !s.aiInput && clip.trim()) s.aiInput = clip
      })
      return
    }
    const from = text === undefined && s.selection ? s.selection.app : source
    Object.assign(s, { view: 'aiResult', ai: { cmd, input, source: from, origOpen: false, result: '', error: '' }, followUp: '', actionsOpen: false, stream: { target: 'ai', text: '', pos: 0 } })
    if (!s.claudeReady || !s.claudeStatus) await checkClaude()
    if (!s.claudeReady) {
      s.ai = { ...s.ai!, error: s.claudeStatus?.api ? 'Add your Anthropic API key in Settings → AI.' : s.claudeStatus?.installed ? 'Claude Code isn’t signed in. Run “claude login” in a terminal.' : 'Claude Code isn’t installed. Run “npm install -g @anthropic-ai/claude-code”.' }
      s.stream = null
      return
    }
    let out = ''
    const mine = () => s.view === 'aiResult' && s.ai?.cmd === cmd
    run = await claude.stream({ mode: 'quick', prompt: input, system: cmd }, (e) => {
      if (!mine()) return
      if (e.type === 'text') {
        out += e.text
        s.stream = { target: 'ai', text: out, pos: out.length }
      } else if (e.type === 'done') {
        const result = (e.text || out).trim()
        s.ai = { ...s.ai!, result }
        s.stream = { target: 'ai', text: result, pos: result.length, done: true }
        run = null
      } else if (e.type === 'error') {
        s.ai = { ...s.ai!, error: e.message }
        s.stream = null
        run = null
      }
    })
  }

  async function checkAgain() {
    if (s.checking) return
    const st = await checkClaude()
    if (s.claudeReady) toast('success', st.api ? 'API key found' : 'Claude Code connected', st.api ? 'AI Chat uses your Anthropic API key' : `Signed in as ${st.email ?? 'your Claude account'}`)
  }

  /** Attach whatever text is on the clipboard to the next message. */
  /** Start an AI chat with a text file attached (its first 4 KB). */
  async function attachFile(x: FileEntry) {
    const { invoke } = await import('@tauri-apps/api/core')
    const p = await invoke<{ text: string | null }>('file_preview', { path: x.id }).catch(() => ({ text: null }))
    if (!p.text) return toast('info', 'Only text files can be attached', x.name)
    openChat('')
    s.attach = x.name
    s.attachText = `${x.name}:\n${p.text}`
  }

  async function attachClip() {
    const text = await readClipboardText()
    if (!text.trim()) {
      toast('info', 'Nothing to attach', 'Copy some text first, then attach it.')
      return
    }
    s.attach = trunc(text.replace(/\s+/g, ' ').trim(), 40)
    s.attachText = text
    focus()
  }

  // ---------- Laravel Forge ----------

  function openForgeList() {
    go('forgeList', { forgeQuery: '', forgeSel: 0 })
    forge.load()
  }

  function openServer(server: ForgeServer) {
    go('forgeDetail', { server })
    forge.loadServer(server).catch(e => toast('error', 'Couldn’t load the server’s sites', String(e)))
  }

  async function openDeploy(server: ForgeServer, from: View) {
    go('deploy', { server, deployFrom: from, deploy: { siteId: '' }, deploying: false, deployRun: null })
    try {
      if (!forge.sites.value[server.id]) await forge.loadServer(server)
      s.deploy = { siteId: forge.sites.value[server.id]?.[0]?.id ?? '' }
    } catch (e) {
      toast('error', 'Couldn’t load the server’s sites', String(e))
    }
  }

  /** Deploy Site from search: the default server from the Forge preferences, or the first one. */
  async function openDeployDefault() {
    if (!forge.servers.value.length) await forge.load()
    const name = String(exts.prefsFor('forge').server || '').toLowerCase()
    const server = forge.servers.value.find(x => x.name.toLowerCase() === name) ?? forge.servers.value[0]
    if (server) return openDeploy(server, 'search')
    openForgeList()
  }

  async function submitDeploy() {
    const server = s.server
    const site = server && forge.sites.value[server.id]?.find(x => x.id === s.deploy.siteId)
    if (s.deploying || !server || !site) return
    s.deploying = true
    s.deployRun = { site: site.name, status: 'queued' }
    try {
      const r = await forge.deploy(server, site, (status) => { s.deployRun = { site: site.name, status } })
      const ok = r.status === 'finished'
      s.deployRun = { site: site.name, status: r.status, log: r.log, ok }
      toast(ok ? 'success' : 'error', ok ? `Deployed ${site.name}` : `Deployment ${r.status.replace('-', ' ')}`, site.branch ? `Branch ${site.branch}` : undefined)
      forge.loadServer(server).catch(() => {})
    } catch (e) {
      s.deployRun = { site: site.name, status: 'error', log: String(e), ok: false }
      toast('error', 'Couldn’t start the deployment', String(e))
    } finally {
      s.deploying = false
    }
  }

  const toggleOrig = () => {
    if (s.ai) s.ai = { ...s.ai, origOpen: !s.ai.origOpen }
  }

  /** Quick AI → AI Chat: the result becomes a conversation you can keep going. */
  function continueInChat() {
    const c = aiCmd()
    const result = s.ai?.result ?? ''
    const selected = s.ai?.input ?? ''
    const follow = s.followUp
    cancelRun()
    startNewChat()
    Object.assign(s, { view: 'chat', stream: null, chatTitle: c.title, chatInput: '', messages: [{ role: 'user', blocks: [{ type: 'p', text: `${c.title}:\n${selected}` }] }, { role: 'assistant', blocks: markdownBlocks(result) }] })
    saveChat({ context: `Earlier I asked you to “${c.title}” for this text:\n"""\n${selected}\n"""\nYou replied:\n"""\n${result}\n"""` })
    checkClaude().then(() => {
      if (follow.trim()) send(follow)
    })
  }

  // ---------- actions ----------

  function runAction(id: string) {
    s.actionsOpen = false
    const e = s.view === 'search' ? searchModel.value.flat[s.sel] : null
    const c = s.view === 'clipboard' ? curClip() : null
    const sv = s.view === 'forgeList' ? forgeModel.value.flat[s.forgeSel] : s.server
    switch (id) {
      case 'open': e?.run(); break
      case 'admin': {
        const app = e?.id ? ITEMS[e.id]?.app : undefined
        if (!e || !app?.path) {
          toast('info', 'This result can\'t run as administrator')
          break
        }
        launchApp(e.id!, true)
        break
      }
      case 'reveal':
        if (e?.path) closeWith(`Revealed ${e.title} in File Explorer`, () => revealPath(e.path!))
        else toast('info', 'This result has no file to reveal')
        break
      case 'path':
        if (e?.path) {
          copyText(e.path)
          toast('success', 'Path copied', e.path)
        } else toast('info', 'This result has no path')
        break
      case 'pin': {
        if (!e || !e.id) {
          toast('info', 'This result can\'t be pinned')
          break
        }
        const fav = favs.value.includes(e.id)
        favs.value = fav ? favs.value.filter(x => x !== e.id) : [...favs.value, e.id]
        toast('success', fav ? 'Removed from Favourites' : 'Pinned to Favourites', e.title)
        break
      }
      case 'alias':
      case 'hotkey': {
        const tid = s.view === 'search' ? e?.id : curSplit()?.id
        if (!tid || !ITEMS[tid]) {
          toast('info', `This result can't have ${id === 'alias' ? 'an alias' : 'a hotkey'}`)
          break
        }
        if (id === 'alias') s.al = { id: tid, title: ITEMS[tid]!.title, value: aliases.value[tid] || '' }
        else s.hk = { id: tid, title: ITEMS[tid]!.title, combo: null, conflict: '' }
        break
      }
      case 'split': runSplit(); break
      case 'sncopy': {
        const x = curSplit() as Snippet | undefined
        if (x) {
          snippetText(x.text).then(copyText)
          toast('success', 'Snippet copied', x.name)
        }
        break
      }
      case 'snexpand': {
        const on = !settings.value.textExpansion
        settings.value = { ...settings.value, textExpansion: on }
        toast('info', on ? 'Text expansion on' : 'Text expansion off', on ? 'Type a keyword in any app to expand it.' : 'Keywords no longer expand as you type.')
        break
      }
      case 'snedit': openSettings({ tab: 'snippets' }); break
      case 'qedit': openSettings({ tab: 'quicklinks' }); break
      case 'qcopy': {
        const x = curSplit() as Quicklink | undefined
        if (x) {
          const url = x.arg && s.args[x.id] ? resolveQ(x, s.args[x.id]!) : x.url
          copyText(url)
          toast('success', 'URL copied', url)
        }
        break
      }
      case 'fwith': {
        const x = curSplit() as FileEntry | undefined
        if (x) closeWith(`Choose an app for ${x.name}`, () => files.openWith(x.id).catch(e => toast('error', 'Couldn’t show Open with', String(e))))
        break
      }
      case 'fpath': {
        const x = curSplit() as FileEntry | undefined
        if (x) {
          copyText(x.id)
          toast('success', 'Path copied', x.id)
        }
        break
      }
      case 'freveal': {
        const x = curSplit() as FileEntry | undefined
        if (x) closeWith(`Revealed ${x.name} in File Explorer`, () => revealPath(x.id))
        break
      }
      case 'fattach': {
        const x = curSplit() as FileEntry | undefined
        if (!x) break
        attachFile(x)
        break
      }
      case 'xuninstall': {
        const x = curSplit() as ExtensionDef | undefined
        if (x && installed.value.includes(x.id)) askUninstall(x)
        break
      }
      case 'nnew': newNote(); break
      case 'nfloat': toggleFloat(); break
      case 'ndelete': deleteNote(); break
      case 'epaste': {
        const x = curEmoji()
        if (x) pasteText(x.e, x.e)
        break
      }
      case 'ecopy': {
        const x = curEmoji()
        if (x) {
          copyText(x.e)
          toast('success', `Copied ${x.e}`, x.n)
        }
        break
      }
      case 'disable': {
        if (!e || !e.id) {
          toast('info', 'This result can\'t be disabled')
          break
        }
        const id2 = e.id
        disabled.value = [...disabled.value, id2]
        s.sel = 0
        toast('info', 'Result disabled', e.title, { label: 'Undo', run: () => { disabled.value = disabled.value.filter(x => x !== id2) } })
        break
      }
      case 'cpaste': if (c) pasteClip(c); break
      case 'ccopy': if (c) {
        clipboard.copy(c).then(() => toast('success', 'Copied to clipboard', trunc(clipPreview(c), 48)))
      } break
      case 'cpin': {
        if (!c) break
        clipboard.togglePin(c.id)
        nextTick(() => { s.clipSel = Math.max(0, clipModel.value.flat.findIndex(x => x.id === c.id)) })
        toast('success', c.pinned ? 'Unpinned' : 'Pinned', trunc(clipPreview(c), 48))
        break
      }
      case 'cdelete': {
        if (!c) break
        clipboard.remove(c.id)
        s.clipSel = Math.max(0, Math.min(s.clipSel, clipModel.value.flat.length - 1))
        toast('info', 'Deleted from history', trunc(clipPreview(c), 48))
        break
      }
      case 'cclear':
        s.confirm = { title: 'Clear Clipboard History?', desc: 'Everything except pinned entries is deleted from this PC.', label: 'Clear History', run: () => {
          clipboard.clear()
          s.clipSel = 0
          toast('info', 'Clipboard History cleared')
        } }
        break
      case 'fopen': if (sv) openServer(sv); break
      case 'fdeploy': if (sv) openDeploy(sv, s.view); break
      case 'fforge': if (sv) closeWith(`Opened ${sv.name} in Laravel Forge`, () => openUrl(forge.serverUrl(sv))); break
      case 'fip': if (sv) {
        copyText(sv.ip)
        toast('success', 'IP address copied', sv.ip)
      } break
      case 'fssh': if (sv) closeWith(`Opened SSH to ${sv.name}`, () => openSsh('forge', sv.ip, sv.sshPort).catch(e => toast('error', 'Couldn’t open SSH', String(e)))); break
      case 'newchat': newChat(); break
      case 'togglechats': s.showChats = !s.showChats; break
      case 'attach': attachClip(); break
      case 'aipaste':
        if (s.ai?.result) pasteText(s.ai.result, `the ${aiCmd().title.toLowerCase()} result`)
        break
      case 'aicopy':
        if (s.ai?.result) {
          copyText(s.ai.result)
          toast('success', 'Copied result', aiCmd().title)
        }
        break
      case 'aichat': continueInChat(); break
      case 'regen': if (s.ai && !s.ai.needsInput) runAi(s.ai.cmd, s.ai.input, s.ai.source); break
      case 'airun': if (s.ai?.needsInput && s.aiInput.trim()) runAi(s.ai.cmd, s.aiInput); break
      case 'deploy': submitDeploy(); break
      case 'back': back(); break
      case 'hopen': {
        const x = curSite()
        if (x) openSite(x)
        break
      }
      case 'hcode': {
        const x = curSite()
        if (x) closeWith(`Opened ${x.name} in ${herdEditor().name}`, () => openUrl(herdEditor().url(x.path)))
        break
      }
      case 'hreveal': {
        const x = curSite()
        if (x) closeWith(`Revealed ${x.name} in File Explorer`, () => revealPath(x.path))
        break
      }
      case 'hurl': {
        const x = curSite()
        if (x) {
          copyText(x.url)
          toast('success', 'URL copied', x.url)
        }
        break
      }
      case 'hpath': {
        const x = curSite()
        if (x) {
          copyText(x.path)
          toast('success', 'Path copied', x.path)
        }
        break
      }
      case 'hreload':
        loadHerd().then(() => toast('success', 'Herd sites reloaded', `${herdSites.value.length} sites`))
        break
      case 'gopen': {
        const r = curRepo()
        if (r) closeWith(`Opened ${r.name} in ${editorFor('git').name}`, () => openUrl(editorFor('git').url(r.path)))
        break
      }
      case 'gterm': {
        const r = curRepo()
        if (r) closeWith(`Opened a terminal in ${r.name}`, () => openTerminal(r.path).catch(e => toast('error', 'Couldn’t open a terminal', String(e))))
        break
      }
      case 'greveal': {
        const r = curRepo()
        if (r) closeWith(`Revealed ${r.name} in File Explorer`, () => revealPath(r.path))
        break
      }
      case 'gpath': {
        const r = curRepo()
        if (r) {
          copyText(r.path)
          toast('success', 'Path copied', r.path)
        }
        break
      }
      case 'greload':
        loadGit().then(() => toast('success', 'Checked again', `${gitModel.value.flat.length} of ${gitModel.value.checked} repos need attention`))
        break
      case 'ropen': {
        const r = curRemote()
        if (r) closeWith(`Opened ${r.title}`, () => openUrl(r.url))
        break
      }
      case 'rlog': openLogWork(); break
      case 'rcopy': {
        const r = curRemote()
        if (r) {
          copyText(r.copy ?? r.url)
          toast('success', 'Copied', r.copy ?? r.url)
        }
        break
      }
      case 'rreload': if (remote.source.value) remote.load(remote.source.value, s.remoteQuery); break
      case 'dprimary': {
        const r = curDocker()
        if (!r) break
        if (docker.kind.value === 'images') runAction('dcopy')
        else dockerDo(r.running ? 'stop' : 'start', r.running ? 'Stopped' : 'Started')
        break
      }
      case 'drestart': dockerDo('restart', 'Restarted'); break
      case 'dlogs': {
        const r = curDocker()
        if (r) closeWith(`Showing logs for ${r.title}`, () => docker.act('logs', r.id).catch(e => toast('error', 'Couldn’t show logs', String(e))))
        break
      }
      case 'dcopy': {
        const r = curDocker()
        if (r) {
          copyText(r.id)
          toast('success', 'ID copied', r.id.slice(0, 24))
        }
        break
      }
      case 'dremove': {
        const r = curDocker()
        if (r) s.confirm = { title: `Remove ${r.title}?`, desc: docker.kind.value === 'images' ? 'The image is deleted from this PC.' : 'The container is stopped and deleted. Its volumes are kept.', label: 'Remove', run: () => dockerDo('remove', 'Removed') }
        break
      }
      case 'dreload': docker.load(); break
      case 'colhex': case 'colrgb': case 'colhsl': {
        const x = curSplit() as SavedColour | undefined
        if (x) copyColour(x, id === 'colhex' ? 'hex' : id === 'colrgb' ? 'rgb' : 'hsl')
        break
      }
      case 'colpick': pickColour(); break
      case 'coldelete': {
        const x = curSplit() as SavedColour | undefined
        if (x) colours.remove(x.id)
        break
      }
      case 'pwcopy': copyPassword(); break
      case 'pwnew': pw.regenerate(); break
      case 'pwtype': pw.setType(pw.opts.value.type === 'password' ? 'passphrase' : 'password'); break
      case 'dcopy': {
        const c = curSense()
        if (c) {
          const t = `${dict.entry!.word} (${c.pos.toLowerCase()}): ${c.sense.text}`
          copyText(t)
          toast('success', 'Definition copied', trunc(t, 60))
        }
        break
      }
      case 'dword':
        if (dict.entry) {
          copyText(dict.entry.word)
          toast('success', 'Word copied', dict.entry.word)
        }
        break
      case 'dopen':
        if (dict.entry) closeWith(`Opened “${dict.entry.word}” in Wiktionary`, () => openUrl(dict.entry!.url))
        break
    }
  }

  const openActions = () => Object.assign(s, { actionsOpen: true, actionsQuery: '', actionsSel: 0 })

  // ---------- key map (replicates onKey in the prototype) ----------

  function onKey(e: KeyboardEvent) {
    const k = e.key
    const ctrl = e.ctrlKey || e.metaKey
    const sh = e.shiftKey
    const kl = (k || '').toLowerCase()
    const stop = () => {
      e.preventDefault()
      e.stopPropagation()
    }
    const isFloat = (e.target as HTMLElement | null)?.dataset?.float
    if (isFloat && !(e.altKey && e.code === 'Space')) return
    if (s.hk && s.open) {
      stop()
      recordKey(e)
      return
    }
    if (e.altKey && e.code === 'Space' && settings.value.hotkey.join('+') === 'Alt+Space') {
      stop()
      if (s.open) s.open = false
      else openWin()
      return
    }
    if (!s.open) {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        const id = comboOwner(comboOf(e).join('+'), null)
        if (id) {
          stop()
          activate(id)
        }
      }
      return
    }
    if (s.onb) {
      if (k === 'Enter') {
        stop()
        onbNext()
      } else if (k === 'Escape') {
        stop()
        onbBack()
      } else if (s.onb.step === 0 && (k === 'ArrowRight' || k === 'ArrowLeft')) {
        stop()
        s.onb = { ...s.onb, hk: (s.onb.hk + (k === 'ArrowRight' ? 1 : 2)) % 3 }
      }
      return
    }
    if (s.confirm) {
      if (k === 'Enter') {
        stop()
        cfOk()
      } else if (k === 'Escape') {
        stop()
        s.confirm = null
      }
      return
    }
    if (s.logWork) {
      // Typing in the Log Work dialog: Enter logs it (Shift Enter is a new line in the comment), Esc cancels.
      if (k === 'Enter' && !sh) {
        stop()
        submitLogWork()
      } else if (k === 'Escape') {
        stop()
        s.logWork = null
      }
      return
    }
    if (s.al) {
      if (k === 'Enter') {
        stop()
        saveAl()
      } else if (k === 'Escape') {
        stop()
        s.al = null
      }
      return
    }
    if (s.actionsOpen) {
      const n = actionsModel.value.list.length
      if (k === 'ArrowDown') {
        stop()
        s.actionsSel = (s.actionsSel + 1) % Math.max(1, n)
      } else if (k === 'ArrowUp') {
        stop()
        s.actionsSel = (s.actionsSel - 1 + n) % Math.max(1, n)
      } else if (k === 'Enter') {
        stop()
        const a = actionsModel.value.list[s.actionsSel]
        if (a) runAction(a.id)
      } else if (k === 'Escape' || (ctrl && kl === 'k')) {
        stop()
        s.actionsOpen = false
      }
      return
    }
    if (ctrl && kl === 'k' && !sh) {
      stop()
      openActions()
      return
    }
    if (k === 'Escape' && (e.target === els.note || e.target === els.arg)) {
      stop()
      els.top?.focus()
      return
    }
    if (k === 'Escape') {
      stop()
      back()
      return
    }
    if (ctrl && k === ',') {
      stop()
      openSettings()
      return
    }
    const v = s.view
    if (v === 'search') {
      const n = searchModel.value.flat.length
      if (k === 'ArrowDown') {
        stop()
        s.sel = (s.sel + 1) % Math.max(1, n)
        return
      }
      if (k === 'ArrowUp') {
        stop()
        s.sel = (s.sel - 1 + n) % Math.max(1, n)
        return
      }
      if (k === 'Tab') {
        stop()
        const ql = s.query.trim().toLowerCase()
        if (ql === 'ai' || ql.startsWith('ai ')) openChat(s.query.trim().slice(2).trim())
        return
      }
      if (k === 'Enter') {
        stop()
        if (ctrl && sh) return runAction('admin')
        searchModel.value.flat[s.sel]?.run()
        return
      }
      if (ctrl && !sh && /^[1-5]$/.test(k) && s.selection) {
        stop()
        runAi(AI_CMDS[+k - 1]!.id)
        return
      }
      if (ctrl && sh && kl === 'v') {
        stop()
        go('clipboard', { clipQuery: '', clipSel: 0 })
        return
      }
      if (ctrl && sh) {
        const a = ({ e: 'reveal', c: 'path', p: 'pin', a: 'alias', h: 'hotkey', d: 'disable' } as Record<string, string>)[kl]
        if (a) {
          stop()
          runAction(a)
        }
      }
      return
    }
    if (SPLIT[v]) {
      const inNote = e.target === els.note
      const inArg = e.target === els.arg
      const n = splitModel.value.flat.length
      const combo = (ctrl ? 'ctrl+' : '') + (sh ? 'shift+' : '') + kl
      const act = (SPLIT_KEYS_FOR(v))[combo]
      if (act && !(inNote && combo === 'ctrl+backspace') && !(kl === 'c' && hasInputSel())) {
        stop()
        runAction(act)
        return
      }
      if (inNote) return
      if (k === 'ArrowDown' && n) {
        stop()
        s.splitSel = Math.min(n - 1, s.splitSel + 1)
        return
      }
      if (k === 'ArrowUp' && n) {
        stop()
        s.splitSel = Math.max(0, s.splitSel - 1)
        return
      }
      if (k === 'Enter' && n) {
        stop()
        runSplit()
        return
      }
      if (k === 'Tab' && !sh) {
        if (els.arg && !inArg) {
          stop()
          els.arg.focus()
        } else if (v === 'notes' && els.note) {
          stop()
          els.note.focus()
        } else if (inArg) {
          stop()
          els.top?.focus()
        }
      }
      return
    }
    if (v === 'emoji') {
      const n = emojiModel.value.flat.length
      const mv = (d: number) => {
        stop()
        s.splitSel = Math.max(0, Math.min(n - 1, s.splitSel + d))
      }
      if (!n) return
      if (k === 'ArrowRight') return mv(1)
      if (k === 'ArrowLeft') return mv(-1)
      if (k === 'ArrowDown') return mv(12)
      if (k === 'ArrowUp') return mv(-12)
      if (k === 'Enter') {
        stop()
        runAction('epaste')
        return
      }
      if (ctrl && kl === 'c' && !hasInputSel()) {
        stop()
        runAction('ecopy')
      }
      return
    }
    if (v === 'clipboard') {
      const n = clipModel.value.flat.length
      if (k === 'ArrowDown' && n) {
        stop()
        s.clipSel = Math.min(n - 1, s.clipSel + 1)
      } else if (k === 'ArrowUp' && n) {
        stop()
        s.clipSel = Math.max(0, s.clipSel - 1)
      } else if (k === 'Enter' && n) {
        stop()
        runAction('cpaste')
      } else if (ctrl && kl === 'c' && n && !hasInputSel()) {
        stop()
        runAction('ccopy')
      } else if (ctrl && kl === 'p' && n) {
        stop()
        runAction('cpin')
      } else if (ctrl && k === 'Backspace' && n) {
        stop()
        runAction('cdelete')
      } else if (ctrl && kl === 'o' && n) {
        const c = curClip()
        if (c?.kind === 'link' && c.text) {
          stop()
          closeWith(`Opened ${new URL(c.text).host} in your browser`, () => openUrl(c.text!.trim()))
        }
      }
      return
    }
    if (v === 'chat') {
      if (!s.claudeReady) {
        if (k === 'Enter') {
          stop()
          checkAgain()
        }
        return
      }
      if (ctrl && kl === 'b') {
        stop()
        s.showChats = !s.showChats
        return
      }
      if (ctrl && kl === 'n') {
        stop()
        newChat()
        return
      }
      if (ctrl && sh && kl === 'v') {
        stop()
        attachClip()
        return
      }
      if (k === 'Enter' && !sh && e.target === els.chat) {
        stop()
        send()
        return
      }
      return
    }
    if (v === 'aiResult' && s.ai?.needsInput) {
      // Typing the text: Enter runs, Shift Enter is a new line.
      if (k === 'Enter' && !sh) {
        stop()
        runAction('airun')
      }
      return
    }
    if (v === 'aiResult') {
      if (k === 'Enter') {
        stop()
        runAction('aipaste')
      } else if (ctrl && kl === 'c' && !hasInputSel()) {
        stop()
        runAction('aicopy')
      } else if (k === 'Tab') {
        stop()
        runAction('aichat')
      } else if (ctrl && kl === 'r') {
        stop()
        runAction('regen')
      } else if (ctrl && kl === 'o') {
        stop()
        toggleOrig()
      }
      return
    }
    if (v === 'forgeList') {
      const n = forgeModel.value.flat.length
      if (k === 'ArrowDown' && n) {
        stop()
        s.forgeSel = (s.forgeSel + 1) % n
      } else if (k === 'ArrowUp' && n) {
        stop()
        s.forgeSel = (s.forgeSel - 1 + n) % n
      } else if (k === 'Enter' && n) {
        stop()
        runAction('fopen')
      } else if (ctrl && kl === 'd' && n) {
        stop()
        runAction('fdeploy')
      } else if (ctrl && kl === 'o' && n) {
        stop()
        runAction('fforge')
      } else if (ctrl && sh && kl === 'c') {
        stop()
        runAction('fip')
      } else if (ctrl && sh && kl === 's') {
        stop()
        runAction('fssh')
      }
      return
    }
    if (v === 'herdList') {
      const n = herdModel.value.flat.length
      if (k === 'ArrowDown' && n) {
        stop()
        s.herdSel = (s.herdSel + 1) % n
      } else if (k === 'ArrowUp' && n) {
        stop()
        s.herdSel = (s.herdSel - 1 + n) % n
      } else if (k === 'Enter' && n) {
        stop()
        runAction('hopen')
      } else if (ctrl && !sh && kl === 'o' && n) {
        stop()
        runAction('hcode')
      } else if (ctrl && sh && kl === 'e' && n) {
        stop()
        runAction('hreveal')
      } else if (ctrl && sh && kl === 'c' && n) {
        stop()
        runAction('hurl')
      } else if (ctrl && sh && kl === 'p' && n) {
        stop()
        runAction('hpath')
      } else if (ctrl && kl === 'r') {
        stop()
        runAction('hreload')
      }
      return
    }
    if (v === 'gitList') {
      const n = gitModel.value.flat.length
      if (k === 'ArrowDown' && n) {
        stop()
        s.gitSel = (s.gitSel + 1) % n
      } else if (k === 'ArrowUp' && n) {
        stop()
        s.gitSel = (s.gitSel - 1 + n) % n
      } else if (k === 'Enter' && n) {
        stop()
        runAction('gopen')
      } else if (ctrl && !sh && kl === 't' && n) {
        stop()
        runAction('gterm')
      } else if (ctrl && sh && kl === 'e' && n) {
        stop()
        runAction('greveal')
      } else if (ctrl && sh && kl === 'c' && n) {
        stop()
        runAction('gpath')
      } else if (ctrl && kl === 'r') {
        stop()
        runAction('greload')
      }
      return
    }
    if (v === 'remoteList') {
      const n = remoteModel.value.length
      const work = remote.source.value?.cmd === 'work'
      if (k === 'ArrowDown' && n) {
        stop()
        s.remoteSel = (s.remoteSel + 1) % n
      } else if (k === 'ArrowUp' && n) {
        stop()
        s.remoteSel = (s.remoteSel - 1 + n) % n
      } else if (k === 'Enter' && n) {
        stop()
        runAction(work ? 'rlog' : 'ropen')
      } else if (ctrl && !sh && kl === 'o' && n) {
        stop()
        runAction('ropen')
      } else if (ctrl && !sh && kl === 'l' && n && remote.source.value?.ext === 'jira') {
        stop()
        runAction('rlog')
      } else if (ctrl && sh && kl === 'c' && n) {
        stop()
        runAction('rcopy')
      } else if (ctrl && kl === 'r') {
        stop()
        runAction('rreload')
      }
      return
    }
    if (v === 'dockerList') {
      const n = dockerModel.value.length
      if (k === 'ArrowDown' && n) {
        stop()
        s.dockerSel = (s.dockerSel + 1) % n
      } else if (k === 'ArrowUp' && n) {
        stop()
        s.dockerSel = (s.dockerSel - 1 + n) % n
      } else if (k === 'Enter' && n) {
        stop()
        runAction('dprimary')
      } else if (ctrl && !sh && kl === 'l' && n) {
        stop()
        runAction('dlogs')
      } else if (ctrl && sh && kl === 'r' && n) {
        stop()
        runAction('drestart')
      } else if (ctrl && !sh && kl === 'r') {
        stop()
        runAction('dreload')
      } else if (ctrl && sh && kl === 'c' && n) {
        stop()
        runAction('dcopy')
      } else if (ctrl && k === 'Backspace' && n) {
        stop()
        runAction('dremove')
      }
      return
    }
    if (v === 'password') {
      if (k === 'Enter') {
        stop()
        runAction('pwcopy')
      } else if (ctrl && !sh && kl === 'c' && !hasInputSel()) {
        stop()
        copyPassword(false)
      } else if (ctrl && kl === 'r') {
        stop()
        runAction('pwnew')
      } else if (ctrl && kl === 't') {
        stop()
        runAction('pwtype')
      }
      return
    }
    if (v === 'dictionary') {
      const n = dictFlat.value.length
      if (k === 'ArrowDown' && n) {
        stop()
        s.dictSel = Math.min(n - 1, s.dictSel + 1)
      } else if (k === 'ArrowUp' && n) {
        stop()
        s.dictSel = Math.max(0, s.dictSel - 1)
      } else if (k === 'Enter' && n) {
        stop()
        runAction('dcopy')
      } else if (ctrl && !sh && kl === 'c' && n && !hasInputSel()) {
        stop()
        runAction('dcopy')
      } else if (ctrl && sh && kl === 'c' && dict.entry) {
        stop()
        runAction('dword')
      } else if (ctrl && kl === 'o' && dict.entry) {
        stop()
        runAction('dopen')
      }
      return
    }
    if (v === 'forgeDetail') {
      if (k === 'Enter' || (ctrl && kl === 'd')) {
        stop()
        if (s.server) openDeploy(s.server, 'forgeDetail')
      } else if (ctrl && kl === 'o') {
        stop()
        runAction('fforge')
      } else if (ctrl && sh && kl === 'c') {
        stop()
        runAction('fip')
      }
      return
    }
    if (v === 'deploy') {
      if (ctrl && k === 'Enter') {
        stop()
        submitDeploy()
      }
    }
  }

  // ---------- footer ----------

  const footer = computed((): { app: { icon: string, tile: string, name: string }, hints: Hint[] } => {
    const v = s.view
    const hint = (label: string, keys: string[], run?: (() => void) | null, primary?: boolean): Hint => ({ label, keys, run: run || (() => {}), primary })
    const act = hint('Actions', ['Ctrl', 'K'], openActions)
    const LP = { icon: 'esky', tile: '', name: 'Esky' }
    const FORGE = { icon: 'i-lucide-hammer', tile: '#EA580C', name: 'Laravel Forge' }
    if (v === 'search') {
      const m = searchModel.value
      const cur = m.flat[Math.min(s.sel, Math.max(0, m.flat.length - 1))]
      const lbl = !cur ? 'Open' : cur.kind === 'card' ? 'Copy' : cur.kind === 'chat' ? 'Chat' : cur.kind === 'dict' ? 'Define' : cur.kind === 'snip' ? 'Paste' : cur.kind === 'win' ? 'Apply' : ['cmd', 'ai', 'sys'].includes(cur.kind || '') ? 'Run' : 'Open'
      return {
        app: s.selection ? { icon: 'i-lucide-text-cursor-input', tile: 'var(--accent)', name: `${s.selection.app} · text selected` } : LP,
        hints: [hint(lbl, cur && cur.kind === 'chat' && s.query.trim().toLowerCase().startsWith('ai') ? ['Tab'] : ['↵'], () => cur?.run(), true), act]
      }
    }
    if (v === 'clipboard') return { app: { icon: 'i-lucide-clipboard-list', tile: '#0D9488', name: 'Clipboard History' }, hints: [hint(s.target ? 'Paste' : 'Copy and Close', ['↵'], () => runAction('cpaste'), true), hint('Copy', ['Ctrl', 'C'], () => runAction('ccopy')), hint('Pin', ['Ctrl', 'P'], () => runAction('cpin')), hint('Delete', ['Ctrl', '⌫'], () => runAction('cdelete'))] }
    if (v === 'chat') {
      return { app: { icon: 'i-lucide-sparkles', tile: 'var(--accent)', name: 'AI Chat' }, hints: s.claudeReady
        ? [hint('Send', ['↵'], () => send(), true), hint('New line', ['Shift', '↵']), hint('Chats', ['Ctrl', 'B'], () => { s.showChats = !s.showChats }), act]
        : [hint('Check again', ['↵'], checkAgain, true), hint('Back', ['Esc'], back)] }
    }
    if (v === 'aiResult' && s.ai?.needsInput) return { app: { icon: 'i-lucide-sparkles', tile: 'var(--accent)', name: 'Quick AI' }, hints: [hint('Run', ['↵'], () => runAction('airun'), true), hint('New line', ['Shift', '↵']), hint('Back', ['Esc'], back)] }
    if (v === 'aiResult') return { app: { icon: 'i-lucide-sparkles', tile: 'var(--accent)', name: 'Quick AI' }, hints: [hint(s.target ? 'Paste' : 'Copy and Close', ['↵'], () => runAction('aipaste'), true), hint('Copy', ['Ctrl', 'C'], () => runAction('aicopy')), hint('Continue in Chat', ['Tab'], () => runAction('aichat')), hint('Regenerate', ['Ctrl', 'R'], () => runAction('regen'))] }
    if (v === 'herdList') return { app: { icon: 'i-lucide-feather', tile: '#E11D48', name: 'Laravel Herd' }, hints: [hint('Open', ['↵'], () => runAction('hopen'), true), hint(herdEditor().short, ['Ctrl', 'O'], () => runAction('hcode')), act] }
    if (v === 'gitList') return { app: { icon: 'i-lucide-git-branch', tile: '#F05032', name: 'Git' }, hints: [hint(editorFor('git').short, ['↵'], () => runAction('gopen'), true), hint('Terminal', ['Ctrl', 'T'], () => runAction('gterm')), act] }
    if (v === 'remoteList') {
      const src = remote.source.value
      const work = src?.cmd === 'work'
      return { app: { icon: src?.icon ?? 'i-lucide-link', tile: src?.tile ?? '', name: src?.title ?? '' }, hints: [hint(work ? 'Log Work' : 'Open', ['↵'], () => runAction(work ? 'rlog' : 'ropen'), true), hint('Copy', ['Ctrl', 'Shift', 'C'], () => runAction('rcopy')), act] }
    }
    if (v === 'dockerList') {
      const r = curDocker()
      const k = docker.kind.value
      const primary = k === 'images' ? 'Copy ID' : r?.running ? 'Stop' : 'Start'
      return { app: { icon: 'i-lucide-container', tile: '#0284C7', name: 'Docker' }, hints: [hint(primary, ['↵'], () => runAction('dprimary'), true), ...(k === 'containers' ? [hint('Logs', ['Ctrl', 'L'], () => runAction('dlogs'))] : []), act] }
    }
    if (v === 'password') return { app: { icon: 'i-lucide-key-round', tile: '#175DDC', name: 'Password Generator' }, hints: [hint('Copy', ['↵'], () => runAction('pwcopy'), true), hint('Regenerate', ['Ctrl', 'R'], () => runAction('pwnew')), act] }
    if (v === 'dictionary') return { app: { icon: 'i-lucide-book-a', tile: '#0369A1', name: 'Dictionary' }, hints: [hint('Copy', ['↵'], () => runAction('dcopy'), true), hint('Wiktionary', ['Ctrl', 'O'], () => runAction('dopen')), act] }
    if (v === 'forgeList') return { app: FORGE, hints: [hint('Show Details', ['↵'], () => runAction('fopen'), true), hint('Deploy', ['Ctrl', 'D'], () => runAction('fdeploy')), act] }
    if (v === 'forgeDetail') return { app: FORGE, hints: [hint('Deploy Site', ['↵'], () => s.server && openDeploy(s.server, 'forgeDetail'), true), hint('Open in Forge', ['Ctrl', 'O'], () => runAction('fforge')), act] }
    if (v === 'deploy') return { app: FORGE, hints: [hint('Deploy', ['Ctrl', '↵'], submitDeploy, true), hint('Next field', ['Tab']), hint('Back', ['Esc'], back)] }
    if (SPLIT[v]) {
      const [app, defs] = SPLIT_FOOT_FOR(v as SplitView)
      const x = curSplit()
      const hints = v === 'store' ? [[x && installed.value.includes(x.id) ? 'Configure' : 'Install', ['↵'], 'split'] as [string, string[], string]] : defs
      return { app, hints: [...hints.map(([l, ks, id], j) => hint(l, ks, id ? () => runAction(id) : null, j === 0)), act] }
    }
    if (v === 'emoji') {
      const ce = curEmoji()
      return { app: { icon: 'i-lucide-smile', tile: '#CA8A04', name: ce ? `${ce.e}  ${ce.n}` : 'Emoji & Symbols' }, hints: [hint('Paste', ['↵'], () => runAction('epaste'), true), hint('Copy', ['Ctrl', 'C'], () => runAction('ecopy')), act] }
    }
    return { app: LP, hints: [] }
  })

  // ---------- side effects ----------

  watch(() => [s.view, s.open, s.actionsOpen, !s.al, s.ai?.needsInput], () => focus())

  watch(() => s.open, (o) => {
    if (o) {
      showWindow(settings.value.activeMonitor)
      // Pick up apps installed since the list was read.
      apps.refreshIfStale()
      rates.refresh()
    } else hideWindow()
  })

  watch(floatId, id => floatNote(id))

  // File Search: search as you type (the index answers in well under a millisecond).
  let fileSeq = 0
  watch(() => [s.view, s.splitQuery] as const, async ([view, q]) => {
    if (view !== 'files') return
    const mine = ++fileSeq
    const hits = await files.search(q)
    if (mine === fileSeq) {
      fileHits.value = hits
      s.splitSel = 0
    }
  })
  watch(() => s.view, (v) => {
    if (v === 'files') files.loadRecent()
  })
  let rootSeq = 0
  watch(() => s.query, async (q) => {
    const mine = ++rootSeq
    const on = exts.isActive('files') && exts.prefsFor('files').inSearch !== false && q.trim().length >= 3
    const hits = on ? await files.search(q) : []
    if (mine === rootSeq) rootFiles.value = hits
  })

  ready.then(() => {
    if (!onboarded.value) Object.assign(s, { open: true, onb: onbStart() })
    if (floatId.value) floatNote(floatId.value)
    apps.load()
    rates.refresh()
    clipboard.start()
    startExpansion()
    files.start()
    // Herd sites also appear in root search.
    if (exts.isActive('herd')) loadHerd()
    // A different Herd config folder (set in Settings) means a different site list.
    watch(() => [exts.prefsFor('herd').configDir, exts.isActive('herd')], ([, on]) => {
      if (on) loadHerd()
    })
  })

  return {
    s, els, ready, favs, disabled, usage, recent, aliases, hotkeys, installed, notes, clip, floatId, settings,
    searchModel, clipModel, forgeModel, splitModel, emojiModel, actionsModel, footer,
    apps, qls, sn, files, docker, dockerModel, remote, remoteModel, submitLogWork, forge, openServer, openForgeList, herd, herdModel, openSite, git, gitModel, pw, copyPassword, dict, dictFlat, openDictionary,
    chats, chatGroups, openSavedChat, claude,
    curClip, curSplit, curEmoji, detail, aiCmd, rowKeys, comboOwner, aliasOwner,
    toast, focus, go, openWin, openFromHotkey, openFromTray, activateFromHotkey, back, closeWith, activate, runAction, runSplit, openActions,
    onKey, saveHk, clearHk, saveAl, cfOk, sysConfirm, openChat, runAi, onbNext, onbBack, onbSkip, checkAgain, attachClip, newChat, send,
    submitDeploy, openDeploy, toggleOrig, editNote, theme
  }
}

const SPLIT_KEYS_FOR = (v: string) => SPLIT_KEYS[v] || {}
const SPLIT_FOOT_FOR = (v: SplitView) => SPLIT_FOOT[v]

let launcher: ReturnType<typeof createLauncher> | null = null

export function useLauncher() {
  launcher ??= createLauncher()
  return launcher
}

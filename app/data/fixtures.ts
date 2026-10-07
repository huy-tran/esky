// Sample data. Replace with real providers.

export type Kind = 'app' | 'cmd' | 'file' | 'link' | 'snip' | 'win' | 'sys'

export interface WinCmd {
  id: string
  title: string
  icon: string
  g: string
  r?: [number, number, number, number]
  display?: boolean
  keys: string[]
}

export interface Quicklink {
  id: string
  name: string
  kw: string
  url: string
  icon: string
  tile: string
  arg: string | null
}

export interface Snippet {
  id: string
  name: string
  kw: string
  folder: string
  /** When it was last pasted or expanded (ms). */
  lastUsed?: number
  text: string
  mono?: boolean
}

export interface Item {
  title: string
  sub: string
  icon: string
  tile?: string
  kind: Kind
  keys?: string[]
  go?: string
  ai?: string
  ext?: string
  win?: WinCmd
  qlink?: Quicklink
  snip?: Snippet
  /** An installed app (see useApps). */
  app?: { id: string, path: string | null, store: boolean }
}

export const ITEMS: Record<string, Item> = {
  clip: { title: 'Clipboard History', sub: 'Esky', icon: 'i-lucide-clipboard-list', kind: 'cmd', go: 'clipboard' },
  ai: { title: 'Ask AI', sub: 'Chat with Claude', icon: 'i-lucide-sparkles', kind: 'cmd', keys: ['ai', 'Tab'], go: 'chat' },
  forgeSearch: { title: 'Search Servers', sub: 'Laravel Forge', icon: 'i-lucide-hammer', tile: '#EA580C', kind: 'cmd', go: 'forgeList' },
  forgeDeploy: { title: 'Deploy Site', sub: 'Laravel Forge', icon: 'i-lucide-rocket', tile: '#EA580C', kind: 'cmd', go: 'deploy' },
  grammar: { title: 'Fix Grammar', sub: 'Quick AI', icon: 'i-lucide-spell-check', kind: 'cmd', ai: 'grammar' },
  aiExplain: { title: 'Explain Code', sub: 'Quick AI', icon: 'i-lucide-braces', kind: 'cmd', ai: 'explain' },
  aiSummarise: { title: 'Summarise', sub: 'Quick AI', icon: 'i-lucide-scroll-text', kind: 'cmd', ai: 'summarise' },
  aiCommit: { title: 'Write Commit Message', sub: 'Quick AI', icon: 'i-lucide-git-commit-horizontal', kind: 'cmd', ai: 'commit' },
  lock: { title: 'Lock Screen', sub: 'System', icon: 'i-lucide-lock', kind: 'sys' },
  theme: { title: 'Toggle Light / Dark', sub: 'System · Appearance', icon: 'i-lucide-sun-moon', kind: 'sys', go: 'theme' },
  settings: { title: 'Esky Settings', sub: 'Preferences', icon: 'i-lucide-settings', kind: 'cmd', keys: ['Ctrl', ','], go: 'settings' },
  shortcuts: { title: 'Keyboard Shortcuts', sub: 'Esky Settings', icon: 'i-lucide-keyboard', kind: 'cmd', go: 'shortcuts' },
}

export const RECENT: string[] = []
export const SUGGEST = ['grammar', 'theme', 'settings']
// File Explorer and Windows Terminal are on every Windows 11 PC; missing ones are skipped.
export const FAVS = ['app:Microsoft.Windows.Explorer', 'app:Microsoft.WindowsTerminal_8wekyb3d8bbwe!App', 'clip']

export const KIND_LABEL: Record<string, string> = { app: 'Application', cmd: 'Command', file: 'File', link: 'Quicklink', snip: 'Snippet', win: 'Window', sys: 'System' }

export const GROUPS: [Kind, string][] = [['app', 'Applications'], ['cmd', 'Commands'], ['link', 'Quicklinks'], ['snip', 'Snippets'], ['win', 'Window Management'], ['sys', 'System'], ['file', 'Files']]

export interface AiCmd { id: string, title: string, icon: string, keys: string[] }

export const AI_CMDS: AiCmd[] = [
  { id: 'grammar', title: 'Fix Grammar', icon: 'i-lucide-spell-check', keys: ['Ctrl', '1'] },
  { id: 'explain', title: 'Explain Code', icon: 'i-lucide-braces', keys: ['Ctrl', '2'] },
  { id: 'summarise', title: 'Summarise', icon: 'i-lucide-scroll-text', keys: ['Ctrl', '3'] },
  { id: 'commit', title: 'Write Commit Message', icon: 'i-lucide-git-commit-horizontal', keys: ['Ctrl', '4'] }
]

export interface Selection { text: string, app: string }

export const SEL: Selection = { text: 'i has went to the meeting yesterday and we discuss about the deploy schedule, its look fine to me but we needs to confirm the database migration first', app: 'Slack' }

export const AI_OUT: Record<string, string> = {
  grammar: 'I went to the meeting yesterday and we discussed the deploy schedule. It looks fine to me, but we need to confirm the database migration first.',
  explain: 'This selection is plain text rather than code. It is a status note: the deploy schedule was discussed yesterday and looks fine, pending confirmation of the database migration.\n\nSelect a snippet in your editor to get a line-by-line explanation.',
  summarise: 'Deploy schedule reviewed at yesterday\'s meeting and looks fine. The database migration still needs to be confirmed before going ahead.',
  commit: 'chore(deploy): hold release until migration is confirmed\n\nDeploy schedule reviewed in yesterday\'s meeting. Release waits on confirmation of the pending database migration.'
}

export const RATES: Record<string, number> = { usd: 1, aud: 1.524, eur: 0.921, gbp: 0.787, vnd: 25410, jpy: 149.3, nzd: 1.672 }

export const UNITS: Record<string, [string, number, string]> = { km: ['len', 1000, 'km'], mi: ['len', 1609.344, 'mi'], m: ['len', 1, 'm'], ft: ['len', 0.3048, 'ft'], cm: ['len', 0.01, 'cm'], in: ['len', 0.0254, 'in'], kg: ['mass', 1, 'kg'], lb: ['mass', 0.45359237, 'lb'], g: ['mass', 0.001, 'g'], oz: ['mass', 0.028349523, 'oz'], c: ['temp', 0, '°C'], f: ['temp', 0, '°F'], l: ['vol', 1, 'L'], gal: ['vol', 3.785411784, 'gal'] }

export const DIM: Record<string, string> = { len: 'Length', mass: 'Mass', temp: 'Temperature', vol: 'Volume' }




export type ServerStatus = 'active' | 'provisioning' | 'stopped'



export const STATUS: Record<ServerStatus, [string, string]> = { active: ['Active', 'var(--ok)'], provisioning: ['Provisioning', 'var(--warn)'], stopped: ['Stopped', 'var(--err)'] }


const CODE = String.raw`<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use SoftDeletes;

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        // Admins also see soft-deleted orders
        return $user->isAdmin()
            ? $query->withTrashed()
            : $query;
    }
}`


export type ChatBlock =
  | { type: 'p', text: string }
  | { type: 'code', lang: string, file: string, code: string }
  | { type: 'list', items: string[] }

export interface ChatMsg {
  role: 'user' | 'assistant'
  blocks: ChatBlock[]
  attach?: string | null
  /** What was sent or received, as plain text (the API key backend replays it). */
  text?: string
}

export const CHAT_INIT: ChatMsg[] = [
  { role: 'user', blocks: [{ type: 'p', text: 'How do I add a soft-delete scope to my Order model so only admins can see trashed orders?' }] },
  { role: 'assistant', blocks: [
    { type: 'p', text: 'Add the `SoftDeletes` trait to the model, then expose trashed records through a local scope that checks the user\'s role.' },
    { type: 'code', lang: 'php', file: 'app/Models/Order.php', code: CODE },
    { type: 'list', items: ['Add `$table->softDeletes();` to the orders migration', 'Query with `Order::visibleTo($request->user())->get()`', 'Restore a record with `$order->restore()`'] }
  ] }
]

export const CHAT_TAIL = 'If the admin panel needs a view of only deleted orders, add a second scope that calls onlyTrashed() so the two cases stay separate.'
export const REPLY = 'Yes. Chain it like any other scope, for example Order::visibleTo($user)->where(\'status\', \'paid\')->latest()->paginate(20). The withTrashed() call only widens the query for admins, so filters and pagination behave the same for everyone.'
export const CHATS = [{ g: 'Today', items: ['Soft-delete scope for orders', 'Queue retry backoff'] }, { g: 'This week', items: ['Tailwind v4 migration notes', 'Regex for AU phone numbers', 'Tauri window focus on Alt+Space'] }]

export const MODS = ['Ctrl', 'Win', 'Alt', 'Shift']

export const WIN_CMDS: WinCmd[] = [
  { id: 'wLeft', title: 'Left Half', icon: 'i-lucide-panel-left', g: 'Halves', r: [0, 0, 50, 100], keys: ['Ctrl', 'Alt', '←'] },
  { id: 'wRight', title: 'Right Half', icon: 'i-lucide-panel-right', g: 'Halves', r: [50, 0, 50, 100], keys: ['Ctrl', 'Alt', '→'] },
  { id: 'wTop', title: 'Top Half', icon: 'i-lucide-panel-top', g: 'Halves', r: [0, 0, 100, 50], keys: ['Ctrl', 'Alt', '↑'] },
  { id: 'wBottom', title: 'Bottom Half', icon: 'i-lucide-panel-bottom', g: 'Halves', r: [0, 50, 100, 50], keys: ['Ctrl', 'Alt', '↓'] },
  { id: 'wT1', title: 'First Third', icon: 'i-lucide-columns-3', g: 'Thirds', r: [0, 0, 33.33, 100], keys: ['Ctrl', 'Alt', 'D'] },
  { id: 'wT2', title: 'Centre Third', icon: 'i-lucide-columns-3', g: 'Thirds', r: [33.33, 0, 33.34, 100], keys: ['Ctrl', 'Alt', 'F'] },
  { id: 'wT3', title: 'Last Third', icon: 'i-lucide-columns-3', g: 'Thirds', r: [66.67, 0, 33.33, 100], keys: ['Ctrl', 'Alt', 'G'] },
  { id: 'wTT1', title: 'First Two Thirds', icon: 'i-lucide-columns-2', g: 'Thirds', r: [0, 0, 66.67, 100], keys: ['Ctrl', 'Alt', 'T'] },
  { id: 'wMax', title: 'Maximise', icon: 'i-lucide-maximize-2', g: 'Size and position', r: [0, 0, 100, 100], keys: ['Ctrl', 'Alt', '↵'] },
  { id: 'wCenter', title: 'Centre', icon: 'i-lucide-square-dashed', g: 'Size and position', r: [20, 15, 60, 70], keys: ['Ctrl', 'Alt', 'C'] },
  { id: 'wRestore', title: 'Restore', icon: 'i-lucide-minimize-2', g: 'Size and position', r: [14, 12, 52, 60], keys: ['Ctrl', 'Alt', '⌫'] },
  { id: 'wNext', title: 'Move to Next Display', icon: 'i-lucide-monitor-up', g: 'Displays', display: true, keys: ['Ctrl', 'Alt', 'Shift', '→'] }
]

/** The snippets Esky starts with; yours are edited in Settings → Snippets (see useSnippets). */
export const DEFAULT_SNIPS: Snippet[] = [
  { id: 'sn_date', name: 'Today’s date', kw: ';date', folder: 'General', text: '{date}' },
  { id: 'sn_time', name: 'Current time', kw: ';time', folder: 'General', text: '{time}' },
  { id: 'sn_shrug', name: 'Shrug', kw: ';shrug', folder: 'General', text: '¯\\_(ツ)_/¯' }
]

/** The quicklinks Esky starts with; yours are edited in Settings → Quicklinks (see useQuicklinks). */
export const DEFAULT_QLINKS: Quicklink[] = [
  { id: 'q1', name: 'GitHub Search', kw: 'gh', url: 'https://github.com/search?q={query}', icon: 'i-lucide-github', tile: '#1E293B', arg: 'Query' },
  { id: 'q2', name: 'Laravel Docs', kw: 'ld', url: 'https://laravel.com/framework/docs/master/{page}', icon: 'i-lucide-book-open', tile: '#E11D48', arg: 'Page' },
  { id: 'q3', name: 'Forge Site', kw: 'site', url: 'https://forge.laravel.com/sites?search={site}', icon: 'i-lucide-hammer', tile: '#EA580C', arg: 'Site' }
]

/** A file from File Search (see useFiles). */
export interface FileEntry {
  /** The full path, which also identifies it. */
  id: string
  name: string
  dir: string
  size: number
  /** Last modified (ms). */
  modified: number
}

export interface Emoji { e: string, n: string }

export const EMOJI: { title: string, items: Emoji[] }[] = ([
  ['SMILEYS', '😀 grinning|😄 smile|😂 joy laughing|🙂 slight smile|😉 wink|😍 heart eyes|🤔 thinking|😅 sweat smile|😎 cool sunglasses|🥲 smiling tear|😬 grimace|🙃 upside down|😴 sleeping|🤯 mind blown|🥳 party'],
  ['GESTURES', '👍 thumbs up|👎 thumbs down|👏 clap|🙌 raised hands|🙏 thanks pray|👋 wave hello|✌️ victory peace|🤝 handshake|💪 strong|👀 eyes looking|🫡 salute|🤞 fingers crossed'],
  ['OBJECTS', '🚀 rocket deploy|🐛 bug|🔥 fire|✅ check done|❌ cross no|⚠️ warning|💡 idea bulb|📌 pin|📎 paperclip|🔒 lock|🎉 tada celebrate|☕ coffee|📦 package|🧪 test tube'],
  ['SYMBOLS', '→ right arrow|← left arrow|↑ up arrow|↓ down arrow|✓ check mark|• bullet|… ellipsis|— em dash|° degree|± plus minus|× multiply|≈ approximately|≠ not equal|€ euro|£ pound|© copyright|™ trademark|⌘ command']
] as const).map(([title, src]) => ({
  title,
  items: src.split('|').map((x) => {
    const i = x.indexOf(' ')
    return { e: x.slice(0, i), n: x.slice(i + 1) }
  })
}))

export interface Note { id: string, body: string, updated: string }

export const NOTES_INIT: Note[] = [
  { id: 'n1', body: 'Northwind standup\n- Soft-delete migration is ready\n- Waiting on client sign-off for the export timezone fix\n- Queue worker memory looks stable', updated: 'Today, 09:05' },
  { id: 'n2', body: 'Quote ideas\nFixed price for phase 1, hourly for support after launch.', updated: 'Yesterday, 16:40' },
  { id: 'n3', body: 'Port 5173 gets stuck after Vite crashes. Killing whatever holds the port fixes it.', updated: 'Fri 3 Oct' }
]

export const SYS_CONFIRM: Record<string, [string, string, string, string]> = {
  restart: ['Restart your PC?', 'Open apps will be asked to close first.', 'Restart', 'Restarting…'],
  shutdown: ['Shut down your PC?', 'Open apps will be asked to close first.', 'Shut Down', 'Shutting down…'],
  signout: ['Sign out of Windows?', 'Unsaved work in open apps may be lost.', 'Sign Out', 'Signing out…']
}

export const ONB_HK: [string[], string][] = [[['Alt', 'Space'], 'Default. Works on every keyboard layout.'], [['Ctrl', 'Space'], 'Can clash with input method switching.'], [['Win', 'Alt', 'Space'], 'Leaves Alt Space free for other apps.']]
export const ONB_TG: Record<string, boolean> = { apps: true, store: true, herd: true, sel: true, clip: true, expand: true, startup: true }
export const ONB_ROWS: [string, string, string, string][][] = [
  // The counts in the first row are filled in from this PC (see Onboarding.vue).
  [['apps', 'Start menu apps', 'Desktop apps from the Start menu', 'i-lucide-layout-grid'], ['store', 'Microsoft Store apps', 'Apps installed from the Microsoft Store', 'i-lucide-shopping-bag'], ['herd', 'Laravel Herd sites', 'The sites Laravel Herd serves', 'i-lucide-feather']],
  [['sel', 'Read selected text', 'Used by Quick AI commands', 'i-lucide-text-cursor-input'], ['clip', 'Clipboard history', 'Kept on this PC only', 'i-lucide-clipboard-list'], ['expand', 'Text expansion', 'Watches typed keywords so snippets can expand', 'i-lucide-text-quote'], ['startup', 'Start with Windows', 'Esky waits in the tray', 'i-lucide-power']]
]
export const ONB_STEPS: [string, string][] = [['Welcome to Esky', 'Pick the shortcut that opens Esky from anywhere. You can change it later in Settings.'], ['Import your apps', 'Esky indexes these sources so they show up in search.'], ['Permissions', 'Each feature only asks for what it needs. Turn off anything you won’t use.'], ['You’re all set', 'A few shortcuts to get started.']]

export type SplitView = 'snippets' | 'quicklinks' | 'windows' | 'files' | 'store' | 'notes' | 'colors'
export const SPLIT: Record<string, 1> = { snippets: 1, quicklinks: 1, windows: 1, files: 1, store: 1, notes: 1, colors: 1 }
export const SPLIT_PH: Record<string, string> = { snippets: 'Search snippets…', quicklinks: 'Search quicklinks…', windows: 'Search window layouts…', files: 'Search files on this PC…', store: 'Search extensions…', notes: 'Search notes…', colors: 'Search saved colours…', emoji: 'Search emoji and symbols…' }

export interface FootApp { icon: string, tile: string, name: string }
export type FootHintDef = [string, string[], string?]

export const SPLIT_FOOT: Record<SplitView, [FootApp, FootHintDef[]]> = {
  snippets: [{ icon: 'i-lucide-text-quote', tile: '#0D9488', name: 'Snippets' }, [['Paste', ['↵'], 'split'], ['Copy', ['Ctrl', 'C'], 'sncopy'], ['Edit', ['Ctrl', 'E'], 'snedit']]],
  quicklinks: [{ icon: 'i-lucide-link', tile: '#2563EB', name: 'Quicklinks' }, [['Open', ['↵'], 'split'], ['Argument', ['Tab']], ['Edit', ['Ctrl', 'E'], 'qedit']]],
  windows: [{ icon: 'i-lucide-app-window', tile: '#475569', name: 'Window Layouts' }, [['Apply', ['↵'], 'split'], ['Set Hotkey', ['Ctrl', 'Shift', 'H'], 'hotkey']]],
  files: [{ icon: 'i-lucide-file-search', tile: '#CA8A04', name: 'File Search' }, [['Open', ['↵'], 'split'], ['Open With', ['Ctrl', 'O'], 'fwith']]],
  notes: [{ icon: 'i-lucide-sticky-note', tile: '#CA8A04', name: 'Floating Notes' }, [['Edit', ['Tab']], ['New Note', ['Ctrl', 'N'], 'nnew'], ['Float', ['Ctrl', 'Shift', 'F'], 'nfloat']]],
  store: [{ icon: 'i-lucide-store', tile: 'var(--accent)', name: 'Store' }, []],
  colors: [{ icon: 'i-lucide-pipette', tile: '#DB2777', name: 'Saved Colours' }, [['Copy', ['↵'], 'split'], ['Pick New', ['Ctrl', 'N'], 'colpick']]]
}

export const SPLIT_KEYS: Record<string, Record<string, string>> = {
  snippets: { 'ctrl+c': 'sncopy', 'ctrl+e': 'snedit' },
  quicklinks: { 'ctrl+e': 'qedit', 'ctrl+shift+c': 'qcopy', 'ctrl+shift+a': 'alias', 'ctrl+shift+h': 'hotkey' },
  windows: { 'ctrl+shift+h': 'hotkey' },
  files: { 'ctrl+o': 'fwith', 'ctrl+shift+c': 'fpath', 'ctrl+shift+e': 'freveal', 'ctrl+shift+a': 'fattach' },
  store: { 'ctrl+backspace': 'xuninstall' },
  notes: { 'ctrl+n': 'nnew', 'ctrl+shift+f': 'nfloat', 'ctrl+backspace': 'ndelete' },
  colors: { 'ctrl+n': 'colpick', 'ctrl+backspace': 'coldelete' }
}

Object.assign(ITEMS, {
  snipCmd: { title: 'Search Snippets', sub: 'Text expansion', icon: 'i-lucide-text-quote', kind: 'cmd', go: 'snippets' },
  qlCmd: { title: 'Search Quicklinks', sub: 'Esky', icon: 'i-lucide-link', kind: 'cmd', go: 'quicklinks' },
  winCmd: { title: 'Window Layouts', sub: 'Window Management', icon: 'i-lucide-layout-panel-left', kind: 'cmd', go: 'windows' },
  fileCmd: { title: 'Search Files', sub: 'This PC', icon: 'i-lucide-file-search', kind: 'cmd', go: 'files' },
  storeCmd: { title: 'Store', sub: 'Browse and manage extensions', icon: 'i-lucide-store', kind: 'cmd', go: 'store' },
  emojiCmd: { title: 'Search Emoji & Symbols', sub: 'Esky', icon: 'i-lucide-smile-plus', kind: 'cmd', go: 'emoji' },
  notesCmd: { title: 'Floating Notes', sub: 'Esky', icon: 'i-lucide-sticky-note', kind: 'cmd', go: 'notes' },
  tourCmd: { title: 'Welcome Tour', sub: 'Esky', icon: 'i-lucide-party-popper', kind: 'cmd', go: 'onboard' },
  herdSites: { title: 'Herd Sites', sub: 'Laravel Herd', icon: 'i-lucide-feather', tile: '#E11D48', kind: 'cmd', go: 'herdList' },
  switchCmd: { title: 'Switch Windows', sub: 'Window Management', icon: 'i-lucide-app-window', tile: '#4F46E5', kind: 'cmd', go: 'switch' },
  plainPaste: { title: 'Paste as Plain Text', sub: 'Clipboard', icon: 'i-lucide-clipboard-type', tile: '#0D9488', kind: 'cmd', go: 'plainPaste' },
  trCmd: { title: 'Google Translate', sub: 'Translate between two languages', icon: 'i-lucide-languages', tile: '#1A73E8', kind: 'cmd', go: 'translate' },
  dictCmd: { title: 'Dictionary', sub: 'Define an English word', icon: 'i-lucide-book-a', tile: '#0369A1', kind: 'cmd', go: 'dictionary' },
  gitChanges: { title: 'Uncommitted Changes', sub: 'Git', icon: 'i-lucide-git-branch', tile: '#F05032', kind: 'cmd', go: 'gitList' },
  pwGen: { title: 'Generate Password', sub: 'Password or passphrase', icon: 'i-lucide-key-round', tile: '#175DDC', kind: 'cmd', go: 'password' },
  sleep: { title: 'Sleep', sub: 'System', icon: 'i-lucide-moon', kind: 'sys' },
  restart: { title: 'Restart', sub: 'System', icon: 'i-lucide-rotate-ccw', kind: 'sys' },
  shutdown: { title: 'Shut Down', sub: 'System', icon: 'i-lucide-power', kind: 'sys' },
  signout: { title: 'Sign Out', sub: 'System', icon: 'i-lucide-log-out', kind: 'sys' },
  emptyBin: { title: 'Empty Recycle Bin', sub: 'System', icon: 'i-lucide-trash-2', kind: 'sys' },
  dnd: { title: 'Do Not Disturb', sub: 'Opens notification settings', icon: 'i-lucide-bell-off', kind: 'sys' },
  eject: { title: 'Eject All Drives', sub: 'System', icon: 'i-lucide-usb', kind: 'sys' }
} satisfies Record<string, Item>)

// No default system-wide hotkeys: window layouts don't move windows yet, and the keys would be taken from other apps.
WIN_CMDS.forEach((w) => {
  ITEMS[w.id] = { title: w.title, sub: 'Window Management', icon: w.icon, kind: 'win', win: w }
})

export const USAGE_INIT: Record<string, number> = {}
export const ALIASES_INIT: Record<string, string> = { forgeSearch: 'fs' }

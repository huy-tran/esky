// Clipboard History: what you copy (desktop app), kept on this PC. The watcher is in Rust
// (src-tauri/src/clipboard.rs); this decides what to keep, following Settings → Clipboard.
import { appName } from './useApps'
import { persistRef } from './usePersist'
import { isTauri } from './usePlatform'
import { useSettings } from './useSettings'

export type ClipKind = 'text' | 'link' | 'color' | 'image' | 'files'

export interface ClipEntry {
  id: string
  kind: ClipKind
  /** Text, link or colour. */
  text?: string
  files?: string[]
  /** Saved PNG, its preview, and its size. */
  imageFile?: string
  thumb?: string
  width?: number
  height?: number
  bytes?: number
  app: string
  /** When it was copied (ms). */
  at: number
  pinned?: boolean
}

/** What the Rust watcher sends for each copy. */
interface Copied {
  kind: 'text' | 'image' | 'files'
  text: string | null
  files: string[] | null
  imageFile: string | null
  thumb: string | null
  width: number | null
  height: number | null
  bytes: number | null
  appPath: string | null
  sensitive: boolean
}

const COLOR = /^(#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i
const LINK = /^https?:\/\/\S+$/i

export function classify(text: string): ClipKind {
  const t = text.trim()
  if (COLOR.test(t)) return 'color'
  if (LINK.test(t)) return 'link'
  return 'text'
}

async function forgetImage(e: ClipEntry) {
  if (!e.imageFile || !isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  invoke('clipboard_forget_image', { file: e.imageFile }).catch(() => {})
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const { settings } = useSettings()
  const history = ref<ClipEntry[]>([])
  const ready = persistRef('clipboard.history', history)

  /** Keep pinned entries; drop the rest past the length limit and the age limit. */
  function prune(list: ClipEntry[]) {
    const max = Number(settings.value.histLen) || Infinity
    const oldest = Date.now() - settings.value.keepDays * 86_400_000
    let kept = 0
    const out: ClipEntry[] = []
    for (const e of list) {
      if (e.pinned || (e.at >= oldest && kept < max)) {
        out.push(e)
        if (!e.pinned) kept++
      } else {
        forgetImage(e)
      }
    }
    return out
  }

  function add(c: Copied) {
    if (!settings.value.clipHistory) return
    const app = appName(c.appPath)
    const ignored = settings.value.ignored.some(i => i.name.toLowerCase() === app.toLowerCase() || (c.appPath ?? '').toLowerCase().includes(i.name.toLowerCase()))
    if ((c.sensitive && settings.value.ignorePm) || ignored) {
      if (c.imageFile) forgetImage({ imageFile: c.imageFile } as ClipEntry)
      return
    }
    if (c.sensitive) return // nothing was read
    const entry: ClipEntry = c.kind === 'text'
      ? { id: '', kind: classify(c.text!), text: c.text!, app, at: Date.now() }
      : c.kind === 'files'
        ? { id: '', kind: 'files', files: c.files!, app, at: Date.now() }
        : { id: '', kind: 'image', imageFile: c.imageFile!, thumb: c.thumb ?? undefined, width: c.width ?? undefined, height: c.height ?? undefined, bytes: c.bytes ?? undefined, app, at: Date.now() }
    entry.id = `c${entry.at.toString(36)}`
    // Copying the same thing again moves it to the top (and keeps its pin).
    const same = (e: ClipEntry) => e.kind === entry.kind && (entry.kind === 'image' ? false : e.text === entry.text && String(e.files) === String(entry.files))
    const prev = history.value.find(same)
    history.value = prune([{ ...entry, pinned: prev?.pinned }, ...history.value.filter(e => !same(e))])
  }

  /** Listen for copies (launcher window only) and follow the on/off setting. */
  async function start() {
    if (!isTauri()) return
    await ready
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    await listen<Copied>('clipboard://copied', e => add(e.payload))
    watch(() => settings.value.clipHistory, on => invoke('clipboard_watch', { enabled: on }), { immediate: true })
    // Apply the length and age limits now and whenever they change.
    watch(() => [settings.value.histLen, settings.value.keepDays], () => { history.value = prune(history.value) }, { immediate: true })
  }

  const remove = (id: string) => {
    const e = history.value.find(x => x.id === id)
    history.value = history.value.filter(x => x.id !== id)
    if (e) forgetImage(e)
  }

  /** Everything except pinned entries. */
  const clear = () => {
    for (const e of history.value) if (!e.pinned) forgetImage(e)
    history.value = history.value.filter(e => e.pinned)
  }

  const togglePin = (id: string) => {
    history.value = history.value.map(e => e.id === id ? { ...e, pinned: !e.pinned } : e)
  }

  const payload = (e: ClipEntry) => ({ text: e.text ?? null, imageFile: e.imageFile ?? null, files: e.files ?? null })

  /** Put an entry back on the clipboard. */
  async function copy(e: ClipEntry) {
    if (!isTauri()) return navigator.clipboard.writeText(e.text ?? '')
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('clipboard_copy', payload(e))
  }

  /** Paste an entry into the app Esky was opened from. */
  async function paste(e: ClipEntry) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('clipboard_paste', payload(e))
  }

  return { history, ready, start, remove, clear, togglePin, copy, paste }
}

export function useClipboard() {
  instance ??= create()
  return instance
}

/** "Copy" that clipboard tools shouldn't remember (a generated password, say). */
export async function copyPrivate(text: string) {
  if (!isTauri()) return navigator.clipboard.writeText(text)
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('copy_private', { text })
}

// Display helpers.

export const CLIP_ICON: Record<ClipKind, string> = { text: 'i-lucide-type', link: 'i-lucide-link', image: 'i-lucide-image', color: 'i-lucide-palette', files: 'i-lucide-file' }
export const CLIP_LABEL: Record<ClipKind, string> = { text: 'Text', link: 'Link', image: 'Image', color: 'Colour', files: 'Files' }

/** One line describing the entry, for lists. */
export function clipPreview(e: ClipEntry) {
  if (e.kind === 'image') return `Image ${e.width ?? '?'} × ${e.height ?? '?'}`
  if (e.kind === 'files') {
    const first = e.files![0]!.split(/[\/]/).pop()!
    return e.files!.length > 1 ? `${first} and ${e.files!.length - 1} more` : first
  }
  return (e.text ?? '').trim().split(/\r?\n/)[0]!
}

/** Which group an entry falls in by when it was copied. */
export function clipDay(at: number): 'Today' | 'Yesterday' | 'This week' | 'Older' {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const day = 86_400_000
  if (at >= start.getTime()) return 'Today'
  if (at >= start.getTime() - day) return 'Yesterday'
  if (at >= start.getTime() - 6 * day) return 'This week'
  return 'Older'
}

export function clipSize(e: ClipEntry) {
  if (e.kind === 'image') return e.bytes ? `${Math.round(e.bytes / 1024).toLocaleString()} KB` : ''
  if (e.kind === 'files') return `${e.files!.length} file${e.files!.length > 1 ? 's' : ''}`
  const t = e.text ?? ''
  const lines = t.split(/\r?\n/).length
  return `${lines > 1 ? `${lines} lines · ` : ''}${t.length.toLocaleString()} characters`
}

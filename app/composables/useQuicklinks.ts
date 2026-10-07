// Your quicklinks: saved URLs with a keyword, optionally taking an argument through a {placeholder}.
// Edited in Settings → Quicklinks; each one is also a search item, so favourites, aliases and hotkeys work.
import { DEFAULT_QLINKS, ITEMS, type Quicklink } from '~/data/fixtures'
import { persistRef } from './usePersist'

export interface QuicklinkInput { name: string, kw: string, url: string }

/** "{query}" -> "Query": the label for the text a quicklink asks for, or null when it takes none. */
export function argLabel(url: string): string | null {
  const m = url.match(/\{(\w+)\}/)
  if (!m) return null
  const w = m[1]!.replace(/_/g, ' ')
  return w[0]!.toUpperCase() + w.slice(1)
}

/** Problems with a quicklink, or an empty list when it can be saved. */
export function quicklinkErrors(q: QuicklinkInput, others: Quicklink[]): string[] {
  const errors: string[] = []
  if (!q.name.trim()) errors.push('Give it a name.')
  // Web pages, or files and folders (opened like double-clicking them).
  if (!/^(https?:\/\/\S+|[a-z]:\\|\\\\\S)/i.test(q.url.trim())) errors.push('Use a web address (https://…) or a file or folder path (C:\\…).')
  const kw = q.kw.trim().toLowerCase()
  if (kw && /\s/.test(kw)) errors.push('The keyword can’t contain spaces.')
  if (kw && others.some(o => o.kw === kw)) errors.push(`“${kw}” is already another quicklink’s keyword.`)
  return errors
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const list = ref<Quicklink[]>(DEFAULT_QLINKS.map(q => ({ ...q })))
  /** Bumped whenever quicklink items in ITEMS change (ITEMS isn't reactive). */
  const version = ref(0)
  const ready = persistRef('quicklinks', list)

  function register() {
    for (const id of Object.keys(ITEMS)) if (ITEMS[id]!.qlink) delete ITEMS[id]
    for (const q of list.value) ITEMS[q.id] = { title: q.name, sub: q.url, icon: q.icon, tile: q.tile, kind: 'link', qlink: q }
    version.value++
  }
  register()
  watch(list, register, { deep: true })

  const build = (q: QuicklinkInput, base?: Quicklink): Quicklink => ({
    id: base?.id ?? `ql_${Date.now().toString(36)}`,
    name: q.name.trim(),
    kw: q.kw.trim().toLowerCase(),
    url: q.url.trim(),
    icon: base?.icon ?? 'i-lucide-link',
    tile: base?.tile ?? '#2563EB',
    arg: argLabel(q.url)
  })

  const add = (q: QuicklinkInput) => {
    const ql = build(q)
    list.value = [...list.value, ql]
    return ql
  }
  const update = (id: string, q: QuicklinkInput) => {
    list.value = list.value.map(x => x.id === id ? build(q, x) : x)
  }
  const remove = (id: string) => {
    list.value = list.value.filter(x => x.id !== id)
  }

  return { list, version, ready, add, update, remove }
}

export function useQuicklinks() {
  instance ??= create()
  return instance
}

// Your snippets: text you paste from Esky, or expand anywhere by typing the keyword (e.g. ";date").
// Edited in Settings → Snippets; each is also a search item, so favourites, aliases and hotkeys work.
import { DEFAULT_SNIPS, ITEMS, type Snippet } from '~/data/fixtures'
import { persistRef } from './usePersist'

export interface SnippetInput { name: string, kw: string, folder: string, text: string }

/** {date}, {time}, {clipboard} and {cursor} are filled in when the snippet is used. */
export const SNIPPET_PLACEHOLDERS = ['{date}', '{time}', '{clipboard}', '{cursor}']

export function snippetErrors(s: SnippetInput, others: Snippet[]): string[] {
  const errors: string[] = []
  if (!s.name.trim()) errors.push('Give it a name.')
  if (!s.text) errors.push('Add the text to paste.')
  const kw = s.kw.trim()
  if (kw && /\s/.test(kw)) errors.push('The keyword can’t contain spaces.')
  if (kw.length > 32) errors.push('Keep the keyword under 32 characters.')
  if (kw && others.some(o => o.kw === kw)) errors.push(`“${kw}” is already another snippet’s keyword.`)
  return errors
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const list = ref<Snippet[]>(DEFAULT_SNIPS.map(s => ({ ...s })))
  const version = ref(0)
  const ready = persistRef('snippets', list)

  function register() {
    for (const id of Object.keys(ITEMS)) if (ITEMS[id]!.snip) delete ITEMS[id]
    for (const s of list.value) ITEMS[s.id] = { title: s.name, sub: s.kw || s.folder, icon: 'i-lucide-text-quote', kind: 'snip', snip: s }
    version.value++
  }
  register()
  watch(list, register, { deep: true })

  const build = (s: SnippetInput, base?: Snippet): Snippet => ({
    id: base?.id ?? `sn_${Date.now().toString(36)}`,
    name: s.name.trim(),
    kw: s.kw.trim(),
    folder: s.folder.trim() || 'General',
    text: s.text,
    lastUsed: base?.lastUsed
  })

  const add = (s: SnippetInput) => {
    list.value = [...list.value, build(s)]
  }
  const update = (id: string, s: SnippetInput) => {
    list.value = list.value.map(x => x.id === id ? build(s, x) : x)
  }
  const remove = (id: string) => {
    list.value = list.value.filter(x => x.id !== id)
  }
  const used = (id: string) => {
    list.value = list.value.map(x => x.id === id ? { ...x, lastUsed: Date.now() } : x)
  }
  const folders = computed(() => [...new Set(list.value.map(s => s.folder))].sort((a, b) => a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)))

  return { list, version, ready, folders, add, update, remove, used }
}

export function useSnippets() {
  instance ??= create()
  return instance
}

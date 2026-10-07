// Your own Quick AI commands (Settings → AI): a name, an icon and an instruction for Claude.
// Each is also a search item, so favourites, aliases and hotkeys work, and it runs on selected text.
import { ITEMS } from '~/data/fixtures'
import { CUSTOM_SYSTEM } from '~/utils/claude'
import { persistRef } from './usePersist'

export interface AiCommand { id: string, title: string, icon: string, prompt: string }
export interface AiCommandInput { title: string, icon: string, prompt: string }

export const AI_ICONS = [
  'i-lucide-sparkles', 'i-lucide-wand-sparkles', 'i-lucide-pen-line', 'i-lucide-message-square-text', 'i-lucide-file-text', 'i-lucide-code',
  'i-lucide-bug', 'i-lucide-mail', 'i-lucide-list-checks', 'i-lucide-smile', 'i-lucide-briefcase', 'i-lucide-ticket', 'i-lucide-table', 'i-lucide-scissors'
]

export function aiCommandErrors(c: AiCommandInput): string[] {
  const errors: string[] = []
  if (!c.title.trim()) errors.push('Give it a name.')
  if (!c.prompt.trim()) errors.push('Say what Claude should do with the text.')
  if (c.prompt.length > 4000) errors.push('Keep the instruction under 4,000 characters.')
  return errors
}

/** The system prompt for a command: your instruction, applied to the text sent. */
const systemFor = (c: AiCommand) => `${c.prompt.trim()}\n\nApply this to the text the user sends. Reply with only the result: no preamble, no quotes, no explanation.`

let instance: ReturnType<typeof create> | null = null

function create() {
  const list = ref<AiCommand[]>([])
  /** Bumped whenever these items in ITEMS change (ITEMS isn't reactive). */
  const version = ref(0)
  const ready = persistRef('aiCommands', list)

  function register() {
    for (const id of Object.keys(ITEMS)) if (id.startsWith('aic_')) delete ITEMS[id]
    for (const k of Object.keys(CUSTOM_SYSTEM)) delete CUSTOM_SYSTEM[k]
    for (const c of list.value) {
      ITEMS[c.id] = { title: c.title, sub: 'Quick AI', icon: c.icon, kind: 'cmd', ai: c.id }
      CUSTOM_SYSTEM[c.id] = systemFor(c)
    }
    version.value++
  }
  register()
  watch(list, register, { deep: true })

  const build = (c: AiCommandInput, id?: string): AiCommand => ({ id: id ?? `aic_${Date.now().toString(36)}`, title: c.title.trim(), icon: c.icon, prompt: c.prompt.trim() })
  const add = (c: AiCommandInput) => { list.value = [...list.value, build(c)] }
  const update = (id: string, c: AiCommandInput) => { list.value = list.value.map(x => x.id === id ? build(c, id) : x) }
  const remove = (id: string) => { list.value = list.value.filter(x => x.id !== id) }

  return { list, version, ready, add, update, remove }
}

export function useAiCommands() {
  instance ??= create()
  return instance
}

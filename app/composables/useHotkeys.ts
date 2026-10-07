// System-wide hotkeys: Esky's own (Settings → General) and one per command or app.
// Shared by the launcher and the Settings window; both see changes through the `hotkeys` store key.
import { ITEMS, MODS } from '~/data/fixtures'
import { persistRef } from './usePersist'
import { useSettings } from './useSettings'

/** Stands for Esky's own hotkey (the one that opens the launcher) in `check` and `assign`. */
export const LAUNCHER = 'launcher'

/** Combinations Windows itself uses. Allowed, but only after a warning. */
export const WINDOWS_RESERVED: Record<string, string> = {
  'Ctrl+Space': 'Windows uses it to switch the input method for some keyboards.',
  'Alt+Tab': 'Windows uses it to switch between open windows.',
  'Win+Space': 'Windows uses it to switch keyboard layout.',
  'Ctrl+Shift+Esc': 'Windows uses it to open Task Manager.',
  'Alt+F4': 'Windows uses it to close the active window.',
  'Ctrl+Alt+Delete': 'Reserved by Windows.',
  'Win+L': 'Windows uses it to lock the PC.',
  'Win+D': 'Windows uses it to show the desktop.',
  'Win+E': 'Windows uses it to open File Explorer.',
  'Win+V': 'Windows uses it for its own clipboard history.'
}

export interface HotkeyCheck {
  /** Can't be used at all. */
  error?: string
  /** Usable, but Windows or another app expects it. */
  warning?: string
  /** The command that has it now; assigning moves it here. */
  ownerId?: string | null
}

/** A combination that works system-wide: a modifier first, then a key. */
export const isGlobal = (keys: string[] | undefined): keys is string[] => !!keys && keys.length > 1 && MODS.includes(keys[0]!)

let instance: ReturnType<typeof create> | null = null

function create() {
  const { settings } = useSettings()
  /** Overrides by item id. An empty list means "no hotkey" (cleared); a missing id means the default. */
  const hotkeys = ref<Record<string, string[]>>({})
  const ready = persistRef('hotkeys', hotkeys)

  const keysFor = (id: string): string[] | undefined =>
    id === LAUNCHER ? settings.value.hotkey : hotkeys.value[id] ?? ITEMS[id]?.keys

  /** The command whose system-wide hotkey is `str` (e.g. "Ctrl+Alt+T"), other than `except`. */
  const ownerOf = (str: string, except: string | null) =>
    Object.keys(ITEMS).find((id) => {
      if (id === except) return false
      const ks = keysFor(id)
      return isGlobal(ks) && ks.join('+') === str
    }) ?? null

  function check(combo: string[], id: string): HotkeyCheck {
    if (!combo.some(k => k === 'Ctrl' || k === 'Alt' || k === 'Win')) return { error: 'Include Ctrl, Alt or Win in the combination.' }
    const str = combo.join('+')
    if (id !== LAUNCHER && str === settings.value.hotkey.join('+')) return { error: `${combo.join(' + ')} opens Esky, so it can’t be assigned to a command.` }
    return { ownerId: ownerOf(str, id === LAUNCHER ? null : id), warning: WINDOWS_RESERVED[str] }
  }

  /** Give `id` this hotkey (an empty list removes it), taking it from whichever command had it. Returns that command's id. */
  function assign(id: string, combo: string[]): string | null {
    const owner = combo.length ? ownerOf(combo.join('+'), id === LAUNCHER ? null : id) : null
    const next = { ...hotkeys.value }
    if (owner) next[owner] = []
    if (id === LAUNCHER) settings.value = { ...settings.value, hotkey: combo }
    else next[id] = combo
    hotkeys.value = next
    return owner
  }

  /** Back to the command's default hotkey (or none). */
  function reset(id: string) {
    if (id === LAUNCHER) return assign(LAUNCHER, ['Alt', 'Space'])
    const { [id]: _, ...rest } = hotkeys.value
    hotkeys.value = rest
    return null
  }

  const isCustom = (id: string) => id in hotkeys.value

  return { hotkeys, ready, keysFor, ownerOf, check, assign, reset, isCustom }
}

export function useHotkeys() {
  instance ??= create()
  return instance
}

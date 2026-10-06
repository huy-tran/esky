// Installed / enabled extensions and their saved preferences, shared by the launcher and Settings.
import { ALIASES_INIT } from '~/data/fixtures'
import { DEFAULT_INSTALLED, commandItemId, extById, withDefaults, type ExtensionDef, type Prefs } from '~/extensions/registry'
import { persistRef } from './usePersist'

let aliasesInstance: Ref<Record<string, string>> | null = null

/** Aliases: Ctrl+Shift+A in the launcher and each extension's Alias preference share this list. */
export function useAliases() {
  if (!aliasesInstance) {
    aliasesInstance = ref<Record<string, string>>({ ...ALIASES_INIT })
    persistRef('aliases', aliasesInstance)
  }
  return aliasesInstance
}

/** The search item an extension's Alias preference points at: its first command. */
const aliasTarget = (ext: ExtensionDef) => ext.commands[0] ? commandItemId(ext, ext.commands[0]) : null
const hasAlias = (ext: ExtensionDef) => ext.prefs.some(f => f.key === 'alias')

function create() {
  const installed = ref<string[]>([...DEFAULT_INSTALLED])
  const disabled = ref<string[]>([])
  const prefs = ref<Record<string, Prefs>>({})
  const aliases = useAliases()

  const ready = Promise.all([
    persistRef('ext.installed', installed),
    persistRef('ext.disabled', disabled),
    persistRef('ext.prefs', prefs)
  ])

  const isInstalled = (id: string) => !!extById(id)?.builtIn || installed.value.includes(id)
  /** Installed and switched on in Settings. */
  const isActive = (id: string) => isInstalled(id) && !disabled.value.includes(id)

  /** Saved preferences with defaults filled in (secrets excluded; see useSecrets). */
  function prefsFor(id: string): Prefs {
    const ext = extById(id)
    if (!ext) return {}
    const p = withDefaults(ext, prefs.value[id])
    const target = aliasTarget(ext)
    if (hasAlias(ext) && target) p.alias = aliases.value[target] ?? ''
    return p
  }

  function savePrefs(id: string, values: Prefs) {
    const ext = extById(id)
    if (!ext) return
    const { alias, ...rest } = values
    prefs.value = { ...prefs.value, [id]: rest }
    const target = aliasTarget(ext)
    if (target && hasAlias(ext)) {
      const a = { ...aliases.value }
      const v = String(alias ?? '').trim().toLowerCase()
      // An alias belongs to one command at a time.
      for (const k of Object.keys(a)) if (k !== target && a[k] === v) delete a[k]
      if (v) a[target] = v
      else delete a[target]
      aliases.value = a
    }
  }

  const setEnabled = (id: string, on: boolean) => {
    disabled.value = on ? disabled.value.filter(x => x !== id) : [...new Set([...disabled.value, id])]
  }
  const install = (id: string) => {
    installed.value = [...new Set([...installed.value, id])]
  }
  const uninstall = (id: string) => {
    installed.value = installed.value.filter(x => x !== id)
  }

  return { installed, disabled, prefs, ready, isInstalled, isActive, prefsFor, savePrefs, setEnabled, install, uninstall }
}

let instance: ReturnType<typeof create> | null = null

export function useExtensions() {
  instance ??= create()
  return instance
}

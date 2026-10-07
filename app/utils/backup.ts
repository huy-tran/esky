// Settings → General → Back up: everything you set up, as one JSON file, to move to another PC.
// Tokens and API keys stay in Windows Credential Manager and are never included. Clipboard
// history, chats and caches are left out too.
import { loadKey, saveKey } from '~/composables/usePersist'

/** Saved keys that make up your setup. */
export const BACKUP_KEYS = [
  'settings', 'favs', 'disabled', 'aliases', 'hotkeys', 'usage', 'recent', 'ext.installed', 'ext.disabled', 'ext.prefs',
  'quicklinks', 'snippets', 'aiCommands', 'notes', 'colours.saved', 'password.opts', 'translate.langs'
]

interface Backup { app: 'esky', format: 1, exported: string, data: Record<string, unknown> }

export async function exportBackup(): Promise<string> {
  const data: Record<string, unknown> = {}
  for (const k of BACKUP_KEYS) {
    const v = await loadKey(k)
    if (v !== undefined) data[k] = v
  }
  const b: Backup = { app: 'esky', format: 1, exported: new Date().toISOString(), data }
  return JSON.stringify(b, null, 2)
}

/** Apply a backup file's contents. Returns how many parts were restored. */
export async function importBackup(json: string): Promise<number> {
  let b: Partial<Backup>
  try {
    b = JSON.parse(json)
  } catch {
    throw new Error('That file isn’t valid JSON')
  }
  if (b.app !== 'esky' || b.format !== 1 || !b.data || typeof b.data !== 'object') throw new Error('That isn’t an Esky settings backup')
  let n = 0
  for (const k of BACKUP_KEYS) {
    if (k in b.data) {
      await saveKey(k, b.data[k])
      n++
    }
  }
  // A restored setup doesn't need the welcome tour.
  await saveKey('onboarded', true)
  return n
}

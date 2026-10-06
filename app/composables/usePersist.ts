// Disk persistence: Tauri store (esky.json) in the desktop app, localStorage in the browser.
import type { Store } from '@tauri-apps/plugin-store'
import { isTauri } from './usePlatform'

let store: Promise<Store> | null = null

function tauriStore() {
  store ??= import('@tauri-apps/plugin-store').then(m => m.load('esky.json', { autoSave: 200, defaults: {} }))
  return store
}

export async function loadKey<T>(key: string): Promise<T | undefined> {
  if (isTauri()) return (await tauriStore()).get<T>(key)
  try {
    const raw = localStorage.getItem(`esky:${key}`)
    return raw == null ? undefined : JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export async function saveKey(key: string, value: unknown) {
  if (isTauri()) {
    await (await tauriStore()).set(key, value)
    return
  }
  try {
    localStorage.setItem(`esky:${key}`, JSON.stringify(value))
  } catch {
    // storage full or blocked
  }
}

/** Called when another window changes `key`. */
export async function watchKey<T>(key: string, cb: (v: T | undefined) => void) {
  if (isTauri()) return (await tauriStore()).onKeyChange<T>(key, cb)
  const h = (e: StorageEvent) => {
    if (e.key === `esky:${key}`) cb(e.newValue == null ? undefined : JSON.parse(e.newValue))
  }
  window.addEventListener('storage', h)
  return () => window.removeEventListener('storage', h)
}

/**
 * Two-way bind a ref to a persisted key: load once, save on change, follow other windows.
 * Returns a promise that resolves after the initial load.
 */
export function persistRef<T>(key: string, r: Ref<T>, opts: { merge?: boolean } = {}) {
  // The Tauri store reports every change back to the window that made it, too. Comparing with the
  // last value saved or received stops that echo from saving again, which would loop forever.
  let last: string | undefined
  const apply = (v: T) => {
    r.value = opts.merge ? { ...r.value, ...v } : v
    last = JSON.stringify(r.value)
  }
  const ready = loadKey<T>(key).then((v) => {
    if (v !== undefined) apply(v)
    else last = JSON.stringify(r.value)
    watch(r, (v) => {
      const json = JSON.stringify(v)
      if (json === last) return
      last = json
      saveKey(key, toRaw(v))
    }, { deep: true })
    watchKey<T>(key, (v) => {
      if (v !== undefined && JSON.stringify(v) !== last) apply(v)
    })
  })
  return ready
}

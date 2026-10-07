// Installed apps from the Start menu (desktop app only; the browser preview has none).
// Each app becomes a search item `app:<AppsFolder id>`, so favourites, recents, aliases and hotkeys work as for any command.
import { ITEMS } from '~/data/fixtures'
import { isTauri } from './usePlatform'

export interface InstalledApp {
  /** AppsFolder id (an AppUserModelID or a known-folder path). */
  id: string
  name: string
  /** The .exe behind it, when Windows knows it (not for Store apps). */
  path: string | null
}

export const appItemId = (id: string) => `app:${id}`

/** An app's name from its .exe path: its Start menu name if Esky knows it, else the file name. */
export function appName(path: string | null | undefined) {
  if (!path) return 'Unknown app'
  const p = path.toLowerCase()
  const known = Object.values(ITEMS).find(it => it.app?.path?.toLowerCase() === p)
  return known?.title ?? path.split(/[\\/]/).pop()!.replace(/\.exe$/i, '')
}

/** Microsoft Store (packaged) apps have ids like "Microsoft.WindowsTerminal_8wekyb3d8bbwe!App". */
export const isStoreApp = (a: { id: string }) => /_[a-z0-9]{13}!/i.test(a.id)

/** Reload the list when the launcher opens and it's older than this, to pick up new installs. */
const STALE_MS = 10 * 60 * 1000

let instance: ReturnType<typeof create> | null = null

function create() {
  const list = shallowRef<InstalledApp[]>([])
  /** Icon data URLs by search item id. */
  const icons = shallowRef<Record<string, string>>({})
  /** Bumped whenever app items are added to or removed from ITEMS (which isn't reactive). */
  const version = ref(0)
  const status = ref<'idle' | 'loading' | 'ready' | 'error' | 'unavailable'>('idle')
  let loadedAt = 0
  let loading: Promise<void> | null = null

  async function fetchIcons(ids: string[]) {
    if (!ids.length) return
    const { invoke } = await import('@tauri-apps/api/core')
    const got = await invoke<Record<string, string>>('app_icons', { ids })
    icons.value = { ...icons.value, ...Object.fromEntries(Object.entries(got).map(([id, url]) => [appItemId(id), url])) }
  }

  function load(): Promise<void> {
    if (!isTauri()) {
      status.value = 'unavailable'
      return Promise.resolve()
    }
    loading ??= (async () => {
      status.value = 'loading'
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const apps = await invoke<InstalledApp[]>('apps_list')
        for (const id of Object.keys(ITEMS)) if (id.startsWith('app:')) delete ITEMS[id]
        for (const a of apps) ITEMS[appItemId(a.id)] = { title: a.name, sub: '', icon: 'i-lucide-app-window', kind: 'app', app: { id: a.id, path: a.path, store: isStoreApp(a) } }
        list.value = apps
        version.value++
        status.value = 'ready'
        loadedAt = Date.now()
        // Icons come in the background; rows show a plain tile until then.
        fetchIcons(apps.map(a => a.id).filter(id => !icons.value[appItemId(id)])).catch(() => {})
      } catch {
        status.value = 'error'
      } finally {
        loading = null
      }
    })()
    return loading
  }

  const refreshIfStale = () => {
    if (isTauri() && Date.now() - loadedAt > STALE_MS) load()
  }

  /** Open the app, or (with `admin`) run its .exe as administrator. */
  async function launch(app: { id: string, path: string | null }, admin = false) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('app_launch', { id: app.id, admin })
  }

  return { list, icons, version, status, load, refreshIfStale, launch }
}

export function useApps() {
  instance ??= create()
  return instance
}

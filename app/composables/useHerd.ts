// Loads Laravel Herd sites: Tauri fs in the desktop app, the dev API route in the browser.
import { buildHerdSites, herdValetDir, type HerdSite, type HerdSnapshot } from '~/utils/herd'
import { isTauri } from './usePlatform'

async function loadFromTauri(configDir: string): Promise<HerdSite[]> {
  const { homeDir } = await import('@tauri-apps/api/path')
  const { exists, readDir, readTextFile } = await import('@tauri-apps/plugin-fs')
  const home = (await homeDir()).replace(/[\\/]$/, '')
  const valet = herdValetDir(home, configDir)
  const dirs = async (p: string) => {
    try {
      return (await readDir(p)).filter(e => e.isDirectory || e.isSymlink).map(e => e.name)
    } catch {
      return []
    }
  }
  const config = JSON.parse(await readTextFile(`${valet}\\config.json`))
  const parked: HerdSnapshot['parked'] = {}
  for (const p of config.paths || []) {
    parked[p] = await Promise.all((await dirs(p)).map(async name => ({ name, laravel: await exists(`${p}\\${name}\\artisan`) })))
  }
  // Herd links are junctions; the fs plugin can't resolve them, so the link itself is the path.
  const linked = await Promise.all((await dirs(`${valet}\\Sites`)).map(async (name) => {
    const path = `${valet}\\Sites\\${name}`
    return { name, path, laravel: await exists(`${path}\\artisan`) }
  }))
  let certificates: string[] = []
  try {
    certificates = (await readDir(`${valet}\\Certificates`)).map(e => e.name)
  } catch {
    // no secured sites
  }
  return buildHerdSites({ config, parked, linked, certificates }, home)
}

async function loadFromDevServer(configDir: string): Promise<HerdSite[]> {
  const res = await $fetch<{ sites: HerdSite[] }>('/api/herd/sites', { query: configDir ? { dir: configDir } : {} })
  return Array.isArray(res?.sites) ? res.sites : []
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const sites = ref<HerdSite[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')

  /** `configDir` is the Herd extension's "Herd config folder" preference; empty means the default. */
  async function load(configDir = '') {
    status.value = 'loading'
    try {
      sites.value = isTauri() ? await loadFromTauri(configDir) : await loadFromDevServer(configDir)
      status.value = 'ready'
      error.value = ''
    } catch (e) {
      status.value = 'error'
      error.value = (e as Error)?.message || 'Herd not found'
    }
  }

  return { sites, status, error, load }
}

export function useHerd() {
  instance ??= create()
  return instance
}

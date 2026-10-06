// Laravel Herd sites, built from Herd's own config (Windows: ~\.config\herd\config\valet).
// Pure logic shared by the dev API route (Node) and the desktop app (Tauri fs).

export interface HerdSite {
  name: string
  path: string
  url: string
  secured: boolean
  laravel: boolean
  linked: boolean
  /** Parked folder the site lives in, or 'Linked'. */
  group: string
}

export interface HerdConfig {
  tld?: string
  paths?: string[]
}

export interface HerdSnapshot {
  config: HerdConfig
  /** Folders inside each parked path, keyed by parked path. */
  parked: Record<string, { name: string, laravel: boolean }[]>
  /** Entries in valet\Sites (herd link). */
  linked: { name: string, path: string, laravel: boolean }[]
  /** File names in valet\Certificates, e.g. "brekkie-board.test.crt". */
  certificates: string[]
}

/** Herd's valet folder. `configDir` overrides ~\.config\herd (a leading ~ means the home folder). */
export const herdValetDir = (home: string, configDir = '') => {
  const base = configDir.trim() ? configDir.trim().replace(/^~(?=[\\/]|$)/, home).replace(/[\\/]+$/, '') : `${home}\\.config\\herd`
  return `${base}\\config\\valet`
}

/** Show C:\Users\<me>\Herd as ~\Herd. */
export const tildify = (path: string, home: string) => path.toLowerCase().startsWith(home.toLowerCase()) ? `~${path.slice(home.length)}` : path

export function buildHerdSites(snap: HerdSnapshot, home: string): HerdSite[] {
  const tld = snap.config.tld || 'test'
  const secured = new Set(snap.certificates.filter(f => f.endsWith('.crt')).map(f => f.slice(0, -4).toLowerCase()))
  const site = (name: string, path: string, laravel: boolean, linked: boolean, group: string): HerdSite => {
    const host = `${name.toLowerCase()}.${tld}`
    const isSecure = secured.has(host)
    return { name, path, url: `${isSecure ? 'https' : 'http'}://${host}`, secured: isSecure, laravel, linked, group }
  }
  const linked = snap.linked.map(l => site(l.name, l.path, l.laravel, true, 'Linked'))
  const taken = new Set(linked.map(l => l.name.toLowerCase()))
  const parked = (snap.config.paths || []).flatMap(p =>
    (snap.parked[p] || [])
      .filter(d => !d.name.startsWith('.') && !taken.has(d.name.toLowerCase()))
      .map(d => site(d.name, `${p}\\${d.name}`, d.laravel, false, tildify(p, home))))
  return [...linked, ...parked].sort((a, b) => a.group === b.group ? a.name.localeCompare(b.name) : 0)
}

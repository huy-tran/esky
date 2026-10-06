// Browser build only: read Herd's config from disk so the dev server can list real sites.
// The desktop app reads the same files through Tauri's fs plugin instead (see useHerd).
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { buildHerdSites, herdValetDir, type HerdSnapshot } from '../../../app/utils/herd'

const dirs = (p: string) => {
  try {
    return readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory() || d.isSymbolicLink()).map(d => d.name)
  } catch {
    return []
  }
}

export default defineEventHandler((event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404 })
  const home = homedir()
  const valet = herdValetDir(home, String(getQuery(event).dir ?? ''))
  const configFile = join(valet, 'config.json')
  if (!existsSync(configFile)) throw createError({ statusCode: 404, statusMessage: 'Herd is not installed' })

  const config = JSON.parse(readFileSync(configFile, 'utf8'))
  const snap: HerdSnapshot = {
    config,
    parked: Object.fromEntries((config.paths || []).map((p: string) => [p, dirs(p).map(name => ({ name, laravel: existsSync(join(p, name, 'artisan')) }))])),
    linked: dirs(join(valet, 'Sites')).map((name) => {
      let path = join(valet, 'Sites', name)
      try {
        path = realpathSync(path)
      } catch {
        // dangling link
      }
      return { name, path, laravel: existsSync(join(path, 'artisan')) }
    }),
    certificates: existsSync(join(valet, 'Certificates')) ? readdirSync(join(valet, 'Certificates')) : []
  }
  return { home, sites: buildHerdSites(snap, home) }
})

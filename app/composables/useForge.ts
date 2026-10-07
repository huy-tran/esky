// Laravel Forge (desktop app): servers, sites and deployments through Forge's API with your token.
// Requests go through Rust (api.rs), which adds the token from Credential Manager.
import { useExtensions } from './useExtensions'
import { isTauri } from './usePlatform'

const API = 'https://forge.laravel.com/api'

export type ServerStatus = 'active' | 'provisioning' | 'stopped'

export interface ForgeServer {
  id: string
  name: string
  slug: string
  ip: string
  sshPort: number
  php: string
  provider: string
  region: string
  size: string
  ubuntu: string
  status: ServerStatus
}

export interface ForgeSite {
  id: string
  name: string
  url: string
  status: string
  branch: string
  repository: string
}

export interface ForgeDeployment {
  id: string
  site: string
  status: string
  commit: string
  message: string
  author: string
  at: string
}

/** JSON:API resource. */
interface Resource { id: string, attributes: Record<string, any>, relationships?: Record<string, { data?: { id: string } | null }> }

export async function forgeApi<T = any>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  if (!isTauri()) throw new Error('Forge works in the desktop app')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>('ext_api', { ext: 'forge', method, url: `${API}${path}`, body: null, user: null })
}

const PROVIDER: Record<string, string> = { ocean2: 'DigitalOcean', digitalocean: 'DigitalOcean', aws: 'AWS', hetzner: 'Hetzner', vultr: 'Vultr', vultr2: 'Vultr', linode: 'Akamai (Linode)', akamai: 'Akamai (Linode)', laravel: 'Laravel VPS', custom: 'Your own server' }
export const providerName = (p: string) => PROVIDER[p.toLowerCase()] ?? p
export const providerIcon = (p: string) => /ocean/i.test(p) ? 'i-lucide-droplet' : /aws/i.test(p) ? 'i-lucide-cloud' : 'i-lucide-server'

const toServer = (r: Resource): ForgeServer => {
  const a = r.attributes
  const reachable = !a.connection_status || /success|connected/i.test(a.connection_status)
  return {
    id: String(a.id ?? r.id),
    name: a.name,
    slug: a.slug ?? '',
    ip: a.ip_address ?? '',
    sshPort: a.ssh_port ?? 22,
    php: (a.php_version ?? '').replace(/^php/, '').replace(/(\d)(\d)$/, '$1.$2'),
    provider: providerName(a.provider ?? ''),
    region: a.region ?? '',
    size: a.size ?? '',
    ubuntu: a.ubuntu_version ? `Ubuntu ${a.ubuntu_version}` : 'Ubuntu',
    status: !a.is_ready ? 'provisioning' : reachable ? 'active' : 'stopped'
  }
}

const toSite = (r: Resource): ForgeSite => ({
  id: r.id,
  name: r.attributes.name,
  url: r.attributes.url ?? `https://${r.attributes.name}`,
  status: r.attributes.deployment_status ?? r.attributes.status ?? '',
  branch: r.attributes.repository?.branch ?? '',
  repository: r.attributes.repository?.url ?? ''
})

const toDeployment = (r: Resource, sites: ForgeSite[]): ForgeDeployment => ({
  id: r.id,
  site: sites.find(s => s.id === r.relationships?.site?.data?.id)?.name ?? '',
  status: r.attributes.status,
  commit: (r.attributes.commit?.hash ?? '').slice(0, 7),
  message: r.attributes.commit?.message ?? '',
  author: r.attributes.commit?.author ?? '',
  at: r.attributes.created_at ?? r.attributes.started_at ?? ''
})

let instance: ReturnType<typeof create> | null = null

function create() {
  const exts = useExtensions()
  const servers = shallowRef<ForgeServer[]>([])
  const sites = shallowRef<Record<string, ForgeSite[]>>({})
  const deployments = shallowRef<Record<string, ForgeDeployment[]>>({})
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  let org = ''

  /** The organisation slug: the preference, or your first organisation. */
  async function organisation() {
    const pref = String(exts.prefsFor('forge').organization || '').trim()
    if (pref) return (org = pref)
    if (org) return org
    const res = await forgeApi<{ data: Resource[] }>('/orgs')
    const first = res.data[0]
    if (!first) throw new Error('Your Forge account has no organisations')
    return (org = first.attributes.slug ?? first.id)
  }

  async function load() {
    status.value = 'loading'
    try {
      const o = await organisation()
      const all: ForgeServer[] = []
      let next: string | null = `/orgs/${o}/servers`
      // Follow the cursor pages (a few at most for most accounts).
      for (let i = 0; next && i < 10; i++) {
        const res: { data: Resource[], links?: { next?: string } } = await forgeApi(next)
        all.push(...res.data.map(toServer))
        next = res.links?.next ? res.links.next.replace(API, '') : null
      }
      servers.value = all.sort((a, b) => a.name.localeCompare(b.name))
      status.value = 'ready'
      error.value = ''
    } catch (e) {
      status.value = 'error'
      error.value = String(e)
    }
  }

  /** A server's sites and its recent deployments. */
  async function loadServer(server: ForgeServer) {
    const o = await organisation()
    const s = (await forgeApi<{ data: Resource[] }>(`/orgs/${o}/servers/${server.id}/sites`)).data.map(toSite)
    sites.value = { ...sites.value, [server.id]: s }
    const d = await forgeApi<{ data: Resource[] }>(`/orgs/${o}/servers/${server.id}/deployments`).catch(() => ({ data: [] }))
    deployments.value = { ...deployments.value, [server.id]: d.data.slice(0, 6).map(r => toDeployment(r, s)) }
  }

  /**
   * Deploy a site and follow it until it ends. `onStatus` gets each status (queued, deploying…);
   * the result is the final status and the end of the deployment log.
   */
  async function deploy(server: ForgeServer, site: ForgeSite, onStatus: (s: string) => void) {
    const o = await organisation()
    const base = `/orgs/${o}/servers/${server.id}/sites/${site.id}/deployments`
    const started = await forgeApi<{ data: Resource }>(base, 'POST')
    const id = started.data.id
    let state = started.data.attributes.status as string
    onStatus(state)
    for (let i = 0; i < 200 && !['finished', 'failed', 'failed-build', 'cancelled'].includes(state); i++) {
      await new Promise(r => setTimeout(r, 3000))
      state = (await forgeApi<{ data: Resource }>(`${base}/${id}`)).data.attributes.status
      onStatus(state)
    }
    const log = await forgeApi<{ data: { attributes: { output: string } } }>(`${base}/${id}/log`).then(r => r.data.attributes.output).catch(() => '')
    return { status: state, log }
  }

  /** Forge's page for a server. */
  const serverUrl = (server: ForgeServer) => org && server.slug ? `https://forge.laravel.com/${org}/${server.slug}` : 'https://forge.laravel.com/servers'

  return { servers, sites, deployments, status, error, load, loadServer, deploy, serverUrl }
}

export function useForge() {
  instance ??= create()
  return instance
}

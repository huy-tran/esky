// Docker (desktop app): containers, Compose projects and images through the docker CLI (src-tauri/src/docker.rs).
import { useExtensions } from './useExtensions'
import { isTauri } from './usePlatform'

export type DockerKind = 'containers' | 'compose' | 'images'

export interface DockerRow {
  /** What Docker calls it in commands: container id, project name or image id. */
  id: string
  title: string
  sub: string
  /** Containers and projects: running or not. */
  running?: boolean
  state: string
}

/** Docker's own JSON for each kind, turned into list rows. */
function toRow(kind: DockerKind, x: Record<string, string>): DockerRow {
  if (kind === 'containers') {
    const running = x.State === 'running'
    return { id: x.ID!, title: x.Names!, sub: `${x.Image} · ${x.Status}`, running, state: running ? 'Running' : x.State === 'paused' ? 'Paused' : 'Stopped' }
  }
  if (kind === 'compose') {
    const running = /running/i.test(x.Status ?? '')
    return { id: x.Name!, title: x.Name!, sub: x.ConfigFiles ?? x.Status ?? '', running, state: x.Status ?? '' }
  }
  return { id: x.ID!, title: x.Tag && x.Tag !== '<none>' ? `${x.Repository}:${x.Tag}` : x.Repository ?? x.ID!, sub: `${x.Size} · ${x.CreatedSince}`, state: x.Size ?? '' }
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const exts = useExtensions()
  const kind = ref<DockerKind>('containers')
  const rows = shallowRef<DockerRow[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')

  const host = () => String(exts.prefsFor('docker').host || '')

  async function load(k: DockerKind = kind.value) {
    kind.value = k
    if (!isTauri()) {
      status.value = 'error'
      error.value = 'Docker works in the desktop app.'
      return
    }
    status.value = 'loading'
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const list = await invoke<Record<string, string>[]>('docker_list', { kind: k, host: host() })
      if (kind.value !== k) return
      const showStopped = exts.prefsFor('docker').stopped === true
      rows.value = list.map(x => toRow(k, x)).filter(r => k !== 'containers' || showStopped || r.running)
      status.value = 'ready'
      error.value = ''
    } catch (e) {
      status.value = 'error'
      error.value = String(e)
    }
  }

  /** start, stop, restart, remove or logs; reloads the list afterwards. */
  async function act(action: string, id: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('docker_action', { kind: kind.value, action, id, host: host() })
    if (action !== 'logs') await load()
  }

  return { kind, rows, status, error, load, act }
}

export function useDocker() {
  instance ??= create()
  return instance
}

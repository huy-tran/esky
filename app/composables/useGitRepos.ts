// Git repos in the configured folders: Rust `git_status` in the desktop app, the dev API route in the browser.
import { parseStatus, type GitRepo, type RawRepoStatus } from '~/utils/git'
import { isTauri } from './usePlatform'

async function fetchStatus(roots: string[]): Promise<RawRepoStatus[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<RawRepoStatus[]>('git_status', { roots })
  }
  return $fetch<RawRepoStatus[]>('/api/git/status', { query: { roots: roots.join('\n') } })
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const repos = ref<GitRepo[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  let seq = 0

  async function load(roots: string[]) {
    const mine = ++seq
    status.value = 'loading'
    try {
      const raw = await fetchStatus(roots)
      if (mine !== seq) return
      // Keep the order of the configured folders, then by name.
      repos.value = raw.map(parseStatus).sort((a, b) => roots.indexOf(a.root) - roots.indexOf(b.root) || a.name.localeCompare(b.name))
      status.value = 'ready'
      error.value = ''
    } catch (e) {
      if (mine !== seq) return
      status.value = 'error'
      error.value = (e as Error)?.message || String(e)
    }
  }

  return { repos, status, error, load }
}

export function useGitRepos() {
  instance ??= create()
  return instance
}

/** Windows Terminal (or PowerShell) in `path`. */
export async function openTerminal(path: string) {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('open_terminal', { path })
}

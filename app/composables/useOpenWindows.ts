// Switch Windows (desktop app): the open app windows from Rust (switcher.rs), with program icons.
import { isTauri } from './usePlatform'

export interface OpenWindow { id: number, title: string, exe: string | null, minimized: boolean }

/** "C:\…\Code.exe" -> "Code". */
export const programName = (exe: string | null) => (exe?.split('\\').pop() ?? '').replace(/\.exe$/i, '')

let instance: ReturnType<typeof create> | null = null

function create() {
  const list = shallowRef<OpenWindow[]>([])
  const icons = ref<Record<string, string>>({})

  async function load() {
    if (!isTauri()) return
    const { invoke } = await import('@tauri-apps/api/core')
    list.value = await invoke<OpenWindow[]>('windows_list').catch(() => [])
    const missing = [...new Set(list.value.map(w => w.exe).filter((e): e is string => !!e && !icons.value[e]))]
    if (missing.length) {
      const got = await invoke<Record<string, string>>('exe_icons', { paths: missing }).catch(() => ({}))
      icons.value = { ...icons.value, ...got }
    }
  }

  async function focus(w: OpenWindow) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke('window_focus', { id: w.id })
  }

  async function close(w: OpenWindow) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('window_close', { id: w.id })
    list.value = list.value.filter(x => x.id !== w.id)
  }

  /** Windows whose title or program matches every word typed. */
  function match(q: string) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return list.value.filter((w) => {
      const hay = `${w.title} ${programName(w.exe)}`.toLowerCase()
      return words.every(x => hay.includes(x))
    })
  }

  return { list, icons, load, focus, close, match }
}

export function useOpenWindows() {
  instance ??= create()
  return instance
}

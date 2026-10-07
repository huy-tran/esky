// File Search (desktop app): an index of the folders in the File Search preferences, Windows'
// Recent files, and previews. The index itself lives in Rust (src-tauri/src/files.rs).
import type { FileEntry } from '~/data/fixtures'
import { parseFolders } from '~/utils/git'
import { useExtensions } from './useExtensions'
import { isTauri } from './usePlatform'

interface FileHit { path: string, name: string, size: number, modified: number }
export interface FilePreview { text: string | null, image: string | null }

const REINDEX_MS = 15 * 60 * 1000

const toEntry = (h: FileHit): FileEntry => ({ id: h.path, name: h.name, dir: h.path.slice(0, h.path.length - h.name.length - 1), size: h.size, modified: h.modified })

/** Icon, colour and kind name for a file, from its extension. */
export function fileKind(name: string): { icon: string, tile: string, label: string } {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const is = (...xs: string[]) => xs.includes(ext)
  if (is('png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic')) return { icon: 'i-lucide-image', tile: '#DB2777', label: `${ext.toUpperCase()} image` }
  if (is('pdf')) return { icon: 'i-lucide-file', tile: '#B91C1C', label: 'PDF document' }
  if (is('doc', 'docx', 'odt', 'rtf')) return { icon: 'i-lucide-file-type', tile: '#1D4ED8', label: 'Word document' }
  if (is('xls', 'xlsx', 'csv', 'ods')) return { icon: 'i-lucide-file-spreadsheet', tile: '#15803D', label: 'Spreadsheet' }
  if (is('ppt', 'pptx', 'key')) return { icon: 'i-lucide-presentation', tile: '#EA580C', label: 'Presentation' }
  if (is('zip', 'rar', '7z', 'tar', 'gz')) return { icon: 'i-lucide-file-archive', tile: '#A16207', label: 'Archive' }
  if (is('mp4', 'mov', 'mkv', 'avi', 'webm')) return { icon: 'i-lucide-file-video', tile: '#7C3AED', label: 'Video' }
  if (is('mp3', 'wav', 'flac', 'm4a', 'ogg')) return { icon: 'i-lucide-file-audio', tile: '#0D9488', label: 'Audio' }
  if (is('php', 'js', 'ts', 'vue', 'json', 'yml', 'yaml', 'html', 'css', 'sql', 'rs', 'py', 'sh', 'ps1', 'env', 'xml', 'toml')) return { icon: 'i-lucide-file-code', tile: '#0284C7', label: `${ext.toUpperCase()} file` }
  if (is('md', 'txt', 'log')) return { icon: 'i-lucide-file-text', tile: '#52525B', label: ext === 'md' ? 'Markdown' : 'Text file' }
  return { icon: 'i-lucide-file', tile: '#52525B', label: ext ? `${ext.toUpperCase()} file` : 'File' }
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const exts = useExtensions()
  const recent = shallowRef<FileEntry[]>([])
  const indexed = ref(0)
  const status = ref<'idle' | 'indexing' | 'ready' | 'unavailable'>(isTauri() ? 'idle' : 'unavailable')
  const previews = reactive<Record<string, FilePreview | 'loading'>>({})
  let timer: ReturnType<typeof setInterval> | undefined

  const folders = () => parseFolders(String(exts.prefsFor('files').folders || ''))

  async function index() {
    if (!isTauri()) return
    status.value = 'indexing'
    const { invoke } = await import('@tauri-apps/api/core')
    indexed.value = await invoke<number>('files_index', { folders: folders() }).catch(() => 0)
    status.value = 'ready'
  }

  async function search(query: string): Promise<FileEntry[]> {
    if (!isTauri() || !query.trim()) return []
    const { invoke } = await import('@tauri-apps/api/core')
    return (await invoke<FileHit[]>('files_search', { query }).catch(() => [])).map(toEntry)
  }

  async function loadRecent() {
    if (!isTauri()) return
    const { invoke } = await import('@tauri-apps/api/core')
    recent.value = (await invoke<FileHit[]>('files_recent').catch(() => [])).map(toEntry)
  }

  /** The preview for a file: undefined while it loads (it starts loading on first ask). */
  function preview(path: string): FilePreview | undefined {
    const p = previews[path]
    if (p === 'loading') return undefined
    if (p) return p
    previews[path] = 'loading'
    import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke<FilePreview>('file_preview', { path }))
      .then((r) => { previews[path] = r })
      .catch(() => { previews[path] = { text: null, image: null } })
    return undefined
  }

  async function openWith(path: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('file_open_with', { path })
  }

  /** Index now, again every 15 minutes, and whenever the folders change. */
  function start() {
    if (!isTauri()) return
    index()
    clearInterval(timer)
    timer = setInterval(index, REINDEX_MS)
    watch(() => String(exts.prefsFor('files').folders), index)
  }

  return { recent, indexed, status, index, search, loadRecent, preview, openWith, start, folders }
}

export function useFiles() {
  instance ??= create()
  return instance
}

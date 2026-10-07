// Claude through the user's Claude Code CLI. Desktop: Rust commands (claude_run / claude_info).
// Browser preview: the dev-only /api/claude routes. Both speak the same events (utils/claude.ts).
// With Settings → AI → "Anthropic API key", the desktop app calls the Messages API from Rust instead.
import { checkRequest, lineParser, parseAuthStatus, systemPrompt, type ClaudeEvent, type ClaudeRequest, type ClaudeStatus, type ClaudeUsage } from '~/utils/claude'
import { persistRef } from './usePersist'
import { isTauri } from './usePlatform'
import { useSettings } from './useSettings'

export interface ClaudeRun {
  /** Resolves when the turn ends (done, error or cancelled). */
  finished: Promise<void>
  cancel: () => void
}

let runSeq = 0

async function streamTauri(req: ClaudeRequest, onEvent: (e: ClaudeEvent) => void): Promise<ClaudeRun> {
  const { Channel, invoke } = await import('@tauri-apps/api/core')
  const runId = ++runSeq
  let resolve!: () => void
  const finished = new Promise<void>((r) => { resolve = r })
  let ended = false
  const parser = lineParser((e) => {
    if (e.type === 'done' || e.type === 'error') ended = true
    onEvent(e)
  })
  const channel = new Channel<string>()
  channel.onmessage = (line) => {
    if (line.startsWith('{"type":"esky_exit"')) {
      parser.end()
      if (!ended) {
        const exit = JSON.parse(line) as { code: number | null, stderr: string }
        onEvent({ type: 'error', message: exit.stderr.trim().split('\n').pop() || `Claude Code stopped (exit code ${exit.code})` })
      }
      resolve()
      return
    }
    parser.push(line + '\n')
  }
  // Rust builds the command line itself (see claude_args in lib.rs); it only takes these values.
  const r = checkRequest(req)
  invoke('claude_run', { runId, mode: r.mode, system: systemPrompt(r.system), sessionId: r.sessionId ?? null, prompt: r.prompt, onLine: channel }).catch((e) => {
    onEvent({ type: 'error', message: String(e) })
    resolve()
  })
  return { finished, cancel: () => { invoke('claude_cancel', { runId }) } }
}

/** The API key backend: Rust sends text, done and error events as JSON strings. */
async function streamApi(req: ClaudeRequest, model: string, onEvent: (e: ClaudeEvent) => void): Promise<ClaudeRun> {
  const { Channel, invoke } = await import('@tauri-apps/api/core')
  const runId = ++runSeq
  const r = checkRequest(req)
  let resolve!: () => void
  const finished = new Promise<void>((res) => { resolve = res })
  const channel = new Channel<string>()
  channel.onmessage = (line) => {
    const e = JSON.parse(line) as ClaudeEvent
    onEvent(e)
    if (e.type === 'done' || e.type === 'error') resolve()
  }
  const messages = [...(req.history ?? []), { role: 'user', content: r.prompt }]
  invoke('anthropic_run', { runId, model, system: systemPrompt(r.system), messages, quick: r.mode === 'quick', onEvent: channel }).catch((e) => {
    onEvent({ type: 'error', message: String(e) })
    resolve()
  })
  return { finished, cancel: () => { invoke('anthropic_cancel', { runId }); resolve() } }
}

async function streamBrowser(req: ClaudeRequest, onEvent: (e: ClaudeEvent) => void): Promise<ClaudeRun> {
  const ctrl = new AbortController()
  const finished = (async () => {
    try {
      const res = await fetch('/api/claude/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req), signal: ctrl.signal })
      if (!res.ok || !res.body) throw new Error(`Esky's dev server returned ${res.status}`)
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      // The route already sends Esky events, one JSON object per line.
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += value
        let i: number
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim()
          buf = buf.slice(i + 1)
          if (line) onEvent(JSON.parse(line) as ClaudeEvent)
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') onEvent({ type: 'error', message: (e as Error).message })
    }
  })()
  return { finished, cancel: () => ctrl.abort() }
}

function create() {
  const { settings } = useSettings()
  const usage = ref<ClaudeUsage | null>(null)
  persistRef('claude.usage', usage)

  /** Run one turn. Usage events update the remembered plan usage. */
  async function stream(req: ClaudeRequest, onEvent: (e: ClaudeEvent) => void): Promise<ClaudeRun> {
    const handle = (e: ClaudeEvent) => {
      if (e.type === 'usage') usage.value = e.usage
      onEvent(e)
    }
    if (!isTauri()) return streamBrowser(req, handle)
    return settings.value.backend === 'api' ? streamApi(req, settings.value.model, handle) : streamTauri(req, handle)
  }

  /** Is Claude Code installed and signed in, and as whom? */
  async function status(): Promise<ClaudeStatus> {
    try {
      if (!isTauri()) return await $fetch<ClaudeStatus>('/api/claude/status')
      const { invoke } = await import('@tauri-apps/api/core')
      if (settings.value.backend === 'api') return { api: true, installed: true, loggedIn: await invoke<boolean>('anthropic_has_key') }
      type Out = { code: number | null, stdout: string, stderr: string }
      const version = await invoke<Out>('claude_info', { what: 'version' })
      if (version.code !== 0) return { installed: false, error: version.stderr.trim() }
      const auth = await invoke<Out>('claude_info', { what: 'auth' })
      return { installed: true, version: version.stdout.trim().split(/\s/)[0], ...parseAuthStatus(auth.stdout) }
    } catch (e) {
      return { installed: false, error: (e as Error)?.message ?? String(e) }
    }
  }

  /** Refresh plan usage with the smallest possible request (about 1k tokens of your plan). */
  async function refreshUsage() {
    const run = await stream({ mode: 'quick', prompt: 'ok', system: 'check' }, () => {})
    await run.finished
    return usage.value
  }

  return { usage, stream, status, refreshUsage }
}

let instance: ReturnType<typeof create> | null = null

export function useClaude() {
  instance ??= create()
  return instance
}

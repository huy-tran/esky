// Talking to Claude through the user's own Claude Code CLI (their Claude subscription).
// Shared by the dev server route (browser preview) and the desktop app (Tauri shell).
//
// Claude Code normally loads its coding system prompt, every MCP server, skills, hooks and settings:
// about 120k tokens per message. Esky only needs a chat, so each run is stripped to ~1k tokens.

export type ClaudeMode = 'chat' | 'quick'

/** Which system prompt to use: 'chat', 'check' (the sign-in test) or a Quick AI command id. */
export type SystemId = string

export interface ClaudeRequest {
  mode: ClaudeMode
  /** The user's message (sent on stdin). */
  prompt: string
  system: SystemId
  /** Continue an earlier chat. */
  sessionId?: string
}

/** Plan usage windows from Claude Code's (undocumented) rate_limit_event. Utilisation is 0–1. */
export interface ClaudeUsage {
  fiveHour?: { utilization: number, resetsAt: number }
  sevenDay?: { utilization: number, resetsAt: number }
  status?: string
  at: number
}

export type ClaudeEvent =
  | { type: 'session', id: string, model?: string }
  | { type: 'text', text: string }
  | { type: 'usage', usage: ClaudeUsage }
  | { type: 'done', text: string }
  | { type: 'error', message: string }

export interface ClaudeStatus {
  installed: boolean
  version?: string
  loggedIn?: boolean
  email?: string
  orgName?: string
  subscriptionType?: string
  error?: string
}

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The system prompt text for an id, or undefined for an unknown id. */
export function systemPrompt(id: SystemId): string | undefined {
  if (id === 'chat') return CHAT_SYSTEM
  if (id === 'check') return CHECK_SYSTEM
  return Object.hasOwn(QUICK_SYSTEM, id) ? QUICK_SYSTEM[id] : undefined
}

/**
 * Accept only well-formed requests: a known mode and system prompt, and a session id that is a UUID.
 * The command line is built from these values, so nothing else may reach it.
 */
export function checkRequest(x: unknown): ClaudeRequest {
  const r = (x ?? {}) as Record<string, unknown>
  if (r.mode !== 'chat' && r.mode !== 'quick') throw new Error('Unknown mode')
  if (typeof r.prompt !== 'string' || !r.prompt.trim()) throw new Error('Empty prompt')
  if (typeof r.system !== 'string' || !systemPrompt(r.system)) throw new Error('Unknown system prompt')
  if (r.sessionId != null && (typeof r.sessionId !== 'string' || !SESSION_ID.test(r.sessionId))) throw new Error('Invalid session id')
  return { mode: r.mode, prompt: r.prompt, system: r.system, sessionId: (r.sessionId as string | undefined) || undefined }
}

/**
 * Command-line arguments for a lean, non-interactive run. The prompt itself goes on stdin.
 * Keep in step with `claude_args` in src-tauri/src/lib.rs, which builds the same list for the desktop app.
 */
export function claudeArgs(input: ClaudeRequest): string[] {
  const req = checkRequest(input)
  return [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    `--system-prompt=${systemPrompt(req.system)}`,
    // No tools, MCP servers, skills or user settings/hooks: a plain conversation.
    '--tools', '',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--setting-sources', '',
    '--disable-slash-commands',
    ...(req.mode === 'quick' ? ['--no-session-persistence'] : []),
    ...(req.sessionId ? [`--resume=${req.sessionId}`] : [])
  ]
}

/** Folder Esky runs Claude Code in, so its chats don't mix with your project sessions. */
export const claudeWorkDir = (home: string) => `${home}\\.esky\\chats`

/** Turn one line of Claude Code's stream-json output into Esky events (zero or more). */
export function parseClaudeLine(line: string): ClaudeEvent[] {
  let j: any
  try {
    j = JSON.parse(line)
  } catch {
    return []
  }
  if (j.type === 'system' && j.subtype === 'init') return [{ type: 'session', id: j.session_id, model: j.model }]
  if (j.type === 'stream_event' && j.event?.type === 'content_block_delta' && j.event.delta?.type === 'text_delta') {
    return [{ type: 'text', text: j.event.delta.text }]
  }
  if (j.type === 'rate_limit_event' && j.rate_limit_info) {
    const w = j.rate_limit_info.unifiedWindows ?? {}
    const win = (x: any) => x && typeof x.utilization === 'number' ? { utilization: x.utilization, resetsAt: x.resetsAt } : undefined
    return [{ type: 'usage', usage: { fiveHour: win(w.five_hour), sevenDay: win(w.seven_day), status: j.rate_limit_info.status, at: Date.now() } }]
  }
  if (j.type === 'result') {
    if (j.is_error) return [{ type: 'error', message: String(j.result || j.subtype || 'Claude Code returned an error') }]
    return [{ type: 'done', text: String(j.result ?? '') }]
  }
  return []
}

/** Splits a byte stream into lines and parses each one. */
export function lineParser(onEvent: (e: ClaudeEvent) => void) {
  let buf = ''
  return {
    push(chunk: string) {
      buf += chunk
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (line) parseClaudeLine(line).forEach(onEvent)
      }
    },
    end() {
      if (buf.trim()) parseClaudeLine(buf.trim()).forEach(onEvent)
      buf = ''
    }
  }
}

/** Parse `claude auth status` JSON. */
export function parseAuthStatus(out: string): Partial<ClaudeStatus> {
  try {
    const j = JSON.parse(out)
    return { loggedIn: !!j.loggedIn, email: j.email, orgName: j.orgName, subscriptionType: j.subscriptionType }
  } catch {
    return { loggedIn: false }
  }
}

// ---------- prompts ----------

export const CHAT_SYSTEM = 'You are the AI assistant inside Esky, a keyboard launcher for Windows used by a web developer. Be concise and practical. Format answers in Markdown; put code in fenced code blocks with a language tag.'

/** Used by "Check again" to confirm Claude Code answers. */
export const CHECK_SYSTEM = 'Reply with the single word: ok'

export const QUICK_SYSTEM: Record<string, string> = {
  grammar: 'Fix the grammar, spelling and punctuation of the text the user sends. Keep their meaning, tone and language. Reply with only the corrected text: no preamble, no quotes, no explanation.',
  translate: 'Translate the text the user sends: English into Vietnamese, or Vietnamese into English. Reply with only the translation: no preamble, no quotes.',
  explain: 'Explain the code the user sends, clearly and briefly, for an experienced developer. If it is not code, say so in one sentence and summarise it instead.',
  summarise: 'Summarise the text the user sends in one to three plain sentences. Reply with only the summary.',
  commit: 'Write a Git commit message for the change described in the text the user sends: a subject line under 72 characters in conventional-commit style, then optionally a blank line and one or two short body lines. Reply with only the commit message.'
}

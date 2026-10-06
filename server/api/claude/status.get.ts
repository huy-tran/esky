// Browser preview only: is Claude Code installed and signed in?
import { parseAuthStatus, type ClaudeStatus } from '../../../app/utils/claude'

export default defineEventHandler(async (): Promise<ClaudeStatus> => {
  if (!import.meta.dev) throw createError({ statusCode: 404 })
  const version = await runClaude(['--version'])
  if (version.code !== 0) return { installed: false, error: version.stderr.trim() || 'Claude Code was not found on PATH' }
  const auth = await runClaude(['auth', 'status'])
  return { installed: true, version: version.stdout.trim().split(/\s/)[0], ...parseAuthStatus(auth.stdout) }
})

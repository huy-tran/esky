// Browser preview only: run one Claude Code turn and stream Esky events back as NDJSON.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { checkRequest, claudeArgs, claudeWorkDir, lineParser, type ClaudeRequest } from '../../../app/utils/claude'

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404 })
  // Only Esky's own page may start Claude: other sites can't send JSON here without a CORS
  // preflight (which this server never approves), and their Origin wouldn't match.
  const origin = getRequestHeader(event, 'origin')
  const host = getRequestHeader(event, 'host')
  if (!getRequestHeader(event, 'content-type')?.startsWith('application/json') || (origin && new URL(origin).host !== host)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  let req: ClaudeRequest
  try {
    req = checkRequest(await readBody(event))
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: (e as Error).message })
  }

  const cwd = claudeWorkDir(homedir())
  mkdirSync(cwd, { recursive: true })

  setResponseHeader(event, 'Content-Type', 'application/x-ndjson; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-cache')

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'))
      const child = spawn('claude', claudeArgs(req), { cwd, windowsHide: true })
      let stderr = ''
      let finished = false
      const parser = lineParser((e) => {
        if (e.type === 'done' || e.type === 'error') finished = true
        send(e)
      })
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (d: string) => parser.push(d))
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      child.on('error', (e: Error) => {
        send({ type: 'error', message: e.message.includes('ENOENT') ? 'Claude Code was not found on PATH.' : e.message })
        controller.close()
      })
      child.on('close', (code: number | null) => {
        parser.end()
        if (!finished) send({ type: 'error', message: stderr.trim().split('\n').pop() || `Claude Code exited with code ${code}` })
        controller.close()
      })
      child.stdin.end(req.prompt)
      // Stop Claude if the launcher cancels (Esc, new chat) or the page goes away.
      event.node.res.on('close', () => {
        if (child.exitCode === null) child.kill()
      })
    }
  })
  return sendStream(event, stream)
})

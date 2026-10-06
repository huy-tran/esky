// Runs the Claude Code CLI for the browser preview. The desktop app does the same in Rust (src-tauri/src/lib.rs).
import { spawn } from 'node:child_process'

/** Run `claude` with arguments (no shell) and collect stdout. */
export function runClaude(args: string[], timeoutMs = 20000): Promise<{ code: number | null, stdout: string, stderr: string }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let child
    try {
      child = spawn('claude', args, { windowsHide: true })
    } catch (e) {
      resolve({ code: -1, stdout: '', stderr: (e as Error).message })
      return
    }
    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('error', (e: Error) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: e.message })
    })
    child.on('close', (code: number | null) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

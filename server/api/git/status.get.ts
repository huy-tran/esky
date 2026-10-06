// Browser build only: `git status` for every repo in the given folders.
// The desktop app runs the same thing in Rust (git_status in src-tauri/src/lib.rs).
import { execFile } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { RawRepoStatus } from '../../../app/utils/git'

const expandHome = (p: string) => p.replace(/^~(?=[\\/]|$)/, homedir())

/** The folder itself if it's a repo, otherwise its direct subfolders that are. */
function findRepos(root: string): string[] {
  if (existsSync(join(root, '.git'))) return [root]
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory() && existsSync(join(root, d.name, '.git')))
      .map(d => join(root, d.name))
      .sort()
  } catch {
    return []
  }
}

const status = (path: string) => new Promise<{ output: string, error: string | null }>((resolve) => {
  execFile('git', ['-C', path, 'status', '--porcelain=v2', '--branch'], { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, windowsHide: true }, (err, stdout, stderr) => {
    resolve(err ? { output: '', error: (stderr || err.message).trim() } : { output: stdout, error: null })
  })
})

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404 })
  const roots = String(getQuery(event).roots ?? '').split('\n').filter(Boolean)
  const repos = roots.flatMap(root => findRepos(expandHome(root)).map(path => ({ root, path })))
  const out: RawRepoStatus[] = []
  let next = 0
  // A few at a time, like the desktop app.
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < repos.length) {
      const { root, path } = repos[next++]!
      out.push({ root, path, name: path.split(/[\\/]/).pop()!, ...await status(path) })
    }
  }))
  return out
})

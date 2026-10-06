// Git repos with uncommitted changes. Pure logic shared by the dev API route (Node) and the desktop app (Rust).

/** One repo as the Rust command / dev route returns it: raw `git status --porcelain=v2 --branch` output. */
export interface RawRepoStatus {
  root: string
  path: string
  name: string
  output: string
  error?: string | null
}

export type GitChange = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict'

export interface GitFile {
  path: string
  change: GitChange
  /** In the index (git add). */
  staged: boolean
}

export interface GitRepo {
  /** The configured folder it was found in, e.g. ~\Herd. */
  root: string
  path: string
  name: string
  /** Null when HEAD is detached. */
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  files: GitFile[]
  error?: string
}

/** Folders from the "Folders to check" preference: one per line (semicolons work too). */
export const parseFolders = (text: string) => [...new Set(text.split(/[\r\n;]+/).map(x => x.trim()).filter(Boolean))]

const CHANGE: Record<string, GitChange> = { M: 'modified', T: 'modified', A: 'added', C: 'added', D: 'deleted', R: 'renamed' }

/** XY from porcelain v2: the worktree side (Y) wins, since that's what still needs `git add`. */
function changeOf(xy: string): { change: GitChange, staged: boolean } {
  const [x = '.', y = '.'] = xy
  return { change: CHANGE[y !== '.' ? y : x] ?? 'modified', staged: x !== '.' }
}

export function parseStatus(raw: RawRepoStatus): GitRepo {
  const repo: GitRepo = { root: raw.root, path: raw.path, name: raw.name, branch: null, upstream: null, ahead: 0, behind: 0, files: [] }
  if (raw.error) return { ...repo, error: raw.error }
  for (const line of raw.output.split(/\r?\n/)) {
    if (!line) continue
    if (line.startsWith('# branch.head ')) {
      const head = line.slice(14)
      repo.branch = head === '(detached)' ? null : head
    } else if (line.startsWith('# branch.upstream ')) {
      repo.upstream = line.slice(18)
    } else if (line.startsWith('# branch.ab ')) {
      const m = line.match(/\+(\d+) -(\d+)/)
      if (m) {
        repo.ahead = +m[1]!
        repo.behind = +m[2]!
      }
    } else if (line.startsWith('1 ')) {
      // 1 XY sub mH mI mW hH hI path
      const f = line.split(' ')
      repo.files.push({ path: f.slice(8).join(' '), ...changeOf(f[1]!) })
    } else if (line.startsWith('2 ')) {
      // 2 XY sub mH mI mW hH hI Xscore path<TAB>origPath
      const f = line.split(' ')
      repo.files.push({ path: f.slice(9).join(' ').split('\t')[0]!, ...changeOf(f[1]!) })
    } else if (line.startsWith('u ')) {
      // u XY sub m1 m2 m3 mW h1 h2 h3 path
      repo.files.push({ path: line.split(' ').slice(10).join(' '), change: 'conflict', staged: false })
    } else if (line.startsWith('? ')) {
      repo.files.push({ path: line.slice(2), change: 'untracked', staged: false })
    }
  }
  return repo
}

/** "3 changed · 1 new" style summary. */
export function summary(r: GitRepo): string {
  if (r.error) return r.error
  const n = (c: GitChange) => r.files.filter(f => f.change === c).length
  const parts = [
    n('conflict') && `${n('conflict')} conflict${n('conflict') > 1 ? 's' : ''}`,
    r.files.length - n('untracked') - n('conflict') && `${r.files.length - n('untracked') - n('conflict')} changed`,
    n('untracked') && `${n('untracked')} new`
  ].filter(Boolean)
  if (!parts.length && r.ahead) return `${r.ahead} commit${r.ahead > 1 ? 's' : ''} to push`
  return parts.join(' · ') || 'No changes'
}

// GitHub, Jira and Sentry lists (desktop app), fetched with your tokens through Rust (api.rs).
import { useExtensions } from './useExtensions'
import { isTauri } from './usePlatform'

export type Tone = 'ok' | 'warn' | 'err' | 'muted'

export interface RemoteRow {
  id: string
  title: string
  sub: string
  badge?: string
  tone?: Tone
  url: string
  /** What Ctrl Shift C copies (an issue key, a clone URL); the link otherwise. */
  copy?: string
}

export interface RemoteSource {
  ext: 'github' | 'jira' | 'sentry'
  /** The extension command it belongs to. */
  cmd: string
  title: string
  icon: string
  tile: string
  placeholder: string
  /** Search on the server as you type (otherwise the loaded list is filtered). */
  live?: boolean
  load: (q: string) => Promise<RemoteRow[]>
}

export async function extApi<T = any>(ext: string, url: string, method: 'GET' | 'POST' = 'GET', body?: unknown, user?: string): Promise<T> {
  if (!isTauri()) throw new Error('This works in the desktop app')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>('ext_api', { ext, method, url, body: body ?? null, user: user ?? null })
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  if (m < 48 * 60) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

const runTone = (conclusion: string | null, status: string): Tone =>
  conclusion === 'success' ? 'ok' : conclusion === 'failure' || conclusion === 'timed_out' ? 'err' : status !== 'completed' ? 'warn' : 'muted'

export function remoteSources(): Record<string, RemoteSource> {
  const exts = useExtensions()
  const gh = () => exts.prefsFor('github')
  const jira = () => exts.prefsFor('jira')
  const sentry = () => exts.prefsFor('sentry')
  const jiraSite = () => String(jira().site || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const sentryOrg = () => String(sentry().org || '').trim()

  const ghRepo = (r: any): RemoteRow => ({
    id: String(r.id),
    title: r.full_name,
    sub: r.description || (r.private ? 'Private repository' : 'Public repository'),
    badge: r.language ?? undefined,
    tone: 'muted',
    url: r.html_url,
    copy: r.clone_url
  })

  const jiraSearch = async (jql: string): Promise<RemoteRow[]> => {
    const site = jiraSite()
    const res = await extApi('jira', `https://${site}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,issuetype&maxResults=50`, 'GET', undefined, String(jira().email || ''))
    return (res.issues ?? []).map((i: any) => {
      const cat = i.fields.status?.statusCategory?.key
      return {
        id: i.key,
        title: `${i.key} · ${i.fields.summary}`,
        sub: [i.fields.issuetype?.name, i.fields.assignee?.displayName ?? 'Unassigned'].filter(Boolean).join(' · '),
        badge: i.fields.status?.name,
        tone: cat === 'done' ? 'ok' : cat === 'indeterminate' ? 'warn' : 'muted',
        url: `https://${site}/browse/${i.key}`,
        copy: i.key
      } satisfies RemoteRow
    })
  }

  return {
    repos: {
      ext: 'github', cmd: 'repos', title: 'Repositories', icon: 'i-lucide-github', tile: '#1E293B', placeholder: 'Search repositories…', live: true,
      async load(q) {
        const org = String(gh().org || '').trim()
        if (q.trim()) {
          const res = await extApi('github', `https://api.github.com/search/repositories?q=${encodeURIComponent(`${q} ${org ? `org:${org}` : ''}`.trim())}&per_page=30`)
          return res.items.map(ghRepo)
        }
        const url = org ? `https://api.github.com/orgs/${org}/repos?sort=pushed&per_page=50` : 'https://api.github.com/user/repos?sort=pushed&per_page=50'
        return (await extApi<any[]>('github', url)).map(ghRepo)
      }
    },
    prs: {
      ext: 'github', cmd: 'prs', title: 'Pull requests', icon: 'i-lucide-git-pull-request', tile: '#1E293B', placeholder: 'Filter pull requests…',
      async load() {
        const res = await extApi('github', `https://api.github.com/search/issues?q=${encodeURIComponent('is:pr is:open archived:false involves:@me')}&sort=updated&per_page=50`)
        return res.items.map((p: any) => ({
          id: String(p.id),
          title: p.title,
          sub: `${p.repository_url.split('/').slice(-2).join('/')}#${p.number} · ${p.user?.login} · ${ago(p.updated_at)}`,
          badge: p.draft ? 'Draft' : 'Open',
          tone: p.draft ? 'muted' : 'ok',
          url: p.html_url
        }))
      }
    },
    runs: {
      ext: 'github', cmd: 'runs', title: 'Workflow runs', icon: 'i-lucide-play-circle', tile: '#1E293B', placeholder: 'Filter runs…',
      async load() {
        const org = String(gh().org || '').trim()
        const repos = await extApi<any[]>('github', `https://api.github.com/orgs/${org}/repos?sort=pushed&per_page=8`)
        const lists = await Promise.all(repos.map(r => extApi('github', `https://api.github.com/repos/${r.full_name}/actions/runs?per_page=5`).then(x => x.workflow_runs ?? []).catch(() => [])))
        return lists.flat()
          .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))
          .slice(0, 40)
          .map((w: any) => ({
            id: String(w.id),
            title: `${w.name} · ${w.repository.name}`,
            sub: `${w.head_branch} · ${w.event} · ${ago(w.created_at)}`,
            badge: w.conclusion ?? w.status.replace('_', ' '),
            tone: runTone(w.conclusion, w.status),
            url: w.html_url
          }))
      }
    },
    'jira:search': {
      ext: 'jira', cmd: 'search', title: 'Jira issues', icon: 'i-lucide-ticket', tile: '#2563EB', placeholder: 'Search issues, or type a key like ABC-123…', live: true,
      load(q) {
        const t = q.trim().replace(/"/g, '')
        const jql = !t ? 'assignee = currentUser() ORDER BY updated DESC' : /^[A-Z][A-Z0-9]+-\d+$/i.test(t) ? `key = "${t.toUpperCase()}"` : `text ~ "${t}" ORDER BY updated DESC`
        return jiraSearch(jql)
      }
    },
    'jira:mine': {
      ext: 'jira', cmd: 'mine', title: 'My open issues', icon: 'i-lucide-ticket', tile: '#2563EB', placeholder: 'Filter your issues…',
      load: () => jiraSearch('assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC')
    },
    'jira:work': {
      ext: 'jira', cmd: 'work', title: 'Log work', icon: 'i-lucide-timer', tile: '#2563EB', placeholder: 'Pick an issue to log time on…',
      load: () => jiraSearch('assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC')
    },
    issues: {
      ext: 'sentry', cmd: 'issues', title: 'Sentry issues', icon: 'i-lucide-bug', tile: '#7C3AED', placeholder: 'Filter issues…',
      async load() {
        const org = sentryOrg()
        const res = await extApi<any[]>('sentry', `https://${org}.sentry.io/api/0/organizations/${org}/issues/?query=${encodeURIComponent('is:unresolved')}&statsPeriod=14d&limit=50`)
        return res.map(i => ({
          id: i.id,
          title: i.title,
          sub: `${i.shortId} · ${i.project?.slug ?? ''} · ${i.count} events · ${ago(i.lastSeen)}`,
          badge: i.level,
          tone: i.level === 'error' || i.level === 'fatal' ? 'err' : i.level === 'warning' ? 'warn' : 'muted',
          url: i.permalink,
          copy: i.shortId
        }))
      }
    },
    releases: {
      ext: 'sentry', cmd: 'releases', title: 'Sentry releases', icon: 'i-lucide-tag', tile: '#7C3AED', placeholder: 'Filter releases…',
      async load() {
        const org = sentryOrg()
        const res = await extApi<any[]>('sentry', `https://${org}.sentry.io/api/0/organizations/${org}/releases/?per_page=50`)
        return res.map(r => ({
          id: r.version,
          title: r.shortVersion ?? r.version,
          sub: `${(r.projects ?? []).map((p: any) => p.slug).join(', ')} · ${ago(r.dateCreated)}`,
          badge: r.newGroups ? `${r.newGroups} new issues` : undefined,
          tone: r.newGroups ? 'warn' : 'muted',
          url: `https://${org}.sentry.io/releases/${encodeURIComponent(r.version)}/`,
          copy: r.version
        }))
      }
    }
  }
}

/** Log time on a Jira issue, e.g. "1h 30m", with an optional comment. */
export async function jiraLogWork(key: string, timeSpent: string, comment: string) {
  const exts = useExtensions()
  const site = String(exts.prefsFor('jira').site || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const body: Record<string, unknown> = { timeSpent }
  if (comment.trim()) body.comment = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment.trim() }] }] }
  await extApi('jira', `https://${site}/rest/api/3/issue/${encodeURIComponent(key)}/worklog`, 'POST', body, String(exts.prefsFor('jira').email || ''))
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const source = shallowRef<RemoteSource | null>(null)
  const rows = shallowRef<RemoteRow[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  let seq = 0

  async function load(src: RemoteSource, q = '') {
    source.value = src
    const mine = ++seq
    status.value = 'loading'
    try {
      const r = await src.load(q)
      if (mine !== seq) return
      rows.value = r
      status.value = 'ready'
      error.value = ''
    } catch (e) {
      if (mine !== seq) return
      status.value = 'error'
      error.value = String(e)
    }
  }

  return { source, rows, status, error, load }
}

export function useRemote() {
  instance ??= create()
  return instance
}

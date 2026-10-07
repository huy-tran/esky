// "Check for updates": compare this version with the latest published GitHub release.

export type UpdateCheck =
  | { state: 'off' }
  | { state: 'latest', version: string }
  | { state: 'available', version: string, url: string }
  | { state: 'error', message: string }

/** -1, 0 or 1, comparing "1.2.3" style versions (a leading "v" is ignored). */
export function compareVersions(a: string, b: string) {
  const pa = a.replace(/^v/, '').split(/[.-]/).map(n => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split(/[.-]/).map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return Math.sign(d)
  }
  return 0
}

export async function checkForUpdate(repo: string, current: string): Promise<UpdateCheck> {
  if (!repo) return { state: 'off' }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    // No published release yet.
    if (res.status === 404) return { state: 'latest', version: current }
    if (!res.ok) return { state: 'error', message: `GitHub answered ${res.status}` }
    const r = await res.json() as { tag_name: string, html_url: string }
    return compareVersions(r.tag_name, current) > 0
      ? { state: 'available', version: r.tag_name.replace(/^v/, ''), url: r.html_url }
      : { state: 'latest', version: current }
  } catch {
    return { state: 'error', message: 'Couldn’t reach GitHub. Check your connection.' }
  }
}

// Quick tools for the root search: quicklink keywords, `g` web search, currency, units and maths.
import { DIM, RATES, UNITS, type Quicklink } from '~/data/fixtures'
import { fmt } from './text'

export interface QuickCard {
  label: string
  icon: string
  caption: string
  big: string
  meta: string
  copy: string
}

export interface QuickRow {
  key: string
  title: string
  sub: string
  icon: string
  tile?: string
  kind?: string
  action: { type: 'close', msg: string }
}

export type QuickResult = { card: QuickCard } | { title: string, rows: QuickRow[] } | null

/** The quicklink's URL with `arg` in its {placeholder} (encoded for web addresses, as typed for paths). */
export const resolveQ = (q: Quicklink, arg: string) => q.url.replace(/\{\w+\}/, /^https?:/i.test(q.url) ? encodeURIComponent(arg) : arg)

/** Evaluates + - * / % ^ and parentheses without `eval`. */
export function evaluate(src: string): number {
  const s = src.replace(/\s+/g, '')
  let i = 0
  const peek = () => s[i]
  const num = (): number => {
    if (peek() === '(') {
      i++
      const v = expr()
      if (s[i++] !== ')') throw new Error('paren')
      return v
    }
    if (peek() === '-') {
      i++
      return -factor()
    }
    if (peek() === '+') {
      i++
      return factor()
    }
    const m = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(s.slice(i))
    if (!m) throw new Error('num')
    i += m[0].length
    return parseFloat(m[0])
  }
  const factor = (): number => {
    const b = num()
    if (s.slice(i, i + 2) === '**') {
      i += 2
      return b ** factor()
    }
    return b
  }
  const term = (): number => {
    let v = factor()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = s[i++]
      const r = factor()
      v = op === '*' ? v * r : op === '/' ? v / r : v % r
    }
    return v
  }
  const expr = (): number => {
    let v = term()
    while (peek() === '+' || peek() === '-') {
      const op = s[i++]
      const r = term()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  const v = expr()
  if (i !== s.length) throw new Error('trailing')
  return v
}

export interface QuickOptions {
  /** Calculator decimal places (Calculator & Units preference). */
  decimals?: number
  /** Thousands separators in calculator results. */
  separators?: boolean
  /** Builds a quicklink URL; lets the caller apply preferences such as the Laravel Docs version. */
  resolve?: (q: Quicklink, arg: string) => string
  /** Live currency rates (units per US dollar) and when they were last updated. Without them, built-in approximate rates are used. */
  rates?: { rates: Record<string, number>, updated: number } | null
  /** Your quicklinks, so "gh some text" opens GitHub Search for it. */
  quicklinks?: Quicklink[]
}

/** "3 hours ago" style age of a timestamp. */
function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 60) return m <= 1 ? 'just now' : `${m} minutes ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} hour${h > 1 ? 's' : ''} ago` : `${Math.round(h / 24)} days ago`
}

export function quick(q: string, opts: QuickOptions = {}): QuickResult {
  const resolve = opts.resolve ?? resolveQ
  const calc = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: opts.decimals ?? 6, useGrouping: opts.separators ?? true })
  const ql = q.toLowerCase().trim()
  let m: RegExpMatchArray | null

  const ws = q.trim().split(/\s+/)
  const qq = (opts.quicklinks ?? []).find(x => x.arg && x.kw === (ws[0] || '').toLowerCase())
  if (qq && ws.length > 1) {
    const arg = ws.slice(1).join(' ')
    const url = resolve(qq, arg)
    return { title: 'Quicklink', rows: [{ key: 'ql', title: `${qq.name}: ${arg}`, sub: url, icon: qq.icon, tile: qq.tile, kind: 'link', action: { type: 'close', msg: `Opened ${url}` } }] }
  }

  if ((m = q.trim().match(/^g\s+(.+)$/i))) {
    const t = m[1]
    return { title: 'Web search', rows: [
      { key: 'wg', title: `Search Google for “${t}”`, sub: 'google.com', icon: 'i-lucide-globe', tile: '#2563EB', action: { type: 'close', msg: `Searching Google for “${t}”` } },
      { key: 'wgh', title: `Search GitHub for “${t}”`, sub: 'github.com', icon: 'i-lucide-github', tile: '#1E293B', action: { type: 'close', msg: `Searching GitHub for “${t}”` } },
      { key: 'wl', title: `Search Laravel docs for “${t}”`, sub: 'laravel.com/docs', icon: 'i-lucide-book-open', tile: '#E11D48', action: { type: 'close', msg: `Searching Laravel docs for “${t}”` } }
    ] }
  }

  const live = opts.rates?.rates
  const table = live ?? RATES
  if ((m = ql.match(/^(-?[\d.,]+)\s*([a-z]{3})\s+(?:to|in)\s+([a-z]{3})$/)) && table[m[2]!] && table[m[3]!]) {
    const n = parseFloat(m[1]!.replace(/,/g, ''))
    const r = table[m[3]!]! / table[m[2]!]!
    const v = n * r
    const A = m[2]!.toUpperCase()
    const B = m[3]!.toUpperCase()
    return { card: { label: 'Currency', icon: 'i-lucide-banknote', caption: `${fmt(n, 2)} ${A} =`, big: `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${B}`, meta: `1 ${A} = ${r.toFixed(4)} ${B} · ${live ? `rates updated ${ago(opts.rates!.updated)}` : 'approximate offline rates'}`, copy: v.toFixed(2) } }
  }

  if ((m = ql.match(/^(-?[\d.,]+)\s*([a-z°]+)\s+(?:to|in)\s+([a-z°]+)$/))) {
    const a = UNITS[m[2]!.replace('°', '')]
    const b = UNITS[m[3]!.replace('°', '')]
    if (a && b && a[0] === b[0]) {
      const n = parseFloat(m[1]!.replace(/,/g, ''))
      let v: number, one: number
      if (a[0] === 'temp') {
        const cv = (x: number) => a[2] === b[2] ? x : (a[2] === '°C' ? x * 9 / 5 + 32 : (x - 32) * 5 / 9)
        v = cv(n)
        one = cv(1)
      } else {
        v = n * a[1] / b[1]
        one = a[1] / b[1]
      }
      return { card: { label: 'Unit conversion', icon: 'i-lucide-ruler', caption: DIM[a[0]]!, big: `${fmt(n)} ${a[2]} = ${fmt(v)} ${b[2]}`, meta: `1 ${a[2]} = ${fmt(one, 4)} ${b[2]}`, copy: fmt(v) } }
    }
  }

  if (/^[\d\s+\-*/().,%x×^]+$/.test(ql) && /[\d)]\s*[+\-*/x×^%]\s*[\d(.]/.test(ql)) {
    try {
      const ex = ql.replace(/,/g, '').replace(/[x×]/g, '*').replace(/\^/g, '**')
      const v = evaluate(ex)
      if (isFinite(v)) {
        return { card: { label: 'Calculator', icon: 'i-lucide-calculator', caption: q.trim().replace(/\s*\*\s*/g, ' × ').replace(/\s*\/\s*/g, ' ÷ ') + ' =', big: calc(v), meta: '', copy: calc(v) } }
      }
    } catch {
      // not an expression
    }
  }
  return null
}

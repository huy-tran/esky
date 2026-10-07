// Text helpers shared by launcher views: match highlighting, inline code, syntax colours, key names.

export interface Seg { t: string, hl?: boolean }

export const fmt = (v: number, d = 3) => v.toLocaleString('en-US', { maximumFractionDigits: d })

export const trunc = (t: string, n: number) => t.length > n ? t.slice(0, n - 1) + '…' : t

/** Split `text` around the first case-insensitive match of `q`. */
export function segs(text: string, q?: string): Seg[] {
  if (!q) return [{ t: text }]
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return [{ t: text }]
  return [{ t: text.slice(0, i) }, { t: text.slice(i, i + q.length), hl: true }, { t: text.slice(i + q.length) }].filter(s => s.t)
}

export interface InlineSeg { t: string, code: boolean, bold?: boolean }

/** Inline markdown: `code` spans and **bold**. */
export const inl = (s: string): InlineSeg[] =>
  s.split(/(`[^`]+`|\*\*[^*]+\*\*)/).filter(Boolean).map(t =>
    t[0] === '`'
      ? { t: t.slice(1, -1), code: true }
      : t.startsWith('**') && t.endsWith('**') && t.length > 4
        ? { t: t.slice(2, -2), code: false, bold: true }
        : { t, code: false })

export interface ColorSeg { t: string, c: string }

const KW = /^(namespace|use|class|extends|public|function|return|static|new|private|protected)$/

/** Tokenise one line of PHP-ish code into coloured segments. */
export const tok = (line: string): ColorSeg[] =>
  line.split(/(\/\/.*$|'[^']*'|\$\w+|\b\w+\b)/).filter(Boolean).map(t => ({
    t,
    c: t.startsWith('//')
      ? 'var(--code-cm)'
      : t[0] === '\''
        ? 'var(--code-str)'
        : t[0] === '$'
          ? 'var(--code-var)'
          : KW.test(t)
            ? 'var(--code-kw)'
            : /^[A-Z]/.test(t) ? 'var(--code-type)' : 'var(--code-fg)'
  }))

export interface BodySeg { t: string, c?: string, chip?: boolean }

/** Placeholders like {date} render as chips. */
export const phSegs = (t: string): BodySeg[] =>
  t.split(/(\{\w+\})/).filter(Boolean).map(x => /^\{\w+\}$/.test(x) ? { t: x, chip: true } : { t: x })

const KEYN: Record<string, string> = { 'ArrowLeft': '←', 'ArrowRight': '→', 'ArrowUp': '↑', 'ArrowDown': '↓', 'Enter': '↵', 'Backspace': '⌫', ' ': 'Space', 'Escape': 'Esc', 'Tab': 'Tab' }

export const keyName = (e: KeyboardEvent) =>
  KEYN[e.key] || (/^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : e.key.length === 1 ? e.key.toUpperCase() : e.key)

export const comboOf = (e: KeyboardEvent) => [
  ...(e.ctrlKey ? ['Ctrl'] : []),
  ...(e.metaKey ? ['Win'] : []),
  ...(e.altKey ? ['Alt'] : []),
  ...(e.shiftKey ? ['Shift'] : []),
  keyName(e)
]

const ACCEL: Record<string, string> = { '←': 'ArrowLeft', '→': 'ArrowRight', '↑': 'ArrowUp', '↓': 'ArrowDown', '↵': 'Enter', '⌫': 'Backspace', 'Win': 'Super', 'Esc': 'Escape', ',': 'Comma' }

/** Convert a display combo (['Ctrl','Alt','←']) to a Tauri accelerator ('Ctrl+Alt+ArrowLeft'). */
export const toAccelerator = (keys: string[]) => keys.map(k => ACCEL[k] ?? k).join('+')

/** 1536 -> "1.5 KB", 4035706914 -> "3.8 GB". */
export function formatBytes(n: number) {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return i === 0 ? `${n} bytes` : `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

// Reminders typed in root search: "remind 10am standup", "remind in 20m stretch", "remind tomorrow 9am invoice".
import { parseClock, parseDate } from './timecalc'

export interface ParsedReminder {
  /** When it is due (ms since the epoch). */
  at: number
  text: string
  /** A time that had already passed today was moved to tomorrow. */
  rolled: boolean
}

const UNIT_MS: Record<string, number> = { m: 6e4, h: 36e5, d: 864e5, w: 6048e5 }
const IN_RX = /^in\s+(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wks?|weeks?)\b\s*/i
const IN_END_RX = /\s+in\s+(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wks?|weeks?)$/i
const DEFAULT_HOUR = 9

const unitMs = (u: string) => UNIT_MS[u.toLowerCase()[0]!]!

/** "10am", "tomorrow 9am", "friday 3:30pm", "25 dec": a day and/or a time of day. A day alone means 9am. */
function when(raw: string, now: Date): { at: number, rolled: boolean } | null {
  const words = raw.trim().replace(/^at\s+/i, '').split(/\s+/).filter(Boolean)
  if (!words.length || words.length > 5) return null
  let clock: [number, number] | null = null
  let day = words
  for (const n of [2, 1]) {
    if (words.length < n) continue
    const c = parseClock(words.slice(-n).join(' '))
    if (c) {
      clock = c
      day = words.slice(0, -n).filter(w => !/^(at|on)$/i.test(w))
      break
    }
  }
  const date = day.length ? parseDate(day.join(' ')) : null
  if (day.length && !date) return null
  if (!clock && !date) return null
  const base = date ?? new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const [h, mi] = clock ?? [DEFAULT_HOUR, 0]
  const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, mi).getTime()
  // Only a bare time of day rolls over; "today 9am" (or a date) that has passed is left alone and refused.
  if (!date && at <= now.getTime()) return { at: at + 864e5, rolled: true }
  return at > now.getTime() ? { at, rolled: false } : null
}

/** The text after the word "remind" (or "rem") turned into a due time and a message, or null. */
export function parseReminder(input: string, now = new Date()): ParsedReminder | null {
  const s = input.trim().replace(/^me\s+(?:to\s+)?/i, '')
  const clean = (t: string) => t.trim().replace(/^(to|about|that|of)\s+/i, '').trim()
  const done = (at: number, text: string, rolled = false): ParsedReminder | null => {
    const t = clean(text)
    return t && at > now.getTime() ? { at, text: t, rolled } : null
  }

  let m = s.match(IN_RX)
  if (m) return done(now.getTime() + +m[1]! * unitMs(m[2]!), s.slice(m[0].length))

  // The time first: the longest run of words at the start that reads as a day and/or time.
  const words = s.split(/\s+/)
  for (let k = Math.min(5, words.length - 1); k >= 1; k--) {
    const w = when(words.slice(0, k).join(' '), now)
    if (w) return done(w.at, words.slice(k).join(' '), w.rolled)
  }

  // The time last: "call Sam at 3pm", "stretch in 20m".
  if ((m = s.match(IN_END_RX))) return done(now.getTime() + +m[1]! * unitMs(m[2]!), s.slice(0, m.index))
  // Only a trailing time introduced by "at" or "on" counts, so the message itself isn't swallowed.
  for (let k = Math.min(5, words.length - 2); k >= 1; k--) {
    const at = words.length - k - 1
    if (!/^(at|on)$/i.test(words[at]!)) continue
    const w = when(words.slice(-k).join(' '), now)
    if (w) return done(w.at, words.slice(0, at).join(' '), w.rolled)
  }
  return null
}

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** "Today 10:00 am", "Tomorrow 9:00 am", "Fri 6 Nov, 3:00 pm". */
export function whenLabel(at: number, now = new Date()): string {
  const d = new Date(at)
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(d) - day(now)) / 864e5)
  if (diff === 0) return `Today ${time(d)}`
  if (diff === 1) return `Tomorrow ${time(d)}`
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${time(d)}`
}

/** "in 20 minutes", "in 2 hours", "5 minutes ago". */
export function relLabel(at: number, now = Date.now()): string {
  const min = Math.round(Math.abs(at - now) / 6e4)
  const part = min < 1 ? 'less than a minute' : min < 60 ? `${min} minute${min === 1 ? '' : 's'}` : min < 2880 ? `${Math.round(min / 60)} hour${Math.round(min / 60) === 1 ? '' : 's'}` : `${Math.round(min / 1440)} days`
  return at >= now ? `in ${part}` : `${part} ago`
}

// Times and dates in root search: "time in Tokyo", "3pm Sydney in London", "days until 25 Dec",
// "today + 90 days", and Unix timestamps. Time zones come from the browser's own list (Intl).
import type { QuickCard } from './quick'

const DAY = 864e5

/** Extra names for places and abbreviations that aren't a city in the time zone list. */
const ALIASES: Record<string, string> = {
  'nyc': 'America/New_York', 'new york': 'America/New_York', 'la': 'America/Los_Angeles', 'san francisco': 'America/Los_Angeles', 'sf': 'America/Los_Angeles',
  'seattle': 'America/Los_Angeles', 'boston': 'America/New_York', 'washington': 'America/New_York', 'miami': 'America/New_York', 'dallas': 'America/Chicago',
  'austin': 'America/Chicago', 'houston': 'America/Chicago', 'atlanta': 'America/New_York', 'montreal': 'America/Toronto', 'san diego': 'America/Los_Angeles',
  'hanoi': 'Asia/Ho_Chi_Minh', 'saigon': 'Asia/Ho_Chi_Minh', 'hcmc': 'Asia/Ho_Chi_Minh', 'da nang': 'Asia/Ho_Chi_Minh', 'beijing': 'Asia/Shanghai',
  'delhi': 'Asia/Kolkata', 'new delhi': 'Asia/Kolkata', 'mumbai': 'Asia/Kolkata', 'bangalore': 'Asia/Kolkata', 'bengaluru': 'Asia/Kolkata', 'kyoto': 'Asia/Tokyo',
  'osaka': 'Asia/Tokyo', 'canberra': 'Australia/Sydney', 'gold coast': 'Australia/Brisbane', 'wellington': 'Pacific/Auckland', 'edinburgh': 'Europe/London',
  'manchester': 'Europe/London', 'barcelona': 'Europe/Madrid', 'munich': 'Europe/Berlin', 'frankfurt': 'Europe/Berlin', 'milan': 'Europe/Rome', 'geneva': 'Europe/Zurich',
  'vietnam': 'Asia/Ho_Chi_Minh', 'japan': 'Asia/Tokyo', 'uk': 'Europe/London', 'england': 'Europe/London', 'ireland': 'Europe/Dublin', 'germany': 'Europe/Berlin',
  'france': 'Europe/Paris', 'spain': 'Europe/Madrid', 'italy': 'Europe/Rome', 'netherlands': 'Europe/Amsterdam', 'india': 'Asia/Kolkata', 'china': 'Asia/Shanghai',
  'korea': 'Asia/Seoul', 'south korea': 'Asia/Seoul', 'thailand': 'Asia/Bangkok', 'philippines': 'Asia/Manila', 'indonesia': 'Asia/Jakarta', 'malaysia': 'Asia/Kuala_Lumpur',
  'singapore': 'Asia/Singapore', 'hong kong': 'Asia/Hong_Kong', 'taiwan': 'Asia/Taipei', 'new zealand': 'Pacific/Auckland', 'nz': 'Pacific/Auckland',
  'brazil': 'America/Sao_Paulo', 'mexico': 'America/Mexico_City', 'uae': 'Asia/Dubai', 'dubai': 'Asia/Dubai', 'israel': 'Asia/Jerusalem', 'russia': 'Europe/Moscow',
  'utc': 'UTC', 'gmt': 'UTC', 'est': 'America/New_York', 'edt': 'America/New_York', 'et': 'America/New_York', 'cst': 'America/Chicago', 'cdt': 'America/Chicago',
  'mst': 'America/Denver', 'mdt': 'America/Denver', 'pst': 'America/Los_Angeles', 'pdt': 'America/Los_Angeles', 'pt': 'America/Los_Angeles', 'bst': 'Europe/London',
  'cet': 'Europe/Paris', 'cest': 'Europe/Paris', 'aest': 'Australia/Sydney', 'aedt': 'Australia/Sydney', 'acst': 'Australia/Adelaide', 'awst': 'Australia/Perth',
  'ist': 'Asia/Kolkata', 'jst': 'Asia/Tokyo', 'kst': 'Asia/Seoul', 'ict': 'Asia/Bangkok', 'sgt': 'Asia/Singapore', 'hkt': 'Asia/Hong_Kong', 'nzst': 'Pacific/Auckland', 'nzdt': 'Pacific/Auckland'
}

let ZONES: Record<string, string> | null = null
function zones() {
  if (ZONES) return ZONES
  ZONES = {}
  const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  for (const z of list) ZONES[z.split('/').pop()!.replace(/_/g, ' ').toLowerCase()] = z
  Object.assign(ZONES, ALIASES)
  return ZONES
}

const LOCAL_TZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone
/** A place name to its time zone; "here", "local" and "me" are this PC's. */
function zoneOf(place: string): string | null {
  const p = place.trim().toLowerCase().replace(/[.,]$/, '')
  if (['here', 'local', 'me', 'my time'].includes(p)) return LOCAL_TZ()
  return zones()[p] ?? null
}
const placeName = (place: string) => place.trim().replace(/\b\w/g, c => c.toUpperCase()).replace(/\b(Utc|Gmt|Est|Edt|Cst|Pst|Pdt|Mst|Bst|Cet|Aest|Aedt|Ist|Jst|Ict|Sgt|Nz|Uk|Uae|La|Nyc|Sf)\b/g, w => w.toUpperCase())

/** Minutes the zone is ahead of UTC at instant `t`. */
function offsetMin(t: number, tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(new Date(t)).map(p => [p.type, p.value]))
  const wall = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!)
  return Math.round((wall - Math.floor(t / 1000) * 1000) / 60000)
}

/** The instant when the wall clock in `tz` shows this date and time. */
function zonedInstant(y: number, mo: number, d: number, h: number, mi: number, tz: string) {
  const guess = Date.UTC(y, mo, d, h, mi)
  let t = guess - offsetMin(guess, tz) * 60000
  t = guess - offsetMin(t, tz) * 60000
  return t
}

/** Today's date as the wall clock in `tz` shows it. */
function todayIn(tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date()).map(x => [x.type, x.value]))
  return [+p.year!, +p.month! - 1, +p.day!] as const
}

const fmtTime = (t: number, tz: string) => new Date(t).toLocaleTimeString(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' })
const fmtDay = (t: number, tz: string) => new Date(t).toLocaleDateString(undefined, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' })
const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const utcLabel = (min: number) => `UTC${min >= 0 ? '+' : '−'}${Math.floor(Math.abs(min) / 60)}${Math.abs(min) % 60 ? `:${String(Math.abs(min) % 60).padStart(2, '0')}` : ''}`
function diffLabel(min: number) {
  if (!min) return 'same time as you'
  const h = Math.abs(min) / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? '' : 's'} ${min > 0 ? 'ahead of' : 'behind'} you`
}

/** "3pm", "3:30 pm", "15:00", "noon" → [hour, minute]. */
function parseClock(s: string): [number, number] | null {
  const t = s.trim().toLowerCase()
  if (t === 'noon' || t === 'midday') return [12, 0]
  if (t === 'midnight') return [0, 0]
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/)
  if (!m) return null
  let h = +m[1]!
  const mi = m[2] ? +m[2] : 0
  if (!m[3] && !m[2]) return null // a bare number isn't a time
  if (m[3]?.startsWith('p') && h < 12) h += 12
  if (m[3]?.startsWith('a') && h === 12) h = 0
  return h < 24 && mi < 60 ? [h, mi] : null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const month = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase())
const dayFirst = () => !/^en-US/i.test(typeof navigator === 'undefined' ? 'en-AU' : navigator.language)

/** A date (local midnight) from words like "25 dec", "Dec 25 2027", "2027-01-31", "christmas", "friday". */
export function parseDate(s: string, future = true): Date | null {
  const t = s.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, '')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ymd = (y: number, mo: number, d: number) => {
    const x = new Date(y, mo, d)
    return x.getMonth() === mo ? x : null
  }
  const roll = (mo: number, d: number, y?: number) => {
    if (y) return ymd(y < 100 ? 2000 + y : y, mo, d)
    const x = ymd(now.getFullYear(), mo, d)
    return x && future && x < today ? ymd(now.getFullYear() + 1, mo, d) : x
  }
  let m: RegExpMatchArray | null
  if (t === 'today' || t === 'now') return today
  if (t === 'tomorrow') return new Date(today.getTime() + DAY)
  if (t === 'yesterday') return new Date(today.getTime() - DAY)
  if (t === 'christmas' || t === 'xmas') return roll(11, 25)
  if (t === 'new year' || t === 'new years' || t === "new year's") return future ? ymd(now.getFullYear() + 1, 0, 1) : ymd(now.getFullYear(), 0, 1)
  if (t === 'new year\'s eve' || t === 'nye') return roll(11, 31)
  const wd = WEEKDAYS.indexOf(t.replace(/^next\s+/, ''))
  if (wd >= 0) return new Date(today.getTime() + (((wd - today.getDay() + 7) % 7) || 7) * DAY)
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return ymd(+m[1]!, +m[2]! - 1, +m[3]!)
  if ((m = t.match(/^(\d{1,2})\s+([a-z]{3,})\.?(?:\s+(\d{2,4}))?$/)) && month(m[2]!) >= 0) return roll(month(m[2]!), +m[1]!, m[3] ? +m[3] : undefined)
  if ((m = t.match(/^([a-z]{3,})\.?\s+(\d{1,2})(?:\s+(\d{2,4}))?$/)) && month(m[1]!) >= 0) return roll(month(m[1]!), +m[2]!, m[3] ? +m[3] : undefined)
  if ((m = t.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/))) {
    const [a, b] = [+m[1]!, +m[2]!]
    const [d, mo] = dayFirst() ? [a, b] : [b, a]
    return roll(mo - 1, d, m[3] ? +m[3] : undefined)
  }
  return null
}

const UNIT_RX = '(minute|min|hour|hr|day|week|wk|month|year|yr)s?'

function addUnits(base: Date, n: number, unit: string): Date {
  const u = unit.replace(/s$/, '')
  const d = new Date(base)
  if (u.startsWith('min')) return new Date(d.getTime() + n * 60000)
  if (u.startsWith('h')) return new Date(d.getTime() + n * 3600000)
  if (u === 'day') d.setDate(d.getDate() + n)
  else if (u.startsWith('w')) d.setDate(d.getDate() + n * 7)
  else if (u === 'month') d.setMonth(d.getMonth() + n)
  else d.setFullYear(d.getFullYear() + n)
  return d
}

function relDays(d: Date) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const n = Math.round((day - today) / DAY)
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n.toLocaleString()} days` : `${(-n).toLocaleString()} days ago`
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function timeQuery(q: string): QuickCard | null {
  const t = q.trim().replace(/\s+/g, ' ')
  const tl = t.toLowerCase()
  let m: RegExpMatchArray | null

  // "time in tokyo", "tokyo time", "what time is it in london"
  if ((m = tl.match(/^(?:what\s+)?(?:time\s+(?:is\s+it\s+)?in|current time in)\s+(.+?)\??$/)) || (m = tl.match(/^(.+?)\s+time$/))) {
    const tz = zoneOf(m[1]!)
    if (tz) {
      const now = Date.now()
      const off = offsetMin(now, tz)
      const mine = offsetMin(now, LOCAL_TZ())
      return { label: 'World clock', icon: 'i-lucide-globe-2', caption: `Time in ${placeName(m[1]!)}`, big: fmtTime(now, tz), meta: `${fmtDay(now, tz)} · ${utcLabel(off)} · ${diffLabel(off - mine)}`, copy: fmtTime(now, tz) }
    }
  }

  // "3pm sydney in london", "9:30 am pst to hanoi", "3pm in tokyo" (from here)
  if ((m = tl.match(/^(.+?)\s+(?:in|to)\s+(.+)$/))) {
    const left = m[1]!
    const to = zoneOf(m[2]!)
    let lm: RegExpMatchArray | null
    if (to) {
      let clock: [number, number] | null = null
      let fromPlace = 'here'
      if ((lm = left.match(/^(.+?(?:am|pm|a|p|\d{2}|noon|midnight|midday))\s+(.+)$/)) && parseClock(lm[1]!) && zoneOf(lm[2]!)) {
        clock = parseClock(lm[1]!)
        fromPlace = lm[2]!
      } else if (parseClock(left)) {
        clock = parseClock(left)
      }
      if (clock) {
        const from = zoneOf(fromPlace)!
        const [y, mo, d] = todayIn(from)
        const inst = zonedInstant(y, mo, d, clock[0], clock[1], from)
        const fromLabel = fromPlace === 'here' ? 'your time' : placeName(fromPlace)
        const dayNote = fmtDay(inst, to) !== fmtDay(inst, from) ? ` · ${fmtDay(inst, to)}` : ''
        return { label: 'Time zones', icon: 'i-lucide-globe-2', caption: `${fmtTime(inst, from)} ${fromLabel} =`, big: `${fmtTime(inst, to)} ${placeName(m[2]!)}`, meta: `${utcLabel(offsetMin(inst, from))} → ${utcLabel(offsetMin(inst, to))}${dayNote}`, copy: fmtTime(inst, to) }
      }
    }
  }

  // "days until christmas", "weeks until 1 jan", "days since 2020-03-01"
  if ((m = tl.match(/^(days|weeks|months|hours)\s+(until|till|to|since|from)\s+(.+)$/))) {
    const since = m[2] === 'since' || m[2] === 'from'
    const d = parseDate(m[3]!, !since)
    if (d) {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const days = Math.round(Math.abs(d.getTime() - today.getTime()) / DAY)
      const n = m[1] === 'weeks' ? days / 7 : m[1] === 'months' ? days / 30.4375 : m[1] === 'hours' ? Math.abs(d.getTime() - now.getTime()) / 3600000 : days
      const big = `${Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${m[1]}`
      return { label: 'Date', icon: 'i-lucide-calendar-clock', caption: `${since ? 'Since' : 'Until'} ${fmtDate(d.getTime())} =`, big, meta: `${days.toLocaleString()} days · ${(days / 7).toFixed(1).replace(/\.0$/, '')} weeks`, copy: String(Number.isInteger(n) ? n : n.toFixed(1)) }
    }
  }

  // "today + 90 days", "25 dec - 2 weeks", "in 3 weeks", "90 days from now", "10 days ago"
  let base: Date | null = null
  let n = 0
  let unit = ''
  if ((m = tl.match(new RegExp(`^(.+?)\\s*([+-])\\s*(\\d+)\\s*${UNIT_RX}$`)))) {
    base = /^(now)$/.test(m[1]!) ? new Date() : parseDate(m[1]!, false)
    n = (m[2] === '-' ? -1 : 1) * +m[3]!
    unit = m[4]!
  } else if ((m = tl.match(new RegExp(`^in\\s+(\\d+)\\s*${UNIT_RX}$`))) || (m = tl.match(new RegExp(`^(\\d+)\\s*${UNIT_RX}\\s+from\\s+(?:now|today)$`)))) {
    base = new Date()
    n = +m[1]!
    unit = m[2]!
  } else if ((m = tl.match(new RegExp(`^(\\d+)\\s*${UNIT_RX}\\s+ago$`)))) {
    base = new Date()
    n = -m[1]!
    unit = m[2]!
  }
  if (base && unit) {
    const r = addUnits(base, n, unit)
    const timed = /^(min|h)/.test(unit)
    const big = timed ? r.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : fmtDate(r.getTime())
    return { label: 'Date', icon: 'i-lucide-calendar-clock', caption: `${t} =`, big, meta: timed ? isoDate(r) : `${relDays(r)} · ${isoDate(r)}`, copy: timed ? r.toISOString() : isoDate(r) }
  }

  // Unix timestamps: 10 digits (seconds) or 13 (milliseconds).
  if ((m = t.match(/^(\d{10}|\d{13})$/))) {
    const ms = m[1]!.length === 10 ? +m[1]! * 1000 : +m[1]!
    const d = new Date(ms)
    if (d.getFullYear() > 1990 && d.getFullYear() < 2100) {
      return { label: 'Unix timestamp', icon: 'i-lucide-clock', caption: `${m[1]} =`, big: d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }), meta: `${d.toISOString()} · ${relDays(d)}`, copy: d.toISOString() }
    }
  }
  return null
}

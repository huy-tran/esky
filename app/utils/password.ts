// Password and passphrase generation with Bitwarden's options, defaults and rules.
// Randomness comes from crypto.getRandomValues, with rejection sampling so every choice is equally likely.

export interface PasswordOptions {
  type: 'password' | 'passphrase'
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  special: boolean
  minNumbers: number
  minSpecial: number
  avoidAmbiguous: boolean
  words: number
  separator: string
  capitalize: boolean
  includeNumber: boolean
}

export const PW_DEFAULTS: PasswordOptions = {
  type: 'password',
  length: 14,
  uppercase: true,
  lowercase: true,
  numbers: true,
  special: false,
  minNumbers: 1,
  minSpecial: 0,
  avoidAmbiguous: false,
  words: 6,
  separator: '-',
  capitalize: false,
  includeNumber: false
}

export const PW_LIMITS = { length: [5, 128], minNumbers: [0, 9], minSpecial: [0, 9], words: [3, 20] } as const

export const SPECIAL = '!@#$%^&*'
const SETS = {
  upper: ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'IO'],
  lower: ['abcdefghijkmnopqrstuvwxyz', 'l'],
  number: ['23456789', '01'],
  special: [SPECIAL, '']
} as const
type SetKey = keyof typeof SETS

/** Uniform integer in [0, max). */
export function randomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0]! >= limit)
  return buf[0]! % max
}

const pick = <T>(xs: ArrayLike<T>): T => xs[randomInt(xs.length)]!

function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[xs[i], xs[j]] = [xs[j]!, xs[i]!]
  }
  return xs
}

const clamp = (n: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback
}

/** Bitwarden's fix-ups: at least one character set, at least one of each turned-on set, length fits the minimums. */
export function sanitize(o: PasswordOptions): PasswordOptions {
  const x = { ...PW_DEFAULTS, ...o }
  x.length = clamp(x.length, PW_LIMITS.length, PW_DEFAULTS.length)
  x.words = clamp(x.words, PW_LIMITS.words, PW_DEFAULTS.words)
  x.minNumbers = clamp(x.minNumbers, PW_LIMITS.minNumbers, PW_DEFAULTS.minNumbers)
  x.minSpecial = clamp(x.minSpecial, PW_LIMITS.minSpecial, PW_DEFAULTS.minSpecial)
  if (!x.uppercase && !x.lowercase && !x.numbers && !x.special) x.lowercase = true
  if (x.numbers && x.minNumbers < 1) x.minNumbers = 1
  if (x.special && x.minSpecial < 1) x.minSpecial = 1
  x.separator = String(x.separator ?? '').slice(0, 1)
  return x
}

/** Characters each position must come from; the length grows when the minimums need more room. */
export function minimumLength(o: PasswordOptions) {
  return (o.uppercase ? 1 : 0) + (o.lowercase ? 1 : 0) + (o.numbers ? o.minNumbers : 0) + (o.special ? o.minSpecial : 0)
}

export function generatePassword(opts: PasswordOptions): string {
  const o = sanitize(opts)
  const on: Record<SetKey, boolean> = { upper: o.uppercase, lower: o.lowercase, number: o.numbers, special: o.special }
  const chars = (k: SetKey) => SETS[k][0] + (o.avoidAmbiguous ? '' : SETS[k][1])
  const length = Math.max(o.length, minimumLength(o))
  const slots: (SetKey | 'any')[] = [
    ...(on.upper ? ['upper' as const] : []),
    ...(on.lower ? ['lower' as const] : []),
    ...Array<SetKey>(on.number ? o.minNumbers : 0).fill('number'),
    ...Array<SetKey>(on.special ? o.minSpecial : 0).fill('special')
  ]
  while (slots.length < length) slots.push('any')
  const all = (Object.keys(SETS) as SetKey[]).filter(k => on[k]).map(chars).join('')
  return shuffle(slots).map(k => pick(k === 'any' ? all : chars(k))).join('')
}

export function generatePassphrase(opts: PasswordOptions, wordlist: string[]): string {
  const o = sanitize(opts)
  const words = Array.from({ length: o.words }, () => pick(wordlist))
  const shown = o.capitalize ? words.map(w => w[0]!.toUpperCase() + w.slice(1)) : words
  if (o.includeNumber) {
    const i = randomInt(shown.length)
    shown[i] += String(randomInt(10))
  }
  return shown.join(o.separator)
}

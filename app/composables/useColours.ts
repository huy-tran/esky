// Colour Picker: picked colours (newest first), and HEX / RGB / HSL formatting.
import { persistRef } from './usePersist'

export interface SavedColour {
  id: string
  r: number
  g: number
  b: number
  /** When it was picked (ms). */
  at: number
}

export type ColourFormat = 'hex' | 'rgb' | 'hsl'

const MAX = 60

export function formatColour(c: { r: number, g: number, b: number }, format: ColourFormat, upper = true) {
  if (format === 'rgb') return `rgb(${c.r}, ${c.g}, ${c.b})`
  if (format === 'hsl') {
    const [r, g, b] = [c.r / 255, c.g / 255, c.b / 255]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    let h = 0
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0
    return `hsl(${Math.round((h * 60 + 360) % 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
  }
  const hex = `#${[c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('')}`
  return upper ? hex.toUpperCase() : hex
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const list = ref<SavedColour[]>([])
  persistRef('colours.saved', list)

  /** Save a picked colour at the top (picking the same one again moves it up). */
  function add(c: { r: number, g: number, b: number }) {
    const same = (x: SavedColour) => x.r === c.r && x.g === c.g && x.b === c.b
    const entry: SavedColour = { id: `col_${Date.now().toString(36)}`, ...c, at: Date.now() }
    list.value = [entry, ...list.value.filter(x => !same(x))].slice(0, MAX)
    return entry
  }
  const remove = (id: string) => {
    list.value = list.value.filter(x => x.id !== id)
  }

  return { list, add, remove }
}

export function useColours() {
  instance ??= create()
  return instance
}

// Accent colour presets. Each follows the original green's recipe so contrast stays the same:
// dark theme uses the 400 shade (300 for text), light theme the 600 shade (700 for text).

export type AccentId = 'green' | 'blue' | 'violet' | 'rose' | 'amber' | 'teal'

type Shades = Record<300 | 400 | 500 | 600 | 700, string>

const PALETTES: Record<AccentId, { label: string, shades: Shades }> = {
  green: { label: 'Green', shades: { 300: '#86EFAC', 400: '#4ADE80', 500: '#22C55E', 600: '#16A34A', 700: '#15803D' } },
  blue: { label: 'Blue', shades: { 300: '#93C5FD', 400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8' } },
  violet: { label: 'Violet', shades: { 300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9' } },
  rose: { label: 'Rose', shades: { 300: '#FDA4AF', 400: '#FB7185', 500: '#F43F5E', 600: '#E11D48', 700: '#BE123C' } },
  amber: { label: 'Amber', shades: { 300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' } },
  teal: { label: 'Teal', shades: { 300: '#5EEAD4', 400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E' } }
}

export const ACCENT_IDS = Object.keys(PALETTES) as AccentId[]

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

export const accentLabel = (id: AccentId) => PALETTES[id].label

/** CSS variables for an accent in a theme. */
export function accentVars(id: AccentId, theme: 'dark' | 'light'): Record<string, string> {
  const s = (PALETTES[id] ?? PALETTES.green).shades
  return theme === 'dark'
    ? { '--accent': s[400], '--accent-fg': s[300], '--accent-soft': rgba(s[500], 0.18), '--sel': rgba(s[400], 0.16), '--on-accent': '#0F172A' }
    : { '--accent': s[600], '--accent-fg': s[700], '--accent-soft': rgba(s[600], 0.10), '--sel': rgba(s[500], 0.12), '--on-accent': '#FFFFFF' }
}

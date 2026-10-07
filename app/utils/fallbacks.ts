// What root search offers when nothing matches (Settings → Quicklinks → When nothing matches).
// Built-in searches plus every quicklink that takes text.
import type { Quicklink } from '~/data/fixtures'

export interface FallbackOption { id: string, title: string, icon: string, tile: string }

export const BUILT_IN_FALLBACKS: FallbackOption[] = [
  { id: 'google', title: 'Search Google', icon: 'i-lucide-globe', tile: '#2563EB' },
  { id: 'ask', title: 'Ask AI', icon: 'i-lucide-sparkles', tile: 'var(--accent)' },
  { id: 'translate', title: 'Google Translate', icon: 'i-lucide-languages', tile: '#1A73E8' },
  { id: 'define', title: 'Define (single words)', icon: 'i-lucide-book-a', tile: '#0369A1' }
]

export const DEFAULT_FALLBACKS = ['google', 'ask', 'define']

/** Every option, built-ins first, then quicklinks that take text. */
export const fallbackOptions = (qls: Quicklink[]): FallbackOption[] => [
  ...BUILT_IN_FALLBACKS,
  ...qls.filter(q => /\{\w+\}/.test(q.url)).map(q => ({ id: q.id, title: q.name, icon: q.icon, tile: q.tile }))
]

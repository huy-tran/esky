// Settings shared between the Settings window and the launcher. Persisted under the `settings` key.
import { persistRef } from './usePersist'
import type { AccentId } from '~/utils/accents'
import { DEFAULT_FALLBACKS } from '~/utils/fallbacks'

export interface SettingsState {
  hotkey: string[]
  startLogin: boolean
  activeMonitor: boolean
  closeBlur: boolean
  /** Search sources: desktop apps from the Start menu, and Microsoft Store apps. */
  desktopApps: boolean
  storeApps: boolean
  /** Quick AI reads the text selected in the app you were using. */
  readSelection: boolean
  /** Record what you copy (Clipboard History). */
  clipHistory: boolean
  /** Expand snippet keywords as you type in other apps. */
  textExpansion: boolean
  histLen: string
  keepDays: number
  ignorePm: boolean
  ignored: { name: string, icon: string, tile: string }[]
  backend: 'cc' | 'api'
  /** Model for the API key backend. */
  model: string
  /** What root search offers when nothing matches (see utils/fallbacks.ts), in order. */
  fallbacks: string[]
  accent: AccentId
  /** The launcher's backdrop: Windows' Mica or Acrylic, see-through, or solid. */
  background: 'mica' | 'acrylic' | 'clear' | 'solid'
  /** How opaque the launcher panel is, 20 to 100 (%). Ignored when the background is solid. */
  opacity: number
}

const defaults = (): SettingsState => ({
  hotkey: ['Alt', 'Space'],
  startLogin: true,
  activeMonitor: true,
  closeBlur: true,
  desktopApps: true,
  storeApps: true,
  readSelection: true,
  clipHistory: true,
  textExpansion: true,
  histLen: '500',
  keepDays: 30,
  ignorePm: true,
  ignored: [
    { name: '1Password', icon: 'i-lucide-key-round', tile: '#2563EB' },
    { name: 'Bitwarden', icon: 'i-lucide-shield', tile: '#1D4ED8' },
    { name: 'KeePassXC', icon: 'i-lucide-lock', tile: '#15803D' }
  ],
  backend: 'cc',
  model: 'claude-opus-5-5',
  fallbacks: [...DEFAULT_FALLBACKS],
  accent: 'green',
  background: 'mica',
  opacity: 80
})

let instance: { settings: Ref<SettingsState>, ready: Promise<void> } | null = null

export function useSettings() {
  if (!instance) {
    const settings = ref<SettingsState>(defaults())
    instance = { settings, ready: persistRef('settings', settings, { merge: true }) }
  }
  return instance
}

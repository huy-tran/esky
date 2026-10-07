// Settings shared between the Settings window and the launcher. Persisted under the `settings` key.
import { persistRef } from './usePersist'
import type { AccentId } from '~/utils/accents'

export interface SettingsState {
  hotkey: string[]
  startLogin: boolean
  activeMonitor: boolean
  closeBlur: boolean
  histLen: string
  keepDays: number
  ignorePm: boolean
  ignored: { name: string, icon: string, tile: string }[]
  backend: 'cc' | 'api'
  accent: AccentId
}

const defaults = (): SettingsState => ({
  hotkey: ['Alt', 'Space'],
  startLogin: true,
  activeMonitor: true,
  closeBlur: true,
  histLen: '500',
  keepDays: 30,
  ignorePm: true,
  ignored: [
    { name: '1Password', icon: 'i-lucide-key-round', tile: '#2563EB' },
    { name: 'Bitwarden', icon: 'i-lucide-shield', tile: '#1D4ED8' },
    { name: 'KeePassXC', icon: 'i-lucide-lock', tile: '#15803D' }
  ],
  backend: 'cc',
  accent: 'green'
})

let instance: { settings: Ref<SettingsState>, ready: Promise<void> } | null = null

export function useSettings() {
  if (!instance) {
    const settings = ref<SettingsState>(defaults())
    instance = { settings, ready: persistRef('settings', settings, { merge: true }) }
  }
  return instance
}

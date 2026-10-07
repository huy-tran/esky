// Dev-only: open the launcher in a given state with `/?scene=<key>`. Not reachable in production builds.
import { ONB_TG, SEL, CHAT_INIT, type ChatMsg } from '~/data/fixtures'

export const SCENES = ['main', 'lar', 'actions', 'calc', 'units', 'fx', 'web', 'clip', 'chat', 'setup', 'selection', 'aiResult', 'forgeList', 'snippets', 'qlinkRoot', 'quicklinks', 'windows', 'files', 'system', 'confirm', 'hotkey', 'hkConflict', 'alias', 'store', 'emoji', 'notes', 'float', 'onboard']

export function useScene(k: string) {
  const L = useLauncher()
  const s = L.s
  const st = (x: Record<string, unknown> = {}) => Object.assign(s, { open: true, view: 'search', query: '', sel: 0, actionsOpen: false, selection: null, stream: null, claudeReady: true, notice: '', splitQuery: '', splitSel: 0, hk: null, al: null, confirm: null, onb: null }, x)
  const clone = (): ChatMsg[] => CHAT_INIT.map(m => ({ ...m, blocks: [...m.blocks] }))
  L.floatId.value = null
  switch (k) {
    case 'main': return st()
    case 'lar': return st({ query: 'lar' })
    case 'actions': return st({ actionsOpen: true, actionsQuery: '', actionsSel: 0 })
    case 'calc': return st({ query: '1250 * 1.1' })
    case 'units': return st({ query: '5 km in mi' })
    case 'fx': return st({ query: '100 usd to aud' })
    case 'web': return st({ query: 'g nuxt ui command palette' })
    case 'clip':
      return st({ view: 'clipboard', clipSel: 0, clipQuery: '' })
    case 'chat':
      st()
      return L.openChat('')
    case 'setup': return st({ view: 'chat', claudeReady: false, setupStep: 0, checking: false, messages: [], chatTitle: 'New chat' })
    case 'selection': return st({ selection: SEL })
    case 'aiResult':
      st({ selection: SEL })
      return L.runAi('grammar')
    case 'forgeList':
      st()
      return L.openForgeList()
    case 'snippets': case 'quicklinks': case 'windows': case 'files': case 'emoji': case 'notes':
      return st({ view: k })
    case 'qlinkRoot': return st({ query: 'gh tauri window focus' })
    case 'system': return st({ query: 'system' })
    case 'confirm': return st({ query: 'restart', confirm: L.sysConfirm('restart') })
    case 'hotkey': return st({ view: 'windows', hk: { id: 'wLeft', title: 'Left Half', combo: null, conflict: '' } })
    case 'hkConflict': return st({ view: 'windows', hk: { id: 'wLeft', title: 'Left Half', combo: ['Ctrl', 'Shift', 'V'], ownerId: 'clip', conflict: 'Already used by Clipboard History. Saving moves the hotkey here.' } })
    case 'alias': return st({ query: 'code', al: { id: 'clip', title: 'Clipboard History', value: 'cb' } })
    case 'store': return st({ view: 'store', splitSel: 2 })
    case 'float':
      st({ view: 'notes' })
      L.floatId.value = 'n1'
      return
    case 'onboard': return st({ onb: { step: 0, hk: 0, tg: { ...ONB_TG } } })
  }
}

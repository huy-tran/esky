// Thin bridge to Tauri. Every call is a no-op (or a browser fallback) outside the desktop app.

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function win() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

/** Centre horizontally in the upper third of the monitor under the cursor (or the current one). */
export async function placeLauncher(activeMonitor: boolean) {
  if (!isTauri()) return
  const { currentMonitor, cursorPosition, monitorFromPoint, PhysicalPosition } = await import('@tauri-apps/api/window')
  const w = await win()
  let mon = await currentMonitor()
  if (activeMonitor) {
    const p = await cursorPosition()
    mon = (await monitorFromPoint(p.x, p.y)) ?? mon
  }
  if (!mon) return
  const size = await w.outerSize()
  const x = mon.position.x + Math.round((mon.size.width - size.width) / 2)
  const y = mon.position.y + Math.round(mon.size.height / 3 - size.height / 3)
  await w.setPosition(new PhysicalPosition(x, Math.max(mon.position.y, y)))
}

export async function showWindow(activeMonitor = true) {
  if (!isTauri()) return
  const w = await win()
  await placeLauncher(activeMonitor)
  await w.show()
  await w.setFocus()
}

export async function hideWindow() {
  if (!isTauri()) return
  await (await win()).hide()
}

export async function onWindowBlur(cb: () => void) {
  if (!isTauri()) return () => {}
  return (await win()).onFocusChanged(({ payload: focused }) => {
    if (!focused) cb()
  })
}

export async function openUrl(url: string) {
  if (!isTauri()) {
    window.open(url, '_blank', 'noopener')
    return
  }
  const { openUrl: open, openPath } = await import('@tauri-apps/plugin-opener')
  if (/^(https?|vscode|cursor|zed|phpstorm|ms-settings):/i.test(url)) await open(url)
  else await openPath(url)
}

export async function revealPath(path: string) {
  if (!isTauri()) return
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
  await revealItemInDir(path)
}

export async function copyText(text: string) {
  try {
    if (isTauri()) {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
      await writeText(text)
    } else {
      await navigator.clipboard.writeText(text)
    }
  } catch {
    // Clipboard can be unavailable (permissions, unfocused page). The toast still confirms intent.
  }
}

export async function readClipboardText(): Promise<string> {
  try {
    if (isTauri()) {
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager')
      return await readText()
    }
    return await navigator.clipboard.readText()
  } catch {
    return ''
  }
}

/** Existing window, or a new one once Tauri has finished creating it (calls on it fail before that). */
async function getOrCreate(label: string, opts: Record<string, unknown>) {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const existing = await WebviewWindow.getByLabel(label)
  if (existing) return existing
  const w = new WebviewWindow(label, opts)
  await new Promise<void>((resolve, reject) => {
    w.once('tauri://created', () => resolve())
    w.once('tauri://error', e => reject(e.payload))
  })
  return w
}

export interface SettingsTarget { tab?: string, ext?: string }

/** Open Settings, optionally on a tab and (for Extensions) a specific extension's form. */
export async function openSettings(target: SettingsTarget = {}) {
  const query = Object.fromEntries(Object.entries(target).filter(([, v]) => v)) as Record<string, string>
  if (!isTauri()) {
    await navigateTo({ path: '/settings', query })
    return
  }
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const existing = await WebviewWindow.getByLabel('settings')
  if (existing) {
    const { emitTo } = await import('@tauri-apps/api/event')
    await emitTo('settings', 'settings:open', target)
  }
  const qs = new URLSearchParams(query).toString()
  const w = existing ?? await getOrCreate('settings', { url: `/settings${qs ? `?${qs}` : ''}`, title: 'Esky Settings', width: 900, height: 620, resizable: false, center: true, maximizable: false })
  await w.show()
  await w.setFocus()
}

export async function closeSettings() {
  if (!isTauri()) {
    await navigateTo('/')
    return
  }
  await (await win()).close()
}

/** Always-on-top floating note window. */
export async function floatNote(id: string | null) {
  if (!isTauri()) return
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const existing = await WebviewWindow.getByLabel('float')
  if (!id) {
    await existing?.close()
    return
  }
  if (existing) {
    const { emitTo } = await import('@tauri-apps/api/event')
    await emitTo('float', 'float:note', id)
    return
  }
  await getOrCreate('float', { url: `/float?id=${id}`, title: 'Esky Note', width: 250, height: 194, decorations: false, transparent: true, alwaysOnTop: true, resizable: false, skipTaskbar: true, shadow: false })
}

export interface ShortcutBinding { accelerator: string, run: () => void }

/** Replace every global shortcut this window owns with `bindings`. */
export async function setGlobalShortcuts(bindings: ShortcutBinding[]) {
  if (!isTauri()) return
  const { register, unregisterAll } = await import('@tauri-apps/plugin-global-shortcut')
  await unregisterAll()
  for (const b of bindings) {
    try {
      await register(b.accelerator, (e) => {
        if (e.state === 'Pressed') b.run()
      })
    } catch (err) {
      console.warn(`Could not register ${b.accelerator}`, err)
    }
  }
}

export async function setAutostart(on: boolean) {
  if (!isTauri()) return
  const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart')
  if (on === await isEnabled()) return
  await (on ? enable() : disable())
}

// System commands (desktop app; see src-tauri/src/system.rs).

export type SystemAction = 'lock' | 'sleep' | 'restart' | 'shutdown' | 'signout' | 'emptyBin'

async function invokeDesktop<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error('Only available in the desktop app')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export const systemAction = (action: SystemAction) => invokeDesktop<void>('system_action', { action })
export const recycleBinInfo = () => invokeDesktop<{ items: number, bytes: number }>('recycle_bin_info')
export const removableDrives = () => invokeDesktop<{ letter: string, label: string }[]>('removable_drives')
export const ejectDrive = (letter: string) => invokeDesktop<void>('eject_drive', { letter })

// The app you were in before Esky opened (desktop app; see src-tauri/src/input.rs).

export interface CapturedTarget { app_path: string | null, selection: string | null }

/** Remember the app in front and, if `readSelection`, read its selected text. Call before showing the launcher. */
export const captureTarget = (readSelection: boolean) => invokeDesktop<CapturedTarget>('capture_target', { readSelection })
/** Forget it (opened from the tray: there's nothing to paste into). */
export const clearTarget = () => isTauri() ? invokeDesktop<void>('clear_target') : Promise.resolve()
/** Paste into that app. Hide the launcher first. */
export const pasteToTarget = (text: string) => invokeDesktop<void>('paste_to_target', { text })

/** Move or size the app Esky was opened from: a named layout, or a rectangle in percent of its screen. */
export const windowLayout = (layout: 'maximize' | 'restore' | 'center' | 'next-display' | 'rect', rect?: [number, number, number, number]) =>
  invokeDesktop<void>('window_layout', { layout, rect: rect ?? null })

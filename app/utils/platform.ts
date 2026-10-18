// Which desktop Esky runs on, for the few words and behaviours that differ.
const platform = typeof navigator !== 'undefined' ? navigator.platform : ''
export const isWin = /^Win/i.test(platform)
export const isLinux = /^Linux/i.test(platform)

/** The file manager's name, as the desktop calls it. */
export const fileManager = isLinux ? 'File Manager' : 'File Explorer'

/** What to type into Hyprland's config to open Esky from a key (Wayland has no app-wide shortcuts). */
export const HYPR_BIND = 'bind = ALT, SPACE, exec, esky --toggle'

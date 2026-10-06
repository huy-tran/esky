// Extension tokens. The desktop app keeps them in Windows Credential Manager (Rust `keyring`);
// the browser preview has no credential store, so it falls back to this browser's storage.
import { isTauri } from './usePlatform'

const account = (ext: string, key: string) => `${ext}.${key}`
const local = (ext: string, key: string) => `esky:secret:${account(ext, key)}`

export const secretsAreNative = () => isTauri()

export async function getSecret(ext: string, key: string): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return (await invoke<string | null>('secret_get', { account: account(ext, key) })) ?? ''
  }
  try {
    return localStorage.getItem(local(ext, key)) ?? ''
  } catch {
    return ''
  }
}

export async function setSecret(ext: string, key: string, value: string) {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    if (value) await invoke('secret_set', { account: account(ext, key), value })
    else await invoke('secret_delete', { account: account(ext, key) })
    return
  }
  try {
    if (value) localStorage.setItem(local(ext, key), value)
    else localStorage.removeItem(local(ext, key))
  } catch {
    // storage blocked
  }
}

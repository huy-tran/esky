// App version and the real Windows version, for Settings → About.
// WebView2 (desktop app) and Chromium browsers expose the OS through User-Agent Client Hints.

interface UAData {
  platform: string
  getHighEntropyValues: (hints: string[]) => Promise<{ platformVersion?: string, architecture?: string, bitness?: string }>
}

async function describeOs(): Promise<string> {
  const ua = (navigator as Navigator & { userAgentData?: UAData }).userAgentData
  if (!ua) return /Windows/.test(navigator.userAgent) ? 'Windows' : navigator.platform
  const v = await ua.getHighEntropyValues(['platformVersion', 'architecture', 'bitness']).catch(() => ({} as Awaited<ReturnType<UAData['getHighEntropyValues']>>))
  let name = ua.platform
  if (ua.platform === 'Windows' && v.platformVersion) {
    // platformVersion 13+ is Windows 11, 1–10 is Windows 10.
    const major = parseInt(v.platformVersion, 10)
    name = major >= 13 ? 'Windows 11' : major > 0 ? 'Windows 10' : 'Windows'
  }
  const arch = v.architecture === 'arm' ? 'ARM64' : v.architecture === 'x86' ? (v.bitness === '64' ? 'x64' : 'x86') : ''
  return arch ? `${name} ${arch}` : name
}

export function useSystemInfo() {
  const version = useRuntimeConfig().public.appVersion as string
  const os = ref('')
  onMounted(async () => {
    os.value = await describeOs()
  })
  return { version, os }
}

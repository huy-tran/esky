<script setup lang="ts">
import { accentVars } from '~/utils/accents'

const { settings } = useSettings()
const colorMode = useColorMode()

onMounted(() => {
  if (!isTauri()) document.documentElement.classList.add('is-browser')

  // Accent colour: inline variables on <html> override the green defaults in main.css.
  // Every window runs this, and settings sync between windows, so a change applies everywhere.
  watchEffect(() => {
    const vars = accentVars(settings.value.accent, colorMode.value === 'light' ? 'light' : 'dark')
    for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v)
  })

  // Launcher transparency (Settings → Appearance): the panel colour's opacity...
  watchEffect(() => {
    const dark = colorMode.value !== 'light'
    const a = settings.value.background === 'solid' ? 1 : Math.min(100, Math.max(20, settings.value.opacity ?? 80)) / 100
    document.documentElement.style.setProperty('--win-bg', dark ? `rgba(15, 23, 42, ${a})` : `rgba(250, 250, 247, ${a})`)
  })
  // ...and the window's backdrop behind it, set on the launcher window itself.
  if (isTauri() && useRoute().path === '/') {
    watch(() => [settings.value.background, colorMode.value], async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      invoke('window_effect', { effect: settings.value.background, dark: colorMode.value !== 'light' }).catch(() => {})
    }, { immediate: true })
  }
})
</script>

<template>
  <!-- Toasts render inside the launcher window (see LauncherWindow), not at page level. -->
  <UApp :toaster="null">
    <NuxtPage />
  </UApp>
</template>

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
})
</script>

<template>
  <!-- Toasts render inside the launcher window (see LauncherWindow), not at page level. -->
  <UApp :toaster="null">
    <NuxtPage />
  </UApp>
</template>

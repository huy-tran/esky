<script setup lang="ts">
import { ITEMS, MODS } from '~/data/fixtures'
import { toAccelerator } from '~/utils/text'
import type { ShortcutBinding } from '~/composables/usePlatform'

const L = useLauncher()
const s = L.s
const tauri = isTauri()

// Global key map. Capture phase so it runs before Nuxt UI / reka handlers, as in the prototype.
const onKey = (e: KeyboardEvent) => L.onKey(e)
onMounted(() => window.addEventListener('keydown', onKey, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))

// Desktop: hide on blur, global shortcuts for the launcher and every command hotkey.
if (tauri) {
  const unlisten: (() => void)[] = []
  onMounted(async () => {
    unlisten.push(await onWindowBlur(() => {
      if (s.open && L.settings.value.closeBlur && !s.hk) s.open = false
    }))
    // Tray icon, tray menu and a second launch of the app all ask the launcher to open.
    const { listen } = await import('@tauri-apps/api/event')
    unlisten.push(await listen('esky://show', () => L.openFromTray()))
  })
  onBeforeUnmount(() => unlisten.forEach(u => u()))

  const bindings = computed(() => {
    void L.apps.version.value // apps and quicklinks can have hotkeys too, and they load after this first runs
    void L.qls.version.value
    void L.sn.version.value
    const list: ShortcutBinding[] = [{
      accelerator: toAccelerator(L.settings.value.hotkey),
      run: () => {
        if (s.open) s.open = false
        else L.openFromHotkey()
      }
    }]
    for (const id of Object.keys(ITEMS)) {
      // Ctrl , only opens Settings from inside the launcher, never system-wide.
      if (id === 'settings') continue
      const ks = L.rowKeys(id)
      if (ks && ks.length > 1 && MODS.includes(ks[0]!)) {
        list.push({ accelerator: toAccelerator(ks), run: () => L.activateFromHotkey(id) })
      }
    }
    return list
  })
  watch(() => bindings.value.map(b => b.accelerator).join('|'), () => setGlobalShortcuts(bindings.value), { immediate: true })
}

// Browser only: reopen affordance and the "what just happened" notice, since there is no tray.
const route = useRoute()
onMounted(async () => {
  await L.ready
  if (import.meta.dev && typeof route.query.scene === 'string') useScene(route.query.scene)
  L.focus()
})
</script>

<template>
  <div class="min-h-screen grid place-items-center">
    <LauncherWindow v-if="s.open" />
    <template v-else-if="!tauri">
      <button
        class="flex items-center gap-2.5 px-4 py-2.5 rounded-[8px] border border-(--win-bd) bg-(--win-bg) backdrop-blur-[30px] text-(--muted) text-[13px] cursor-pointer"
        @click="L.openWin()"
      >
        <EskyIcon :size="22" />Esky is hidden. Press <Keys :keys="['Alt', 'Space']" /> or click to open
      </button>
    </template>
    <div
      v-if="!tauri && s.notice"
      class="fixed bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-[8px] border border-(--win-bd) bg-(--pop-bg) shadow-(--shadow) text-[13px] lp-in"
    >
      <UIcon name="i-lucide-circle-check" class="size-[15px] text-(--ok)" />{{ s.notice }}
    </div>
    <LauncherFloatingNote v-if="!tauri" />
  </div>
</template>

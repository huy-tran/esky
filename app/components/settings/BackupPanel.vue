<script setup lang="ts">
// Settings → General: export your setup to a file, or restore one.
import { exportBackup, importBackup } from '~/utils/backup'

const file = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const note = ref<{ ok: boolean, text: string } | null>(null)

async function doExport() {
  busy.value = true
  note.value = null
  try {
    const json = await exportBackup()
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      const path = await invoke<string>('save_backup', { json })
      note.value = { ok: true, text: `Saved to ${path}` }
      revealPath(path)
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      a.download = 'esky-settings.json'
      a.click()
      note.value = { ok: true, text: 'Downloaded esky-settings.json' }
    }
  } catch (e) {
    note.value = { ok: false, text: String(e) }
  }
  busy.value = false
}

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  busy.value = true
  try {
    const n = await importBackup(await f.text())
    note.value = { ok: true, text: `Restored ${n} parts of your setup. Add your tokens and API key again in Extensions and AI.` }
    setTimeout(() => location.reload(), 1500)
  } catch (err) {
    note.value = { ok: false, text: (err as Error).message }
  }
  busy.value = false
  if (file.value) file.value.value = ''
}

const ghostBtn = 'h-8 px-3 gap-1.5 rounded-[6px] ring-0 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) text-[12.5px] font-normal'
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="text-[12px] font-semibold">Back up your setup</div>
    <div class="flex items-center gap-4 px-4 py-3 border border-(--bd) rounded-[8px] bg-(--surface)">
      <div class="flex-1 min-w-0 text-[12.5px] text-(--muted) leading-normal">
        Settings, shortcuts, aliases, quicklinks, snippets, AI commands, notes and extension options in one file, to restore here or on another PC. Tokens, API keys, clipboard history and chats aren’t included.
      </div>
      <UButton icon="i-lucide-download" label="Export" color="neutral" variant="outline" :class="ghostBtn" :disabled="busy" :ui="{ leadingIcon: 'size-[13px]' }" @click="doExport" />
      <UButton icon="i-lucide-upload" label="Import" color="neutral" variant="outline" :class="ghostBtn" :disabled="busy" :ui="{ leadingIcon: 'size-[13px]' }" @click="file?.click()" />
      <input ref="file" type="file" accept=".json,application/json" class="hidden" @change="onFile">
    </div>
    <div v-if="note" class="text-[12px] break-all" :class="note.ok ? 'text-(--ok)' : 'text-(--err)'">{{ note.text }}</div>
  </div>
</template>

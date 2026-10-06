<script setup lang="ts">
// Always-on-top floating note window (desktop app). Shares notes with the launcher through the store.
import { NOTES_INIT, type Note } from '~/data/fixtures'

const route = useRoute()
const id = ref(String(route.query.id ?? ''))
const notes = ref<Note[]>(NOTES_INIT.map(n => ({ ...n })))
const floatId = ref<string | null>(id.value)

persistRef('notes', notes)
persistRef('floatId', floatId)

const note = computed(() => notes.value.find(n => n.id === id.value))

const update = (body: string) => {
  notes.value = notes.value.map(n => n.id === id.value ? { ...n, body, updated: 'Just now' } : n)
}

const close = async () => {
  floatId.value = null
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().close()
  }
}

onMounted(async () => {
  if (!isTauri()) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().listen<string>('float:note', (e) => {
    id.value = e.payload
  })
})
</script>

<template>
  <NoteCard v-if="note" :body="note.body" @update:body="update" @close="close" />
</template>

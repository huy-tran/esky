<script setup lang="ts">
// Browser build only. The desktop app opens the note in its own always-on-top window (pages/float.vue).
const L = useLauncher()
const note = computed(() => L.notes.value.find(n => n.id === L.floatId.value))
</script>

<template>
  <NoteCard
    v-if="note"
    class="absolute top-6 right-6 z-[3]"
    :body="note.body"
    @update:body="(v: string) => L.editNote(note!.id, v)"
    @close="L.floatId.value = null"
  />
</template>

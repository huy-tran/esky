<script setup lang="ts">
// Settings → Quicklinks: add, edit and remove your quicklinks.
import { argLabel, quicklinkErrors, type QuicklinkInput } from '~/composables/useQuicklinks'

const qls = useQuicklinks()

/** The row being edited ('new' for the add form), and its draft. */
const editing = ref<string | null>(null)
const draft = reactive<QuicklinkInput>({ name: '', kw: '', url: '' })
const tried = ref(false)

const errors = computed(() => quicklinkErrors(draft, qls.list.value.filter(q => q.id !== editing.value)))

function startEdit(id: string) {
  const q = qls.list.value.find(x => x.id === id)
  if (!q) return
  Object.assign(draft, { name: q.name, kw: q.kw, url: q.url })
  editing.value = id
  tried.value = false
}
function startNew() {
  Object.assign(draft, { name: '', kw: '', url: 'https://' })
  editing.value = 'new'
  tried.value = false
}
function save() {
  tried.value = true
  if (errors.value.length) return
  if (editing.value === 'new') qls.add(draft)
  else if (editing.value) qls.update(editing.value, draft)
  editing.value = null
}
function remove(id: string) {
  qls.remove(id)
  if (editing.value === id) editing.value = null
}

const card = 'flex flex-col border border-(--bd) rounded-[8px] bg-(--surface)'
const ghostBtn = 'h-8 px-3 gap-1.5 rounded-[6px] ring-0 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) text-[12.5px] font-normal'
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="text-[12.5px] text-(--muted) leading-normal">
      A quicklink opens a web page or folder. Put <span class="font-mono text-(--fg)">{query}</span> (any word in braces) where your text goes, then type the keyword and the text in Esky's search, e.g. <span class="font-mono text-(--fg)">gh tauri</span>.
    </div>

    <div :class="card">
      <template v-for="(q, i) in qls.list.value" :key="q.id">
        <!-- Editing this one -->
        <div v-if="editing === q.id" class="p-4 flex flex-col gap-2.5 border-b border-(--bd)">
          <SettingsQuicklinkForm v-model="draft" :errors="tried ? errors : []" :arg="argLabel(draft.url)" />
          <div class="flex gap-2 justify-end">
            <UButton label="Cancel" color="neutral" variant="ghost" class="h-8 px-3 text-[12.5px]" @click="editing = null" />
            <UButton label="Save" class="h-8 px-3.5 rounded-[6px] bg-(--accent) hover:bg-(--accent) text-(--on-accent) text-[12.5px] font-semibold" @click="save" />
          </div>
        </div>
        <div v-else class="min-h-12 py-2 px-4 flex items-center gap-3" :class="i < qls.list.value.length - 1 || editing === 'new' ? 'border-b border-(--bd)' : ''">
          <Tile :icon="q.icon" :tile="q.tile" :size="26" :icon-size="14" />
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium truncate">{{ q.name }}<span v-if="q.kw" class="ml-2 font-mono text-[11.5px] text-(--muted)">{{ q.kw }}</span></div>
            <div class="font-mono text-[11.5px] text-(--muted) truncate">{{ q.url }}</div>
          </div>
          <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" :aria-label="`Edit ${q.name}`" class="size-7 p-0 justify-center text-(--muted)" :ui="{ leadingIcon: 'size-3.5' }" @click="startEdit(q.id)" />
          <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" :aria-label="`Delete ${q.name}`" class="size-7 p-0 justify-center text-(--muted) hover:text-(--err)" :ui="{ leadingIcon: 'size-3.5' }" @click="remove(q.id)" />
        </div>
      </template>
      <div v-if="editing === 'new'" class="p-4 flex flex-col gap-2.5">
        <SettingsQuicklinkForm v-model="draft" :errors="tried ? errors : []" :arg="argLabel(draft.url)" />
        <div class="flex gap-2 justify-end">
          <UButton label="Cancel" color="neutral" variant="ghost" class="h-8 px-3 text-[12.5px]" @click="editing = null" />
          <UButton label="Add quicklink" class="h-8 px-3.5 rounded-[6px] bg-(--accent) hover:bg-(--accent) text-(--on-accent) text-[12.5px] font-semibold" @click="save" />
        </div>
      </div>
      <div v-if="!qls.list.value.length && editing !== 'new'" class="py-8 text-center text-[13px] text-(--muted)">No quicklinks yet.</div>
    </div>

    <UButton v-if="editing !== 'new'" icon="i-lucide-plus" label="New quicklink" color="neutral" variant="outline" :class="`${ghostBtn} self-start`" :ui="{ leadingIcon: 'size-[13px]' }" @click="startNew" />
  </div>
</template>

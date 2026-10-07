<script setup lang="ts">
// Settings → Snippets: text expansion on/off, and your snippets.
import { snippetErrors, type SnippetInput } from '~/composables/useSnippets'

const { settings } = useSettings()
const sn = useSnippets()

const editing = ref<string | null>(null)
const draft = reactive<SnippetInput>({ name: '', kw: '', folder: 'General', text: '' })
const tried = ref(false)
const errors = computed(() => snippetErrors(draft, sn.list.value.filter(x => x.id !== editing.value)))

function startEdit(id: string) {
  const x = sn.list.value.find(s => s.id === id)
  if (!x) return
  Object.assign(draft, { name: x.name, kw: x.kw, folder: x.folder, text: x.text })
  editing.value = id
  tried.value = false
}
function startNew() {
  Object.assign(draft, { name: '', kw: ';', folder: 'General', text: '' })
  editing.value = 'new'
  tried.value = false
}
function save() {
  tried.value = true
  if (errors.value.length) return
  if (editing.value === 'new') sn.add(draft)
  else if (editing.value) sn.update(editing.value, draft)
  editing.value = null
}
function remove(id: string) {
  sn.remove(id)
  if (editing.value === id) editing.value = null
}

const card = 'flex flex-col border border-(--bd) rounded-[8px] bg-(--surface)'
const ghostBtn = 'h-8 px-3 gap-1.5 rounded-[6px] ring-0 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) text-[12.5px] font-normal'
const switchLg = {
  base: 'w-[38px] border-[3px] data-[state=unchecked]:bg-(--tile) data-[state=checked]:bg-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)',
  container: 'h-[22px]',
  thumb: 'size-4 bg-white shadow-none data-[state=checked]:translate-x-4'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div :class="card">
      <div class="px-4 py-3.5 flex items-center gap-4">
        <SettingsRow title="Text expansion" desc="Type a snippet's keyword in any app and Esky replaces it with the snippet. Esky only looks at the last few characters you typed and keeps nothing." />
        <USwitch v-model="settings.textExpansion" aria-label="Text expansion" :ui="switchLg" />
      </div>
    </div>

    <div :class="card">
      <template v-for="(x, i) in sn.list.value" :key="x.id">
        <div v-if="editing === x.id" class="p-4 flex flex-col gap-2.5 border-b border-(--bd)">
          <SettingsSnippetForm v-model="draft" :errors="tried ? errors : []" :folders="sn.folders.value" />
          <div class="flex gap-2 justify-end">
            <UButton label="Cancel" color="neutral" variant="ghost" class="h-8 px-3 text-[12.5px]" @click="editing = null" />
            <UButton label="Save" class="h-8 px-3.5 rounded-[6px] bg-(--accent) hover:bg-(--accent) text-(--on-accent) text-[12.5px] font-semibold" @click="save" />
          </div>
        </div>
        <div v-else class="min-h-12 py-2 px-4 flex items-center gap-3" :class="i < sn.list.value.length - 1 || editing === 'new' ? 'border-b border-(--bd)' : ''">
          <Tile icon="i-lucide-text-quote" tile="#0D9488" :size="26" :icon-size="14" />
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium truncate">{{ x.name }}<span v-if="x.kw" class="ml-2 font-mono text-[11.5px] text-(--muted)">{{ x.kw }}</span><span class="ml-2 text-[11.5px] text-(--faint)">{{ x.folder }}</span></div>
            <div class="text-[11.5px] text-(--muted) truncate">{{ x.text.split('\n')[0] }}</div>
          </div>
          <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" :aria-label="`Edit ${x.name}`" class="size-7 p-0 justify-center text-(--muted)" :ui="{ leadingIcon: 'size-3.5' }" @click="startEdit(x.id)" />
          <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" :aria-label="`Delete ${x.name}`" class="size-7 p-0 justify-center text-(--muted) hover:text-(--err)" :ui="{ leadingIcon: 'size-3.5' }" @click="remove(x.id)" />
        </div>
      </template>
      <div v-if="editing === 'new'" class="p-4 flex flex-col gap-2.5">
        <SettingsSnippetForm v-model="draft" :errors="tried ? errors : []" :folders="sn.folders.value" />
        <div class="flex gap-2 justify-end">
          <UButton label="Cancel" color="neutral" variant="ghost" class="h-8 px-3 text-[12.5px]" @click="editing = null" />
          <UButton label="Add snippet" class="h-8 px-3.5 rounded-[6px] bg-(--accent) hover:bg-(--accent) text-(--on-accent) text-[12.5px] font-semibold" @click="save" />
        </div>
      </div>
      <div v-if="!sn.list.value.length && editing !== 'new'" class="py-8 text-center text-[13px] text-(--muted)">No snippets yet.</div>
    </div>

    <UButton v-if="editing !== 'new'" icon="i-lucide-plus" label="New snippet" color="neutral" variant="outline" :class="`${ghostBtn} self-start`" :ui="{ leadingIcon: 'size-[13px]' }" @click="startNew" />
  </div>
</template>

<script setup lang="ts">
// Settings → AI: add, edit and remove your own Quick AI commands.
import { AI_ICONS, aiCommandErrors, type AiCommandInput } from '~/composables/useAiCommands'

const cmds = useAiCommands()
const editing = ref<string | null>(null)
const draft = reactive<AiCommandInput>({ title: '', icon: AI_ICONS[0]!, prompt: '' })
const tried = ref(false)
const errors = computed(() => aiCommandErrors(draft))
const icons = AI_ICONS.map(i => ({ value: i, label: i.replace('i-lucide-', '').replace(/-/g, ' '), icon: i }))

function startEdit(id: string) {
  const c = cmds.list.value.find(x => x.id === id)
  if (!c) return
  Object.assign(draft, { title: c.title, icon: c.icon, prompt: c.prompt })
  editing.value = id
  tried.value = false
}
function startNew() {
  Object.assign(draft, { title: '', icon: AI_ICONS[0]!, prompt: '' })
  editing.value = 'new'
  tried.value = false
}
function save() {
  tried.value = true
  if (errors.value.length) return
  if (editing.value === 'new') cmds.add(draft)
  else if (editing.value) cmds.update(editing.value, draft)
  editing.value = null
}
function remove(id: string) {
  cmds.remove(id)
  if (editing.value === id) editing.value = null
}

const field = 'border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) text-[12.5px] focus-visible:outline-2 focus-visible:outline-(--accent)'
const labelUi = { root: 'flex flex-col gap-[5px]', label: 'text-[12px] font-semibold text-(--fg)', container: 'mt-0', help: 'text-[11.5px] text-(--muted) mt-1' }
const ghostBtn = 'h-8 px-3 gap-1.5 rounded-[6px] ring-0 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) text-[12.5px] font-normal'
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="text-[12px] font-semibold">Your AI commands</div>
    <div class="text-[12.5px] text-(--muted) leading-normal">Run on selected text like Fix Grammar. The first four get <span class="font-mono text-(--fg)">Ctrl 6</span> to <span class="font-mono text-(--fg)">Ctrl 9</span> when text is selected; give any of them a hotkey in Shortcuts.</div>

    <div class="flex flex-col border border-(--bd) rounded-[8px] bg-(--surface)">
      <div
        v-for="(c, i) in cmds.list.value"
        :key="c.id"
        class="min-h-12 py-2 px-4 flex items-center gap-3"
        :class="[i < cmds.list.value.length - 1 || editing ? 'border-b border-(--bd)' : '', editing === c.id ? 'bg-(--accent-soft)' : '']"
      >
        <Tile :icon="c.icon" tile="var(--accent)" :size="26" :icon-size="14" />
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-medium truncate">{{ c.title }}<span v-if="i < 4" class="ml-2 font-mono text-[11.5px] text-(--muted)">Ctrl {{ i + 6 }}</span></div>
          <div class="text-[11.5px] text-(--muted) truncate">{{ c.prompt }}</div>
        </div>
        <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" :aria-label="`Edit ${c.title}`" class="size-7 p-0 justify-center text-(--muted)" :ui="{ leadingIcon: 'size-3.5' }" @click="startEdit(c.id)" />
        <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" :aria-label="`Delete ${c.title}`" class="size-7 p-0 justify-center text-(--muted) hover:text-(--err)" :ui="{ leadingIcon: 'size-3.5' }" @click="remove(c.id)" />
      </div>
      <!-- Add or edit -->
      <div v-if="editing" class="p-4 flex flex-col gap-3">
        <div class="flex gap-3">
          <UFormField label="Name" class="flex-1" :ui="labelUi">
            <UInput v-model="draft.title" placeholder="e.g. Rewrite as a Jira ticket" variant="none" :ui="{ base: `${field} h-8 px-2.5` }" />
          </UFormField>
          <UFormField label="Icon" :ui="labelUi">
            <USelectMenu v-model="draft.icon" :items="icons" value-key="value" :icon="draft.icon" variant="none" :search-input="false" class="w-[150px]" :ui="{ base: `${field} h-8 pl-2.5 pr-8`, leadingIcon: 'size-3.5', content: 'bg-(--pop-bg) ring-(--bd)', item: 'text-[12.5px] capitalize', value: 'capitalize' }" />
          </UFormField>
        </div>
        <UFormField label="What should Claude do with the text?" help="Claude gets this instruction and your selected text, and replies with only the result." :ui="labelUi">
          <UTextarea v-model="draft.prompt" :rows="4" placeholder="e.g. Rewrite this as a Jira ticket with a short title, a description and acceptance criteria." variant="none" :ui="{ base: `${field} px-2.5 py-2 resize-none leading-[1.5]` }" />
        </UFormField>
        <div v-if="tried && errors.length" class="text-[12px] text-(--err)">{{ errors.join(' ') }}</div>
        <div class="flex gap-2 justify-end">
          <UButton label="Cancel" color="neutral" variant="ghost" class="h-8 px-3 text-[12.5px]" @click="editing = null" />
          <UButton :label="editing === 'new' ? 'Add command' : 'Save'" class="h-8 px-3.5 rounded-[6px] bg-(--accent) hover:bg-(--accent) text-(--on-accent) text-[12.5px] font-semibold" @click="save" />
        </div>
      </div>
      <div v-if="!cmds.list.value.length && editing !== 'new'" class="py-6 text-center text-[13px] text-(--muted)">No commands yet.</div>
    </div>

    <UButton v-if="editing !== 'new'" icon="i-lucide-plus" label="New AI command" color="neutral" variant="outline" :class="`${ghostBtn} self-start`" :ui="{ leadingIcon: 'size-[13px]' }" @click="startNew" />
  </div>
</template>

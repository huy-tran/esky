<script setup lang="ts">
// Name, keyword, folder and text for one snippet.
import { SNIPPET_PLACEHOLDERS, type SnippetInput } from '~/composables/useSnippets'

defineProps<{ errors: string[], folders: string[] }>()
const model = defineModel<SnippetInput>({ required: true })

const label = 'text-[12px] font-semibold text-(--fg)'
const input = 'h-8 w-full border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-2.5 text-[12.5px] focus-visible:outline-2 focus-visible:outline-(--accent)'
</script>

<template>
  <div class="grid grid-cols-[1fr_120px_140px] gap-x-3 gap-y-2.5">
    <label class="flex flex-col gap-1">
      <span :class="label">Name</span>
      <input v-model="model.name" placeholder="Email sign-off" :class="input">
    </label>
    <label class="flex flex-col gap-1">
      <span :class="label">Keyword</span>
      <input v-model="model.kw" placeholder=";sig" spellcheck="false" :class="`${input} font-mono`">
    </label>
    <label class="flex flex-col gap-1">
      <span :class="label">Folder</span>
      <input v-model="model.folder" list="snippet-folders" placeholder="General" :class="input">
      <datalist id="snippet-folders"><option v-for="f in folders" :key="f" :value="f" /></datalist>
    </label>
    <label class="col-span-3 flex flex-col gap-1">
      <span :class="label">Text</span>
      <textarea v-model="model.text" rows="4" spellcheck="false" class="w-full border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-2.5 py-1.5 text-[12.5px] leading-[1.6] resize-y focus-visible:outline-2 focus-visible:outline-(--accent)" />
      <span class="text-[11.5px] text-(--muted)">
        Filled in when used: <span v-for="p in SNIPPET_PLACEHOLDERS" :key="p" class="font-mono text-(--fg) mr-1.5">{{ p }}</span>({cursor} is removed). A keyword like <span class="font-mono text-(--fg)">;sig</span> starting with a symbol won't fire while you type normal words.
      </span>
    </label>
    <div v-if="errors.length" class="col-span-3 flex flex-col gap-0.5 text-[12px] text-(--err)">
      <span v-for="e in errors" :key="e">{{ e }}</span>
    </div>
  </div>
</template>

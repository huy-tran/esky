<script setup lang="ts">
// Preferences form for one extension, generated from its `prefs` declaration in the registry.
import { z } from 'zod'
import type { ExtensionDef, PrefField, Prefs } from '~/extensions/registry'

const props = defineProps<{ ext: ExtensionDef }>()
const emit = defineEmits<{ openTab: [string] }>()

const exts = useExtensions()
const native = secretsAreNative()

const state = reactive<Prefs>({})
const shown = reactive<Record<string, boolean>>({})
const status = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
let statusTimer: ReturnType<typeof setTimeout> | undefined

/** Load saved values (and tokens from the secure store) whenever the selected extension changes. */
async function load() {
  const ext = props.ext
  const values: Prefs = { ...exts.prefsFor(ext.id) }
  for (const f of ext.prefs.filter(f => f.type === 'secret')) values[f.key] = await getSecret(ext.id, f.key)
  if (ext !== props.ext) return
  for (const k of Object.keys(state)) delete state[k]
  Object.assign(state, values)
  status.value = 'idle'
}
watch(() => props.ext.id, load, { immediate: true })

const schema = computed(() => z.object(Object.fromEntries(props.ext.prefs.map((f): [string, z.ZodType] => {
  if (f.type === 'switch') return [f.key, z.boolean()]
  if (f.type === 'number') {
    return [f.key, z.number({ message: `${f.label} must be a number` }).int(`${f.label} must be a whole number`).min(f.min ?? -Infinity, `${f.label} must be at least ${f.min}`).max(f.max ?? Infinity, `${f.label} must be at most ${f.max}`)]
  }
  const s = z.string()
  return [f.key, f.required ? s.trim().min(1, `${f.label} is required`) : s]
}))))

async function save() {
  status.value = 'saving'
  try {
    const ext = props.ext
    const plain: Prefs = {}
    for (const f of ext.prefs) {
      const v = state[f.key]
      if (f.type === 'secret') await setSecret(ext.id, f.key, String(v ?? '').trim())
      else plain[f.key] = typeof v === 'string' ? v.trim() : (v ?? '')
    }
    exts.savePrefs(ext.id, plain)
    status.value = 'saved'
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => { status.value = 'idle' }, 2500)
  } catch {
    status.value = 'error'
  }
}

const secretHelp = (f: PrefField) => [f.description, native ? 'Stored in Windows Credential Manager.' : 'Browser preview: stored in this browser only.'].filter(Boolean).join(' ')

const field = 'w-full h-8 border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) text-[12.5px] focus-visible:outline-2 focus-visible:outline-(--accent)'
const fieldUi = { root: 'flex flex-col gap-[5px]', label: 'text-[12px] font-semibold text-(--fg)', container: 'mt-0', help: 'text-[11.5px] text-(--muted) mt-0 leading-normal', error: 'text-[11.5px] text-(--err) mt-0', labelWrapper: 'items-baseline' }
const switchUi = {
  root: 'items-start justify-between gap-3 flex-row-reverse',
  base: 'w-[34px] border-[3px] data-[state=unchecked]:bg-(--tile) data-[state=checked]:bg-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)',
  container: 'h-5 mt-px',
  thumb: 'size-3.5 bg-white shadow-none data-[state=checked]:translate-x-3.5',
  wrapper: 'ms-0 flex-1',
  label: 'text-[12px] font-semibold text-(--fg)',
  description: 'text-[11.5px] text-(--muted) mt-0.5 leading-normal'
}
const selectUi = { trailingIcon: 'size-3.5 text-(--muted)', content: 'bg-(--pop-bg) ring-(--bd)', item: 'text-[12.5px]' }
</script>

<template>
  <UCard class="w-[300px] flex-none rounded-[8px] ring-0 border border-(--bd) bg-(--surface) divide-y-0" :ui="{ body: 'p-3.5 sm:p-3.5 flex flex-col gap-3' }">
    <div class="flex items-center gap-2.5">
      <Tile :icon="ext.icon" :tile="ext.tile" :size="28" :icon-size="14" />
      <div class="min-w-0">
        <div class="font-semibold truncate">{{ ext.name }}</div>
        <div class="text-[11.5px] text-(--muted)">Preferences</div>
      </div>
    </div>

    <template v-if="ext.settingsTab">
      <div class="text-[12.5px] text-(--muted) leading-normal">{{ ext.name }} is set up in the Clipboard tab.</div>
      <UButton
        color="neutral"
        variant="outline"
        class="h-8 justify-center rounded-[6px] ring-0 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) text-[12.5px] font-normal"
        @click="emit('openTab', ext.settingsTab!)"
      >
        Open Clipboard settings
      </UButton>
    </template>

    <div v-else-if="!ext.prefs.length" class="text-[12.5px] text-(--muted)">This extension has no preferences.</div>

    <!--
      Errors clear as you type, not on blur: a blur-time update removes the error line and makes the
      Save button jump between mouse-down and mouse-up, swallowing the click.
    -->
    <UForm
      v-else
      :schema="schema"
      :state="state"
      :validate-on="['input']"
      :validate-on-input-delay="0"
      class="flex flex-col gap-3"
      @submit="save"
    >
      <template v-for="f in ext.prefs" :key="`${ext.id}.${f.key}`">
        <UFormField v-if="f.type === 'switch'" :name="f.key">
          <USwitch v-model="(state[f.key] as boolean)" :label="f.label" :description="f.description" :ui="switchUi" />
        </UFormField>

        <UFormField
          v-else
          :name="f.key"
          :label="f.label"
          :required="f.required"
          :help="f.type === 'secret' ? secretHelp(f) : f.description"
          :ui="fieldUi"
        >
          <UInput
            v-if="f.type === 'secret'"
            v-model="(state[f.key] as string)"
            :type="shown[f.key] ? 'text' : 'password'"
            spellcheck="false"
            autocomplete="off"
            variant="none"
            class="w-full"
            :ui="{ base: `${field} pl-2.5 pr-[34px] font-mono text-[12px]`, trailing: 'pe-1' }"
          >
            <template #trailing>
              <UButton
                :icon="shown[f.key] ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="shown[f.key] ? `Hide ${f.label}` : `Show ${f.label}`"
                color="neutral"
                variant="link"
                class="size-6 p-0 justify-center text-(--muted)"
                :ui="{ leadingIcon: 'size-3.5' }"
                @click="shown[f.key] = !shown[f.key]"
              />
            </template>
          </UInput>
          <USelect
            v-else-if="f.type === 'select'"
            v-model="(state[f.key] as string)"
            :items="f.options"
            variant="none"
            :class="`${field} px-2`"
            :ui="selectUi"
          />
          <UTextarea
            v-else-if="f.type === 'folders'"
            v-model="(state[f.key] as string)"
            :placeholder="f.placeholder"
            :rows="3"
            autoresize
            :maxrows="8"
            spellcheck="false"
            autocomplete="off"
            variant="none"
            class="w-full"
            :ui="{ base: 'w-full border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-2.5 py-1.5 font-mono text-[12px] leading-[1.6] resize-none focus-visible:outline-2 focus-visible:outline-(--accent)' }"
          />
          <UInputNumber
            v-else-if="f.type === 'number'"
            v-model="(state[f.key] as number)"
            :min="f.min"
            :max="f.max"
            :increment="false"
            :decrement="false"
            variant="none"
            class="w-full"
            :ui="{ base: `${field} px-2.5 text-left` }"
          />
          <UInput
            v-else
            v-model="(state[f.key] as string)"
            :placeholder="f.placeholder"
            spellcheck="false"
            autocomplete="off"
            variant="none"
            class="w-full"
            :ui="{ base: `${field} px-2.5 ${f.type === 'folder' ? 'font-mono text-[12px]' : ''}` }"
          />
        </UFormField>
      </template>

      <UButton
        type="submit"
        color="primary"
        :disabled="status === 'saving'"
        class="h-8 justify-center rounded-[6px] bg-(--accent) hover:bg-(--accent) disabled:bg-(--accent) text-(--on-accent) font-medium text-[12.5px]"
      >
        <Spinner v-if="status === 'saving'" :size="13" />Save preferences
      </UButton>
      <div v-if="status === 'saved' || status === 'error'" class="-mt-1 flex items-center justify-center gap-1.5 text-[12px]" :class="status === 'saved' ? 'text-(--ok)' : 'text-(--err)'">
        <UIcon :name="status === 'saved' ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="size-3.5" />
        {{ status === 'saved' ? 'Saved' : 'Couldn’t save. Try again.' }}
      </div>
    </UForm>
  </UCard>
</template>

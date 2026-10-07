<script setup lang="ts">
// Settings → Shortcuts: Esky's hotkey, a hotkey and alias for every command and app, and the keys inside the launcher.
import { GROUPS, ITEMS, type Kind } from '~/data/fixtures'
import { LAUNCHER, isGlobal } from '~/composables/useHotkeys'

const hk = useHotkeys()
const exts = useExtensions()
const aliases = useAliases()
const apps = useApps()
onMounted(() => apps.load())

const q = ref('')

/** Commands, quicklinks and so on are always listed; apps only when searched for or already set up (there are 150+). */
const groups = computed(() => {
  void apps.version.value
  const ql = q.value.trim().toLowerCase()
  const ids = Object.keys(ITEMS).filter((id) => {
    const it = ITEMS[id]!
    // Ctrl , only works inside the launcher (listed below), and sample files aren't commands.
    if (id === 'settings' || it.kind === 'file') return false
    if (it.ext && !exts.isActive(it.ext)) return false
    if (ql) return it.title.toLowerCase().includes(ql) || (aliases.value[id] || '').startsWith(ql)
    return it.kind !== 'app' || isGlobal(hk.keysFor(id)) || !!aliases.value[id]
  })
  return GROUPS
    .map(([kind, title]: [Kind, string]) => ({
      title,
      ids: ids.filter(id => ITEMS[id]!.kind === kind).sort((a, b) => ITEMS[a]!.title.localeCompare(ITEMS[b]!.title)).slice(0, kind === 'app' && ql ? 30 : undefined)
    }))
    .filter(g => g.ids.length)
})

const icon = (id: string) => apps.icons.value[id] ?? ITEMS[id]!.icon
const sub = (id: string) => {
  const it = ITEMS[id]!
  return it.kind === 'app' ? 'Application' : it.sub
}

/** Aliases are unique: giving one to this command takes it from any other. */
function setAlias(id: string, value: string) {
  const v = value.trim().toLowerCase()
  if (v === (aliases.value[id] || '')) return
  const a = { ...aliases.value }
  for (const k of Object.keys(a)) if (k !== id && a[k] === v) delete a[k]
  if (v) a[id] = v
  else delete a[id]
  aliases.value = a
}

const LAUNCHER_KEYS: [string, string[]][] = [
  ['Move through results', ['↑', '↓']],
  ['Open the selected result', ['↵']],
  ['Actions for the selected result', ['Ctrl', 'K']],
  ['Back, or hide Esky', ['Esc']],
  ['Chat with Claude (after typing “ai”)', ['Tab']],
  ['Settings', ['Ctrl', ',']]
]

const card = 'flex flex-col border border-(--bd) rounded-[8px] bg-(--surface)'
const aliasInput = 'h-7 w-full border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-2 text-[12px] font-mono placeholder:font-sans placeholder:text-(--faint) focus-visible:outline-2 focus-visible:outline-(--accent)'
</script>

<template>
  <div class="flex flex-col gap-5">
    <div :class="card">
      <div class="px-4 py-3.5 flex items-start gap-4">
        <SettingsRow title="Esky hotkey" desc="Opens and closes the launcher from anywhere." />
        <SettingsHotkeyRecorder :id="LAUNCHER" label="Esky" size="set" />
        <UButton color="neutral" variant="outline" class="h-[34px] px-3 rounded-[6px] ring-0 border border-(--bd) bg-transparent hover:bg-transparent text-(--fg) text-[12.5px] font-normal" @click="hk.reset(LAUNCHER)">
          Reset
        </UButton>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-end gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-[13.5px] font-semibold">Commands and apps</div>
          <div class="text-[12px] text-(--muted) leading-normal mt-0.5">A hotkey runs it from anywhere in Windows, even when Esky is hidden. An alias jumps to it when typed in Esky's search.</div>
        </div>
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Find a command or app"
          variant="none"
          class="w-[220px] flex-none"
          :ui="{ base: 'h-8 border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) text-[12.5px] ps-8 focus-visible:outline-2 focus-visible:outline-(--accent)', leadingIcon: 'size-3.5 text-(--muted)' }"
        />
      </div>
      <div :class="card">
        <div class="h-8 flex items-center gap-3 px-4 border-b border-(--bd) text-[11px] font-semibold tracking-[.04em] text-(--faint)">
          <span class="flex-1">COMMAND</span><span class="w-[120px]">ALIAS</span><span class="w-[162px] text-right">HOTKEY</span>
        </div>
        <template v-for="g in groups" :key="g.title">
          <div class="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-(--muted)">{{ g.title }}</div>
          <div v-for="id in g.ids" :key="id" class="min-h-11 py-1.5 px-4 flex items-start gap-3 border-b border-(--bd) last:border-b-0">
            <Tile :icon="icon(id)" :tile="ITEMS[id]!.tile" :size="26" :icon-size="14" class="mt-px" />
            <div class="flex-1 min-w-0 pt-px">
              <div class="text-[13px] font-medium truncate">{{ ITEMS[id]!.title }}</div>
              <div class="text-[11.5px] text-(--muted) truncate">{{ sub(id) }}</div>
            </div>
            <div class="w-[120px] flex-none">
              <input
                :value="aliases[id] || ''"
                :aria-label="`Alias for ${ITEMS[id]!.title}`"
                placeholder="None"
                spellcheck="false"
                autocomplete="off"
                :class="aliasInput"
                @change="setAlias(id, ($event.target as HTMLInputElement).value)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              >
            </div>
            <div class="w-[162px] flex-none flex justify-end">
              <SettingsHotkeyRecorder :id="id" :label="ITEMS[id]!.title" />
            </div>
          </div>
        </template>
        <div v-if="!groups.length" class="py-8 text-center text-[13px] text-(--muted)">No commands or apps match “{{ q }}”.</div>
      </div>
      <div v-if="!q && apps.status.value === 'ready'" class="text-[12px] text-(--muted)">Search to give any of your {{ apps.list.value.length }} apps a hotkey or alias.</div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="text-[13.5px] font-semibold">Inside the launcher</div>
      <div :class="card">
        <div v-for="([what, ks], j) in LAUNCHER_KEYS" :key="what" class="h-10 px-4 flex items-center gap-3" :class="j < LAUNCHER_KEYS.length - 1 ? 'border-b border-(--bd)' : ''">
          <span class="flex-1 text-[13px]">{{ what }}</span>
          <Keys :keys="ks" size="sm" />
        </div>
      </div>
    </div>
  </div>
</template>

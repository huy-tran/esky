<script setup lang="ts">
// Records a system-wide hotkey for one command (or, with id "launcher", Esky's own).
// Click or Enter to record, then press the combination. Esc cancels, Backspace removes it.
import { ITEMS } from '~/data/fixtures'
import { LAUNCHER, isGlobal } from '~/composables/useHotkeys'
import { comboOf } from '~/utils/text'

const props = withDefaults(defineProps<{ id: string, label: string, size?: 'sm' | 'set' }>(), { size: 'sm' })

const hk = useHotkeys()
const recording = ref(false)
const error = ref('')
/** A combination that needs a yes first: it belongs to another command, or Windows uses it. */
const pending = ref<{ combo: string[], message: string, confirm: string } | null>(null)

const keys = computed(() => {
  const k = hk.keysFor(props.id)
  return isGlobal(k) ? k : []
})
const removable = computed(() => props.id !== LAUNCHER && keys.value.length > 0)

function start() {
  recording.value = true
  error.value = ''
  pending.value = null
}

function clear() {
  hk.assign(props.id, [])
  pending.value = null
}

function onKey(e: KeyboardEvent) {
  if (!recording.value) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      start()
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && removable.value) {
      e.preventDefault()
      clear()
    }
    return
  }
  e.preventDefault()
  e.stopPropagation()
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) return
  const plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
  if (plain && e.key === 'Escape') {
    recording.value = false
    error.value = ''
    return
  }
  if (plain && (e.key === 'Backspace' || e.key === 'Delete') && props.id !== LAUNCHER) {
    recording.value = false
    clear()
    return
  }
  const combo = comboOf(e)
  const c = hk.check(combo, props.id)
  if (c.error) {
    error.value = c.error
    return
  }
  recording.value = false
  error.value = ''
  if (c.ownerId || c.warning) {
    pending.value = c.ownerId
      ? { combo, message: `${combo.join(' + ')} is used by ${ITEMS[c.ownerId]?.title ?? 'another command'}.`, confirm: 'Move it here' }
      : { combo, message: `${combo.join(' + ')}: ${c.warning} Esky would take it over.`, confirm: 'Use anyway' }
    return
  }
  hk.assign(props.id, combo)
}

function confirmPending() {
  if (pending.value) hk.assign(props.id, pending.value.combo)
  pending.value = null
}

const tall = computed(() => props.size === 'set')
</script>

<template>
  <div class="flex flex-col items-end gap-1">
    <div class="flex items-center gap-1">
      <UButton
        color="neutral"
        variant="outline"
        :aria-label="`Hotkey for ${label}`"
        class="justify-center gap-1 px-2 rounded-[6px] ring-0 border bg-(--input-bg) hover:bg-(--input-bg) focus-visible:outline-none"
        :class="tall ? 'min-w-[180px] h-[34px]' : 'min-w-[132px] h-7'"
        :style="{ borderColor: recording ? 'var(--accent)' : error || pending ? 'var(--warn)' : 'var(--bd)', boxShadow: recording ? '0 0 0 3px var(--accent-soft)' : 'none' }"
        @click="start"
        @keydown="onKey"
        @blur="recording = false"
      >
        <span v-if="recording" class="text-[12px] text-(--accent-fg) animate-[lp-pulse_1.2s_infinite]">Press keys…</span>
        <Keys v-else-if="keys.length" :keys="keys" :size="size" />
        <span v-else class="text-[12px] text-(--faint)">Record hotkey</span>
      </UButton>
      <UButton
        v-if="removable"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        :title="`Remove the hotkey for ${label}`"
        class="size-6 p-0 justify-center rounded-[5px] text-(--muted)"
        :ui="{ leadingIcon: 'size-3.5' }"
        @click="clear"
      />
    </div>
    <div v-if="recording && !error" class="text-[11.5px] text-(--muted)">Esc cancels{{ id !== LAUNCHER ? ', Backspace removes' : '' }}</div>
    <div v-if="error" class="text-[11.5px] text-(--err) text-right max-w-[260px]">{{ error }}</div>
    <div v-if="pending" class="flex items-center gap-2 text-[11.5px] text-right max-w-[340px]">
      <span class="text-(--fg)">{{ pending.message }}</span>
      <UButton size="xs" color="neutral" variant="outline" class="h-6 px-2 rounded-[5px] ring-0 border border-(--bd) text-[11.5px] flex-none" @click="confirmPending">{{ pending.confirm }}</UButton>
      <UButton size="xs" color="neutral" variant="ghost" class="h-6 px-1.5 text-[11.5px] text-(--muted) flex-none" @click="pending = null">Cancel</UButton>
    </div>
  </div>
</template>

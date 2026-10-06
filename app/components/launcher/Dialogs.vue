<script setup lang="ts">
import { ITEMS } from '~/data/fixtures'

const L = useLauncher()
const s = L.s

// Hotkey recorder
const hk = computed(() => {
  const h = s.hk
  const cur = h?.id ? (L.rowKeys(h.id) || []) : []
  return {
    bd: h?.reserved ? 'var(--err)' : h?.conflict ? 'var(--warn)' : h?.combo ? 'var(--accent)' : 'var(--kbd-bd)',
    cfBg: h?.reserved ? 'var(--err-soft)' : 'var(--warn-soft)',
    cfFg: h?.reserved ? 'var(--err)' : 'var(--warn)',
    note: h?.note || (cur.length ? `Current: ${cur.join(' + ')} · Backspace clears` : 'No hotkey set yet'),
    canSave: !!h?.combo && !h?.reserved
  }
})

// Alias editor
const alInput = ref<{ inputRef?: HTMLInputElement | null } | null>(null)
watchEffect(() => {
  L.els.al = alInput.value?.inputRef ?? null
})
const alValue = computed({
  get: () => s.al?.value ?? '',
  set: (v: string) => {
    if (s.al) s.al = { ...s.al, value: v.replace(/\s/g, '') }
  }
})
const alConflict = computed(() => {
  const al = s.al
  const owner = al?.value ? L.aliasOwner(al.value.trim().toLowerCase(), al.id) : null
  return owner ? `“${al!.value.trim()}” is already the alias for ${ITEMS[owner]!.title}. Saving moves it here.` : ''
})

// Agent approval
const approvalBtns = computed(() => ([['Allow once', ['↵']], ['Always allow', ['Ctrl', '↵']], ['Deny', ['Esc']]] as [string, string[]][]).map(([label, keys], i) => {
  const primary = i === 0
  return {
    label,
    keys,
    primary,
    style: {
      background: primary ? 'var(--accent)' : 'var(--surface)',
      color: primary ? 'var(--on-accent)' : i === 2 ? 'var(--err)' : 'var(--fg)',
      borderColor: primary ? 'transparent' : 'var(--bd)',
      boxShadow: i === s.approvalSel ? '0 0 0 2px var(--pop-bg),0 0 0 4px var(--accent)' : 'none'
    }
  }
}))

const btn = 'h-8 gap-[7px] rounded-[6px] text-[13px] ring-0'
const secondary = `${btn} pl-2.5 pr-2 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) font-medium`
const primaryBtn = `${btn} pl-3 pr-2 bg-(--accent) hover:bg-(--accent) text-(--on-accent) font-semibold`
</script>

<template>
  <!-- Agent approval -->
  <LauncherDialog :open="!!s.approval" width-class="w-[458px]" title="Claude wants to run">
    <div class="flex items-center gap-2.5">
      <div class="size-8 rounded-[6px] bg-(--warn-soft) text-(--warn) grid place-items-center"><UIcon name="i-lucide-square-terminal" class="size-4" /></div>
      <div>
        <div class="text-[14.5px] font-semibold">Claude wants to run:</div>
        <div class="text-[12px] text-(--muted) mt-0.5">Agent mode · in {{ s.approval?.cwd }}</div>
      </div>
    </div>
    <div class="font-mono text-[14px] px-3 py-2.5 rounded-[6px] bg-(--code-bg) border border-(--bd)">{{ s.approval?.cmd }}</div>
    <div class="flex gap-2">
      <UButton
        v-for="(ab, i) in approvalBtns"
        :key="ab.label"
        tabindex="-1"
        class="flex-1 h-[34px] justify-center gap-[7px] rounded-[6px] border text-[13px] font-medium ring-0"
        :style="ab.style"
        @click="L.approve(i)"
      >
        {{ ab.label }}<Keys :keys="ab.keys" :size="ab.primary ? 'accent' : 'inherit'" />
      </UButton>
    </div>
  </LauncherDialog>

  <!-- Hotkey recorder -->
  <LauncherDialog :open="!!s.hk" title="Record hotkey">
    <div class="flex items-center gap-2.5">
      <div class="size-8 rounded-[6px] bg-(--accent-soft) text-(--accent-fg) grid place-items-center"><UIcon name="i-lucide-keyboard" class="size-4" /></div>
      <div>
        <div class="text-[14.5px] font-semibold">Record hotkey</div>
        <div class="text-[12px] text-(--muted) mt-0.5">{{ s.hk?.title }}</div>
      </div>
    </div>
    <div class="h-16 rounded-[8px] border-[1.5px] border-dashed flex items-center justify-center gap-1.5" :style="{ borderColor: hk.bd }">
      <Keys v-if="s.hk?.combo" :keys="s.hk.combo" size="rec" />
      <span v-else class="text-[13px] text-(--muted)">Press a key combination…</span>
    </div>
    <UAlert
      v-if="s.hk?.conflict"
      icon="i-lucide-triangle-alert"
      :description="s.hk.conflict"
      class="flex gap-2 items-start px-2.5 py-2 rounded-[6px] ring-0"
      :style="{ background: hk.cfBg, color: hk.cfFg }"
      :ui="{ icon: 'size-3.5 mt-px', description: 'text-[12.5px] leading-[1.45] text-inherit opacity-100', wrapper: 'min-w-0' }"
    />
    <div class="text-[12px] text-(--muted)">{{ hk.note }}</div>
    <div class="flex gap-2">
      <UButton tabindex="-1" :class="`${secondary} px-2.5 text-(--err)`" @click="L.clearHk()">Remove</UButton>
      <span class="flex-1" />
      <UButton tabindex="-1" :class="secondary" @click="s.hk = null">Cancel<Keys :keys="['Esc']" size="btn" /></UButton>
      <UButton tabindex="-1" :class="primaryBtn" :style="{ opacity: hk.canSave ? 1 : 0.5 }" @click="L.saveHk()">Save<Keys :keys="['↵']" size="accent" /></UButton>
    </div>
  </LauncherDialog>

  <!-- Alias -->
  <LauncherDialog :open="!!s.al" title="Alias">
    <div class="flex items-center gap-2.5">
      <div class="size-8 rounded-[6px] bg-(--accent-soft) text-(--accent-fg) grid place-items-center"><UIcon name="i-lucide-at-sign" class="size-4" /></div>
      <div>
        <div class="text-[14.5px] font-semibold">Alias</div>
        <div class="text-[12px] text-(--muted) mt-0.5">{{ s.al?.title }}</div>
      </div>
    </div>
    <UInput
      ref="alInput"
      v-model="alValue"
      placeholder="e.g. fig"
      spellcheck="false"
      autocomplete="off"
      variant="none"
      autofocus
      :ui="{ base: 'h-[38px] border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-3 text-[15px] font-mono focus-visible:outline-2 focus-visible:outline-(--accent)' }"
    />
    <UAlert
      v-if="alConflict"
      icon="i-lucide-triangle-alert"
      :description="alConflict"
      class="flex gap-2 items-start px-2.5 py-2 rounded-[6px] ring-0 bg-(--warn-soft) text-(--warn)"
      :ui="{ icon: 'size-3.5 mt-px', description: 'text-[12.5px] leading-[1.45] text-inherit opacity-100', wrapper: 'min-w-0' }"
    />
    <div class="text-[12px] text-(--muted)">Type the alias in root search to jump straight to this result. Leave empty to remove it.</div>
    <div class="flex gap-2 justify-end">
      <UButton tabindex="-1" :class="secondary" @click="s.al = null">Cancel<Keys :keys="['Esc']" size="btn" /></UButton>
      <UButton tabindex="-1" :class="primaryBtn" @click="L.saveAl()">Save<Keys :keys="['↵']" size="accent" /></UButton>
    </div>
  </LauncherDialog>

  <!-- Confirm (system commands, uninstall) -->
  <LauncherDialog :open="!!s.confirm" width-class="w-[418px]" :title="s.confirm?.title">
    <div class="flex items-start gap-2.5">
      <div class="size-8 flex-none rounded-[6px] bg-(--err-soft) text-(--err) grid place-items-center"><UIcon name="i-lucide-triangle-alert" class="size-4" /></div>
      <div>
        <div class="text-[14.5px] font-semibold">{{ s.confirm?.title }}</div>
        <div class="text-[12.5px] text-(--muted) mt-[3px] leading-[1.45]">{{ s.confirm?.desc }}</div>
      </div>
    </div>
    <div class="flex gap-2 justify-end">
      <UButton tabindex="-1" :class="secondary" @click="s.confirm = null">Cancel<Keys :keys="['Esc']" size="btn" /></UButton>
      <UButton tabindex="-1" :class="`${btn} pl-3 pr-2 bg-(--err) hover:bg-(--err) text-white font-semibold`" @click="L.cfOk()">{{ s.confirm?.label }}<Keys :keys="['↵']" size="danger" /></UButton>
    </div>
  </LauncherDialog>
</template>

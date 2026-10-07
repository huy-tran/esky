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

const btn = 'h-8 gap-[7px] rounded-[6px] text-[13px] ring-0'
const secondary = `${btn} pl-2.5 pr-2 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) font-medium`
const primaryBtn = `${btn} pl-3 pr-2 bg-(--accent) hover:bg-(--accent) text-(--on-accent) font-semibold`
</script>

<template>
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

  <!-- Snippet arguments -->
  <LauncherDialog :open="!!s.snArgs" width-class="w-[440px]" title="Snippet values">
    <div class="flex items-center gap-2.5">
      <div class="size-8 rounded-[6px] bg-(--accent-soft) text-(--accent-fg) grid place-items-center"><UIcon name="i-lucide-text-quote" class="size-4" /></div>
      <div class="min-w-0">
        <div class="text-[14.5px] font-semibold">Fill in the snippet</div>
        <div class="text-[12px] text-(--muted) mt-0.5 truncate">{{ s.snArgs?.name }}</div>
      </div>
    </div>
    <template v-if="s.snArgs">
      <UFormField v-for="(f, i) in s.snArgs.fields" :key="f.name" :label="f.name" :ui="{ root: 'flex flex-col gap-[5px]', label: 'text-[12px] font-semibold text-(--fg)', container: 'mt-0' }">
        <UInput
          v-model="f.value"
          spellcheck="false"
          autocomplete="off"
          variant="none"
          :autofocus="i === 0"
          class="w-full"
          :ui="{ base: 'h-[36px] border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-3 text-[14px] focus-visible:outline-2 focus-visible:outline-(--accent)' }"
        />
      </UFormField>
    </template>
    <div class="flex gap-2 justify-end">
      <UButton tabindex="-1" :class="secondary" @click="s.snArgs = null">Cancel<Keys :keys="['Esc']" size="btn" /></UButton>
      <UButton tabindex="-1" :class="primaryBtn" @click="L.submitArgs()">{{ s.snArgs?.mode === 'copy' ? 'Copy' : s.target ? `Paste into ${s.target.app}` : 'Copy' }}<Keys :keys="['↵']" size="accent" /></UButton>
    </div>
  </LauncherDialog>

  <!-- Jira: Log Work -->
  <LauncherDialog :open="!!s.logWork" width-class="w-[440px]" title="Log work">
    <div class="flex items-center gap-2.5">
      <div class="size-8 rounded-[6px] bg-(--accent-soft) text-(--accent-fg) grid place-items-center"><UIcon name="i-lucide-timer" class="size-4" /></div>
      <div class="min-w-0">
        <div class="text-[14.5px] font-semibold">Log work</div>
        <div class="text-[12px] text-(--muted) mt-0.5 truncate">{{ s.logWork?.title }}</div>
      </div>
    </div>
    <template v-if="s.logWork">
      <UInput
        v-model="s.logWork.time"
        placeholder="Time spent, e.g. 1h 30m"
        spellcheck="false"
        autocomplete="off"
        variant="none"
        autofocus
        :ui="{ base: 'h-[38px] border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-3 text-[14px] font-mono focus-visible:outline-2 focus-visible:outline-(--accent)' }"
      />
      <UTextarea
        v-model="s.logWork.comment"
        placeholder="What you worked on (optional)"
        :rows="3"
        variant="none"
        :ui="{ base: 'border border-(--bd) rounded-[6px] bg-(--input-bg) text-(--fg) px-3 py-2 text-[13px] resize-none focus-visible:outline-2 focus-visible:outline-(--accent)' }"
      />
      <div v-if="s.logWork.error" class="text-[12.5px] text-(--err)">{{ s.logWork.error }}</div>
    </template>
    <div class="flex gap-2 justify-end">
      <UButton tabindex="-1" :class="secondary" @click="s.logWork = null">Cancel<Keys :keys="['Esc']" size="btn" /></UButton>
      <UButton tabindex="-1" :class="primaryBtn" :disabled="s.logWork?.busy" @click="L.submitLogWork()"><Spinner v-if="s.logWork?.busy" :size="13" />Log<Keys :keys="['↵']" size="accent" /></UButton>
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

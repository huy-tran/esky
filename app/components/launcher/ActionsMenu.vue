<script setup lang="ts">
// Ctrl K menu: anchored bottom-right above the footer, filter input at the bottom, background dimmed.
const L = useLauncher()
const s = L.s
const model = computed(() => L.actionsModel.value)
const input = ref<{ inputRef?: HTMLInputElement | null } | null>(null)

watchEffect(() => {
  L.els.act = input.value?.inputRef ?? null
})
onBeforeUnmount(() => {
  L.els.act = null
})

const hover = (i: number) => {
  if (s.actionsSel !== i) s.actionsSel = i
}
</script>

<template>
  <div class="absolute inset-0 bg-(--dim)" @mousedown="s.actionsOpen = false" />
  <div role="menu" class="absolute right-2 bottom-2 w-[330px] rounded-[8px] border border-(--win-bd) bg-(--pop-bg) shadow-[0_16px_40px_rgba(0,0,0,.35)] overflow-hidden animate-[lp-in_.12s_ease-out]">
    <div class="pt-2 px-3 pb-1.5 text-[11px] font-semibold tracking-[.04em] text-(--faint) whitespace-nowrap overflow-hidden text-ellipsis">
      {{ model.target ? `Actions · ${model.target}` : 'Actions' }}
    </div>
    <div class="py-0.5 px-1.5">
      <div
        v-for="(a, i) in model.list"
        :key="a.id"
        role="menuitem"
        :data-sel="String(i === s.actionsSel)"
        class="h-9 flex items-center gap-2.5 px-2 rounded-[6px] cursor-default"
        :class="[i === s.actionsSel ? 'bg-(--sel)' : 'bg-transparent', a.danger ? 'text-(--err)' : 'text-(--fg)']"
        @click="L.runAction(a.id)"
        @mousemove="hover(i)"
      >
        <span class="w-[18px] flex justify-center"><UIcon :name="a.icon" class="size-[15px]" /></span>
        <span class="flex-1 text-[13px]">{{ a.title }}</span>
        <Keys :keys="a.keys" size="sm" />
      </div>
      <div v-if="!model.list.length" class="py-3.5 px-2 text-[12.5px] text-(--muted)">No matching actions</div>
    </div>
    <div class="h-10 flex items-center gap-2 px-3 border-t border-(--bd) mt-1">
      <UIcon name="i-lucide-search" class="size-3.5 text-(--muted)" />
      <UInput
        ref="input"
        v-model="s.actionsQuery"
        placeholder="Search actions…"
        variant="none"
        class="flex-1"
        :ui="{ base: 'p-0 text-[13px] text-(--fg) placeholder:text-(--faint)' }"
        @update:model-value="s.actionsSel = 0"
      />
    </div>
  </div>
</template>

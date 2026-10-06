<script setup lang="ts">
const L = useLauncher()
const s = L.s
</script>

<template>
  <div class="h-[52px] flex-none flex items-center gap-2.5 px-3 border-b border-(--bd)">
    <UButton tabindex="-1" title="Back (Esc)" icon="i-lucide-arrow-left" color="neutral" variant="ghost" class="size-7 flex-none p-0 justify-center rounded-[6px] bg-(--tile) hover:bg-(--tile) text-(--fg)" :ui="{ leadingIcon: 'size-[15px]' }" @click="L.back()" />
    <UButton
      tabindex="-1"
      title="Chats (Ctrl B)"
      icon="i-lucide-panel-left"
      color="neutral"
      variant="ghost"
      class="size-7 flex-none p-0 justify-center rounded-[6px] text-(--fg)"
      :class="s.showChats ? 'bg-(--sel) hover:bg-(--sel)' : 'bg-(--tile) hover:bg-(--tile)'"
      :ui="{ leadingIcon: 'size-[15px]' }"
      @click="s.showChats = !s.showChats"
    />
    <div class="text-[14px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis min-w-0">{{ s.chatTitle }}</div>
    <UBadge icon="i-lucide-sparkles" label="Claude" class="flex-none h-[22px] gap-[5px] px-2 rounded-[6px] bg-(--accent-soft) text-(--accent-fg) text-[11.5px] font-semibold ring-0" :ui="{ leadingIcon: 'size-3' }" />
    <span class="flex-1" />
    <UButton
      tabindex="-1"
      icon="i-lucide-square-pen"
      label="New chat"
      color="neutral"
      variant="outline"
      class="flex-none h-7 gap-[7px] pl-2.5 pr-1.5 rounded-[6px] ring-0 border border-(--bd) bg-(--surface) hover:bg-(--surface) text-(--fg) text-[12.5px] font-medium"
      :ui="{ leadingIcon: 'size-[13px]' }"
      @click="L.newChat()"
    >
      <template #trailing>
        <Keys :keys="['Ctrl', 'N']" size="chat" />
      </template>
    </UButton>
  </div>
</template>

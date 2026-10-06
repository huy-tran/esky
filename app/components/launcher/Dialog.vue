<script setup lang="ts">
// UModal skinned like the prototype's in-window dialogs. Keys are handled by the launcher key map.
withDefaults(defineProps<{ open: boolean, widthClass?: string, title?: string }>(), { widthClass: 'w-[438px]', title: 'Dialog' })
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :dismissible="false"
    :close="false"
    :transition="false"
    portal="#esky-window"
    :content="{ onOpenAutoFocus: (e: Event) => e.preventDefault(), onCloseAutoFocus: (e: Event) => e.preventDefault() }"
    :class="widthClass"
    :ui="{
      overlay: 'fixed inset-0 bg-(--overlay) backdrop-blur-[2px]',
      content: 'rounded-[8px] ring-0 border border-(--win-bd) bg-(--pop-bg) shadow-[0_20px_50px_rgba(0,0,0,.4)] divide-y-0 p-[18px] flex flex-col gap-3.5 animate-[lp-in_.14s_ease-out] max-w-none max-h-none'
    }"
  >
    <template #content>
      <slot />
    </template>
  </UModal>
</template>

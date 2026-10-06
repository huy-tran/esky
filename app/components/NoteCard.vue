<script setup lang="ts">
// The floating note: small always-on-top card with a title bar and an editable body.
defineProps<{ body: string }>()
defineEmits<{ 'update:body': [string], 'close': [] }>()
</script>

<template>
  <div class="w-[250px] rounded-[8px] border border-(--win-bd) bg-(--pop-bg) shadow-(--shadow) overflow-hidden lp-in">
    <div class="h-8 flex items-center gap-2 pr-1 pl-2.5 border-b border-(--bd) bg-(--warn-soft)" data-tauri-drag-region>
      <UIcon name="i-lucide-sticky-note" class="size-[13px] text-(--warn)" />
      <span class="flex-1 min-w-0 text-[12px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis" data-tauri-drag-region>{{ body.split('\n')[0] || 'Untitled note' }}</span>
      <UButton
        tabindex="-1"
        title="Stop floating"
        icon="i-lucide-x"
        color="neutral"
        variant="link"
        class="size-6 p-0 justify-center text-(--muted)"
        :ui="{ leadingIcon: 'size-[13px]' }"
        @click="$emit('close')"
      />
    </div>
    <textarea
      data-float="true"
      :value="body"
      class="block w-full box-border h-40 border-0 outline-none bg-transparent resize-none px-3 py-2.5 text-[12.5px] leading-[1.55] text-(--fg)"
      @input="$emit('update:body', ($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

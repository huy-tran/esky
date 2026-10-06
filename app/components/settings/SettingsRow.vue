<script setup lang="ts">
defineProps<{ title: string, desc?: string }>()
</script>

<template>
  <div class="flex-1">
    <div class="font-medium">{{ title }}</div>
    <div v-if="desc" class="text-[12px] text-(--muted) mt-0.5">{{ desc }}</div>
  </div>
</template>

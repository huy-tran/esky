<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 14 })
</script>

<template>
  <UIcon name="i-lucide-loader-circle" class="inline-block animate-[lp-spin_.8s_linear_infinite]" :style="{ width: `${size}px`, height: `${size}px` }" />
</template>

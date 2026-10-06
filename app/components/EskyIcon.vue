<script setup lang="ts">
defineProps<{ size?: number }>()
</script>

<template>
  <svg :width="size ?? 44" :height="size ?? 44" viewBox="0 0 100 100" class="flex-none" aria-hidden="true">
    <rect width="100" height="100" rx="22" fill="#22C55E" />
    <g transform="translate(18 18)">
      <rect x="8" y="8" width="48" height="12" rx="4" fill="#F8FAFC" />
      <rect x="8" y="23" width="48" height="33" rx="6" fill="#0F172A" />
      <path d="M19 32l8 7-8 7" fill="none" stroke="#4ADE80" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M32 46h12" stroke="#4ADE80" stroke-width="4.5" stroke-linecap="round" />
    </g>
  </svg>
</template>

<script setup lang="ts">
// Rounded icon tile used by rows, footers and headers.
const props = withDefaults(defineProps<{ icon: string, tile?: string, size?: number, iconSize?: number, radius?: number }>(), { size: 32, iconSize: 17, radius: 6 })

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${props.radius}px`,
  background: props.tile || 'var(--tile)',
  color: props.tile === 'var(--accent)' ? 'var(--on-accent)' : props.tile ? '#fff' : 'var(--fg)'
}))
</script>

<template>
  <div class="flex-none grid place-items-center" :style="style">
    <UIcon :name="icon" :style="{ width: `${iconSize}px`, height: `${iconSize}px` }" />
  </div>
</template>

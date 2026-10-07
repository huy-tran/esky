<script setup lang="ts">
// Rounded icon tile used by rows, footers and headers. An `icon` that is an image data URL (an app's own icon) is shown as is.
const props = withDefaults(defineProps<{ icon: string, tile?: string, size?: number, iconSize?: number, radius?: number }>(), { size: 32, iconSize: 17, radius: 6 })

const image = computed(() => props.icon.startsWith('data:image/'))

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${props.radius}px`,
  background: image.value ? 'transparent' : props.tile || 'var(--tile)',
  color: props.tile === 'var(--accent)' ? 'var(--on-accent)' : props.tile ? '#fff' : 'var(--fg)'
}))
</script>

<template>
  <div class="flex-none grid place-items-center" :style="style">
    <img v-if="image" :src="icon" alt="" draggable="false" class="size-full object-contain">
    <UIcon v-else :name="icon" :style="{ width: `${iconSize}px`, height: `${iconSize}px` }" />
  </div>
</template>

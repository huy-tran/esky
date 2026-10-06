<script setup lang="ts">
import { segs } from '~/utils/text'

const props = defineProps<{ text: string, q?: string }>()
const parts = computed(() => segs(props.text, props.q))
</script>

<template>
  <template v-for="(p, i) in parts" :key="i">
    <span v-if="p.hl" class="text-(--accent-fg) font-bold">{{ p.t }}</span>
    <span v-else>{{ p.t }}</span>
  </template>
</template>

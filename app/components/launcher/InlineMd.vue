<script setup lang="ts">
import { inl } from '~/utils/text'

const props = defineProps<{ text: string }>()
const parts = computed(() => inl(props.text))
</script>

<template>
  <template v-for="(p, i) in parts" :key="i">
    <code v-if="p.code" class="font-mono text-[12px] bg-(--tile) px-[5px] py-px rounded-[4px]">{{ p.t }}</code>
    <strong v-else-if="p.bold" class="font-semibold">{{ p.t }}</strong>
    <span v-else>{{ p.t }}</span>
  </template>
</template>

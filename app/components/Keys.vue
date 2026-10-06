<script setup lang="ts">
// A group of UKbd keys. Sizes match the prototype's key caps.
type Size = 'md' | 'sm' | 'btn' | 'inherit' | 'accent' | 'danger' | 'rec' | 'onb' | 'set' | 'chat'

const props = withDefaults(defineProps<{ keys: string[], size?: Size }>(), { size: 'md' })

const SIZES: Record<Size, string> = {
  md: 'min-w-5 h-5 px-[5px] rounded-[5px] bg-(--kbd-bg) ring-0 border border-(--kbd-bd) border-b-2 text-(--muted) text-[11px] font-medium',
  sm: 'min-w-[18px] h-[18px] px-1 rounded-[4px] bg-(--kbd-bg) ring-0 border border-(--kbd-bd) text-(--muted) text-[10.5px] font-normal',
  chat: 'min-w-[18px] h-[18px] px-1 rounded-[4px] bg-(--kbd-bg) ring-0 border border-(--kbd-bd) text-(--muted) text-[10.5px] font-normal',
  btn: 'min-w-0 h-[18px] px-1 rounded-[4px] bg-(--kbd-bg) ring-0 text-(--muted) text-[10.5px] font-normal',
  inherit: 'min-w-0 h-[18px] px-1 rounded-[4px] bg-(--kbd-bg) ring-0 text-inherit text-[10.5px] font-normal',
  accent: 'min-w-0 h-[18px] px-1 rounded-[4px] bg-[rgba(255,255,255,.18)] ring-0 text-inherit text-[10.5px] font-normal',
  danger: 'min-w-0 h-[18px] px-1 rounded-[4px] bg-[rgba(255,255,255,.2)] ring-0 text-inherit text-[10.5px] font-normal',
  rec: 'min-w-8 h-8 px-2.5 rounded-[6px] bg-(--kbd-bg) ring-0 border border-(--kbd-bd) border-b-3 text-(--fg) text-[14px] font-semibold',
  onb: 'min-w-7 h-7 px-2 rounded-[6px] bg-(--kbd-bg) ring-0 border border-(--kbd-bd) border-b-2 text-(--fg) text-[12.5px] font-semibold',
  set: 'min-w-[22px] h-[22px] px-[7px] rounded-[5px] bg-(--kbd-bg) ring-0 border border-(--kbd-bd) border-b-2 text-(--fg) text-[12px] font-medium'
}

const gap = computed(() => (props.size === 'onb' || props.size === 'set' || props.size === 'rec') ? (props.size === 'rec' ? 'gap-1.5' : 'gap-1') : 'gap-[3px]')
</script>

<template>
  <span class="flex flex-none" :class="gap">
    <UKbd v-for="(k, i) in keys" :key="i" class="box-border leading-none" :class="SIZES[size]">{{ k }}</UKbd>
  </span>
</template>

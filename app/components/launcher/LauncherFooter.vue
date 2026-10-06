<script setup lang="ts">
const L = useLauncher()
const f = computed(() => L.footer.value)
</script>

<template>
  <div class="h-10 flex-none flex items-center gap-3 pr-3 pl-3.5 border-t border-(--bd) bg-(--footer-bg)">
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <EskyIcon v-if="f.app.icon === 'esky'" :size="20" />
      <Tile v-else :icon="f.app.icon" :tile="f.app.tile" :size="20" :icon-size="11" />
      <span class="text-[12px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{{ f.app.name }}</span>
    </div>
    <div class="flex items-center gap-3.5 flex-none">
      <div v-for="h in f.hints" :key="h.label" class="flex items-center gap-1.5 cursor-default" @click="h.run()">
        <span class="text-[12px]" :class="h.primary ? 'text-(--fg) font-medium' : 'text-(--muted) font-normal'">{{ h.label }}</span>
        <Keys :keys="h.keys" />
      </div>
    </div>
  </div>
</template>

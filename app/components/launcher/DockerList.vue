<script setup lang="ts">
const L = useLauncher()
const s = L.s
const docker = L.docker
const box = ref<HTMLElement | null>(null)

const rows = computed(() => L.dockerModel.value)
const sel = computed(() => Math.min(s.dockerSel, Math.max(0, rows.value.length - 1)))
const icon = computed(() => ({ containers: 'i-lucide-box', compose: 'i-lucide-layers', images: 'i-lucide-disc' })[docker.kind.value])

const pick = (i: number) => {
  s.dockerSel = i
}

useKeepVisible(box, () => [s.dockerSel, s.dockerQuery])
</script>

<template>
  <div v-if="docker.status.value === 'error'" class="h-full flex flex-col items-center justify-center gap-2.5 text-center px-10">
    <Tile icon="i-lucide-container" tile="#0284C7" :size="48" :icon-size="22" :radius="8" />
    <div class="text-[15px] font-semibold">Can’t reach Docker</div>
    <div class="text-[13px] text-(--muted) max-w-[380px] leading-normal">{{ docker.error.value }}</div>
    <div class="flex items-center gap-1.5 mt-1 text-[12px] text-(--muted)">Try again <Keys :keys="['Ctrl', 'R']" /></div>
  </div>
  <div v-else-if="docker.status.value === 'loading' && !docker.rows.value.length" class="h-full flex items-center justify-center gap-2 text-[13px] text-(--muted)">
    <Spinner />Asking Docker…
  </div>
  <div v-else ref="box" class="relative h-full overflow-y-auto px-2 pt-1 pb-2 box-border scroll-thin">
    <div
      v-for="(r, i) in rows"
      :key="r.id"
      :data-sel="String(i === sel)"
      class="h-11 flex items-center gap-3 px-2.5 rounded-[6px] cursor-default"
      :class="i === sel ? 'bg-(--sel)' : 'bg-transparent'"
      @click="pick(i)"
      @dblclick="pick(i); L.runAction('dprimary')"
    >
      <Tile :icon="icon" :tile="r.running === false ? undefined : '#0284C7'" :icon-size="16" />
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <span class="text-[13.5px] font-medium truncate">{{ r.title }}</span>
        <span class="text-(--muted) text-[11.5px] truncate">{{ r.sub }}</span>
      </div>
      <UBadge
        v-if="r.running !== undefined"
        :label="r.state"
        class="flex-none h-5 px-[7px] rounded-[5px] text-[11px] font-semibold ring-0"
        :style="r.running ? { color: 'var(--ok)', background: 'var(--ok-soft)' } : { color: 'var(--muted)', background: 'var(--tile)' }"
      />
      <span v-else class="flex-none text-[12px] text-(--muted)">{{ r.state }}</span>
    </div>
    <div v-if="!rows.length" class="py-10 px-3 text-center text-[13px] text-(--muted)">
      {{ s.dockerQuery ? 'No matches' : docker.kind.value === 'containers' ? 'No running containers (stopped ones can be shown in the Docker settings)' : 'Nothing here yet' }}
    </div>
  </div>
</template>

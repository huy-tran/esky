<script setup lang="ts">
import { STATUS } from '~/data/fixtures'

const L = useLauncher()
const forge = L.forge
const sv = computed(() => L.s.server!)
const sites = computed(() => forge.sites.value[sv.value.id])
const deployments = computed(() => forge.deployments.value[sv.value.id] ?? [])

const when = (iso: string) => iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
const tone = (status: string) => /finished|deployed/.test(status) ? 'var(--ok)' : /fail|cancel/.test(status) ? 'var(--err)' : 'var(--warn)'

const meta = computed(() => [
  { k: 'Status', v: STATUS[sv.value.status][0], dot: STATUS[sv.value.status][1] },
  { k: 'IP address', v: sv.value.ip, mono: true },
  { k: 'Provider', v: sv.value.provider },
  { k: 'Region', v: sv.value.region },
  { k: 'Size', v: sv.value.size },
  { k: 'PHP', v: sv.value.php || 'None' },
  { k: 'SSH', v: `forge@${sv.value.ip}${sv.value.sshPort !== 22 ? ` -p ${sv.value.sshPort}` : ''}`, mono: true }
])
</script>

<template>
  <div class="flex h-full">
    <div class="flex-1 min-w-0 overflow-y-auto py-4 px-[22px] flex flex-col gap-2 text-[13.5px] leading-[1.6]">
      <div class="text-[20px] font-semibold tracking-[-.01em]">{{ sv.name }}</div>
      <div class="text-(--muted)">{{ sv.ubuntu }} server on {{ sv.provider }}{{ sv.size ? ` (${sv.size})` : '' }}, managed by Laravel Forge.</div>

      <div class="text-[12px] font-semibold tracking-[.04em] text-(--faint) mt-2">SITES</div>
      <div v-if="!sites" class="flex items-center gap-2 text-(--muted)"><Spinner :size="12" />Loading…</div>
      <div v-else-if="!sites.length" class="text-(--muted)">No sites yet.</div>
      <div v-for="x in sites" :key="x.id" class="flex items-center gap-2 min-w-0">
        <span class="size-2 flex-none rounded-full" :style="{ background: tone(x.status) }" :title="x.status" />
        <span class="font-mono text-[12.5px] truncate">{{ x.name }}</span>
        <span v-if="x.branch" class="text-[12px] text-(--muted) flex-none">· {{ x.branch }}</span>
      </div>

      <div class="text-[12px] font-semibold tracking-[.04em] text-(--faint) mt-2">RECENT DEPLOYMENTS</div>
      <div v-if="sites && !deployments.length" class="text-(--muted)">None yet.</div>
      <div v-for="d in deployments" :key="d.id" class="flex gap-2 min-w-0">
        <span class="size-2 mt-[7px] flex-none rounded-full" :style="{ background: tone(d.status) }" :title="d.status" />
        <span class="min-w-0">
          <span v-if="d.commit" class="font-mono text-[12px] bg-(--code-bg) px-1 rounded-[4px]">{{ d.commit }}</span>
          {{ d.message || d.status }}
          <span class="text-[12px] text-(--muted)">· {{ d.site }} · {{ when(d.at) }}</span>
        </span>
      </div>
    </div>
    <div class="w-[252px] flex-none border-l border-(--bd) p-4 flex flex-col gap-3 overflow-y-auto">
      <div v-for="m in meta" :key="m.k">
        <div class="text-[11.5px] text-(--muted)">{{ m.k }}</div>
        <div class="text-[13px] mt-0.5 flex items-center gap-1.5 break-all" :class="m.mono ? 'font-mono' : ''">
          <span v-if="m.dot" class="inline-block size-2 rounded-full" :style="{ background: m.dot }" />{{ m.v }}
        </div>
      </div>
    </div>
  </div>
</template>

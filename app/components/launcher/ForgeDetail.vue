<script setup lang="ts">
import { STATUS } from '~/data/fixtures'

const L = useLauncher()
const sv = computed(() => L.s.server)

type Block = { h1?: string, h2?: string, p?: string, li?: string }

const md = computed((): Block[] => [
  { h1: sv.value.name },
  { p: `${sv.value.os} server on ${sv.value.provider} (${sv.value.size}), provisioned and managed by Laravel Forge.` },
  { h2: 'SITES' },
  ...sv.value.sites.map(x => ({ li: `\`${x}\`` })),
  { h2: 'RECENT DEPLOYMENTS' },
  { li: '`a3f91c2` Fix order export timezone · 12 min ago' },
  { li: '`7be20d4` Add soft deletes to orders · yesterday' },
  { li: '`19c0e8a` Bump Laravel to 12.4 · 3 days ago' },
  { h2: 'NOTES' },
  { p: 'Nightly backups run at 02:00 AEST. Queue workers restart automatically after each deploy via `php artisan queue:restart`.' }
])

const meta = computed(() => [
  { k: 'Status', v: STATUS[sv.value.status][0], dot: STATUS[sv.value.status][1] },
  { k: 'IP address', v: sv.value.ip, mono: true },
  { k: 'Provider', v: sv.value.provider },
  { k: 'Region', v: sv.value.region },
  { k: 'PHP', v: sv.value.php },
  { k: 'Sites', v: String(sv.value.sites.length) },
  { k: 'Last deploy', v: sv.value.deploy }
])
</script>

<template>
  <div class="flex h-full">
    <div class="flex-1 min-w-0 overflow-y-auto py-4 px-[22px] flex flex-col gap-2 text-[13.5px] leading-[1.6]">
      <template v-for="(b, i) in md" :key="i">
        <div v-if="b.h1" class="text-[20px] font-semibold tracking-[-.01em]">{{ b.h1 }}</div>
        <div v-else-if="b.h2" class="text-[12px] font-semibold tracking-[.04em] text-(--faint) mt-2">{{ b.h2 }}</div>
        <div v-else-if="b.p" class="text-(--fg) text-pretty"><LauncherInlineMd :text="b.p" /></div>
        <div v-else-if="b.li" class="flex gap-2"><span class="text-(--faint)">•</span><span><LauncherInlineMd :text="b.li" /></span></div>
      </template>
    </div>
    <div class="w-[252px] flex-none border-l border-(--bd) p-4 flex flex-col gap-3 overflow-y-auto">
      <div v-for="m in meta" :key="m.k">
        <div class="text-[11.5px] text-(--muted)">{{ m.k }}</div>
        <div class="text-[13px] mt-0.5 flex items-center gap-1.5" :class="m.mono ? 'font-mono' : ''">
          <span v-if="m.dot" class="inline-block size-2 rounded-full" :style="{ background: m.dot }" />{{ m.v }}
        </div>
      </div>
    </div>
  </div>
</template>

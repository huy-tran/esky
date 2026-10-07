<script setup lang="ts">
const L = useLauncher()
const s = L.s
const select = ref<{ triggerRef?: HTMLElement | null } | null>(null)

watchEffect(() => {
  L.els.deploy = select.value?.triggerRef ?? null
})
onBeforeUnmount(() => {
  L.els.deploy = null
})

const sites = computed(() => (s.server && L.forge.sites.value[s.server.id]) || [])
const items = computed(() => sites.value.map(x => ({ value: x.id, label: x.name })))
const site = computed(() => sites.value.find(x => x.id === s.deploy.siteId))
const run = computed(() => s.deployRun)
/** The end of the log: the part that says what went wrong, or that it finished. */
const tail = computed(() => (run.value?.log ?? '').trim().split(/\r?\n/).slice(-14).join('\n'))
</script>

<template>
  <div class="h-full overflow-y-auto py-[18px] px-6 box-border flex flex-col gap-4 max-w-[560px]">
    <div class="flex items-center gap-2.5 text-[13px] text-(--muted)">
      <Tile icon="i-lucide-rocket" tile="#EA580C" :size="28" :icon-size="14" />
      Deploy to <span class="text-(--fg) font-semibold">{{ s.server?.name }}</span><span class="font-mono text-[12px]">{{ s.server?.ip }}</span>
    </div>
    <UFormField label="Site" :ui="{ root: 'flex flex-col gap-1.5', label: 'text-[12.5px] font-semibold text-(--fg)', container: 'mt-0' }">
      <USelect
        ref="select"
        v-model="s.deploy.siteId"
        :items="items"
        :disabled="s.deploying"
        :placeholder="sites.length ? 'Choose a site' : 'Loading sites…'"
        variant="none"
        trailing-icon="i-lucide-chevron-down"
        class="w-full h-9 border border-(--bd) rounded-[6px] bg-(--input-bg) pl-3 pr-8 text-[13.5px] text-(--fg) focus-visible:outline-2 focus-visible:outline-(--accent)"
        :ui="{ trailing: 'pe-2.5', trailingIcon: 'size-[15px] text-(--muted)', content: 'bg-(--pop-bg) ring-(--win-bd)', item: 'text-[13.5px]' }"
      />
    </UFormField>
    <div v-if="site" class="text-[12.5px] text-(--muted) leading-normal">
      Runs the site’s deploy script on <span class="font-mono text-(--fg)">{{ site.branch || 'its branch' }}</span>{{ site.repository ? ` from ${site.repository}` : '' }}. Change the branch or script in Forge.
    </div>
    <div class="flex items-center gap-2.5">
      <UButton
        color="primary"
        :disabled="!site || s.deploying"
        class="h-[34px] gap-2 pl-3.5 pr-2 rounded-[6px] bg-(--accent) hover:bg-(--accent) text-(--on-accent) text-[13.5px] font-semibold"
        @click="L.submitDeploy()"
      >
        <Spinner v-if="s.deploying" />{{ s.deploying ? 'Deploying…' : 'Deploy' }}
        <Keys :keys="['Ctrl', '↵']" size="accent" />
      </UButton>
      <span v-if="run" class="text-[12.5px]" :class="run.ok === false ? 'text-(--err)' : run.ok ? 'text-(--ok)' : 'text-(--muted)'">
        {{ run.site }}: {{ run.status.replace('-', ' ') }}
      </span>
    </div>
    <pre v-if="tail" class="m-0 p-3 rounded-[6px] border border-(--bd) bg-(--code-bg) font-mono text-[11.5px] leading-[1.6] whitespace-pre-wrap break-all max-h-[180px] overflow-auto">{{ tail }}</pre>
  </div>
</template>

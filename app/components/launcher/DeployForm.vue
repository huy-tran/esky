<script setup lang="ts">
import { DeploySchema } from '~/utils/schemas'

const L = useLauncher()
const s = L.s
const select = ref<{ triggerRef?: HTMLElement | null } | null>(null)

watchEffect(() => {
  L.els.deploy = select.value?.triggerRef ?? null
})
onBeforeUnmount(() => {
  L.els.deploy = null
})

watch(() => s.deploy.branch, () => {
  s.branchErr = ''
})

const switchUi = {
  root: 'items-start gap-3',
  base: 'w-[34px] border-[3px] mt-px data-[state=unchecked]:bg-(--tile) data-[state=checked]:bg-(--accent) focus-visible:outline-(--accent)',
  container: 'h-5',
  thumb: 'size-3.5 bg-white shadow-none data-[state=checked]:translate-x-3.5',
  wrapper: 'ms-0',
  label: 'text-[13.5px] font-medium text-(--fg)',
  description: 'text-[12px] text-(--muted) mt-0.5'
}
</script>

<template>
  <UForm
    :state="s.deploy"
    :schema="DeploySchema"
    :validate-on="[]"
    class="h-full overflow-y-auto py-[18px] px-6 box-border flex flex-col gap-4 max-w-[520px]"
    @submit="L.submitDeploy()"
  >
    <div class="flex items-center gap-2.5 text-[13px] text-(--muted)">
      <Tile icon="i-lucide-rocket" tile="#EA580C" :size="28" :icon-size="14" />
      Deploy to <span class="text-(--fg) font-semibold">{{ s.server.name }}</span><span class="font-mono text-[12px]">{{ s.server.ip }}</span>
    </div>
    <UFormField label="Site" :ui="{ root: 'flex flex-col gap-1.5', label: 'text-[12.5px] font-semibold text-(--fg)', container: 'mt-0' }">
      <USelect
        ref="select"
        v-model="s.deploy.site"
        :items="s.server.sites"
        variant="none"
        trailing-icon="i-lucide-chevron-down"
        class="w-full h-9 border border-(--bd) rounded-[6px] bg-(--input-bg) pl-3 pr-8 text-[13.5px] text-(--fg) focus-visible:outline-2 focus-visible:outline-(--accent)"
        :ui="{ trailing: 'pe-2.5', trailingIcon: 'size-[15px] text-(--muted)', content: 'bg-(--pop-bg) ring-(--win-bd)', item: 'text-[13.5px]' }"
      />
    </UFormField>
    <UFormField
      label="Branch"
      :help="'Branches on origin: main, develop, release/2.4'"
      :error="s.branchErr || false"
      :ui="{ root: 'flex flex-col gap-1.5', label: 'text-[12.5px] font-semibold text-(--fg)', container: 'mt-0', help: 'text-[12px] text-(--muted) mt-0', error: 'text-[12px] text-(--err) mt-0' }"
    >
      <UInput
        v-model="s.deploy.branch"
        icon="i-lucide-git-branch"
        placeholder="main"
        spellcheck="false"
        variant="none"
        class="w-full"
        :ui="{
          base: ['h-9 border rounded-[6px] bg-(--input-bg) text-(--fg) pr-3 ps-[34px] text-[13.5px] font-mono focus-visible:outline-2 focus-visible:outline-(--accent)', s.branchErr ? 'border-(--err)' : 'border-(--bd)'].join(' '),
          leading: 'ps-[11px]',
          leadingIcon: 'size-[15px] text-(--muted)'
        }"
      />
    </UFormField>
    <USwitch v-model="s.deploy.migrate" label="Run migrations" :ui="switchUi">
      <template #description>
        Runs <span class="font-mono">php artisan migrate --force</span> after the build.
      </template>
    </USwitch>
    <div class="flex items-center gap-2.5 mt-1">
      <UButton
        type="submit"
        color="primary"
        class="h-[34px] gap-2 pl-3.5 pr-2 rounded-[6px] bg-(--accent) hover:bg-(--accent) text-(--on-accent) text-[13.5px] font-semibold"
      >
        <Spinner v-if="s.deploying" />{{ s.deploying ? 'Deploying…' : 'Deploy' }}
        <Keys :keys="['Ctrl', '↵']" size="accent" />
      </UButton>
    </div>
  </UForm>
</template>

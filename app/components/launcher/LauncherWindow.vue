<script setup lang="ts">
import { SPLIT } from '~/data/fixtures'

const L = useLauncher()
const s = L.s

const toaster = {
  position: 'bottom-right' as const,
  max: 3,
  expand: true,
  progress: false,
  duration: 4500,
  portal: false,
  ui: { viewport: 'absolute bottom-[52px] right-3 left-auto top-auto w-[330px] sm:w-[330px] z-30' }
}
</script>

<template>
  <div
    id="esky-window"
    data-screen-label="Esky window"
    class="relative w-[760px] h-[480px] rounded-[8px] border border-(--win-bd) bg-(--win-bg) backdrop-blur-[40px] backdrop-saturate-150 shadow-(--shadow) overflow-hidden flex flex-col text-(--fg) text-[14px]"
  >
    <LauncherChatHeader v-if="s.view === 'chat'" />
    <LauncherTopBar v-else />

    <div class="flex-1 min-h-0 relative">
      <div :key="s.view" class="h-full lp-in">
        <LauncherSearchView v-if="s.view === 'search'" />
        <LauncherClipboardView v-else-if="s.view === 'clipboard'" />
        <LauncherChatView v-else-if="s.view === 'chat'" />
        <LauncherSplitView v-else-if="SPLIT[s.view]" />
        <LauncherEmojiView v-else-if="s.view === 'emoji'" />
        <LauncherAiResultView v-else-if="s.view === 'aiResult'" />
        <LauncherForgeList v-else-if="s.view === 'forgeList'" />
        <LauncherForgeDetail v-else-if="s.view === 'forgeDetail'" />
        <LauncherDeployForm v-else-if="s.view === 'deploy'" />
        <LauncherHerdList v-else-if="s.view === 'herdList'" />
        <LauncherGitList v-else-if="s.view === 'gitList'" />
        <LauncherDockerList v-else-if="s.view === 'dockerList'" />
        <LauncherRemoteList v-else-if="s.view === 'remoteList'" />
        <LauncherPasswordView v-else-if="s.view === 'password'" />
        <LauncherDictionaryView v-else-if="s.view === 'dictionary'" />
      </div>
      <LauncherActionsMenu v-if="s.actionsOpen" />
    </div>

    <LauncherFooter />

    <LauncherDialogs />
    <LauncherOnboarding v-if="s.onb" />
    <UToaster v-bind="toaster" />
  </div>
</template>

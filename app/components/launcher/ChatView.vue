<script setup lang="ts">
const L = useLauncher()
const s = L.s
const msgsBox = ref<HTMLElement | null>(null)
const prompt = ref<{ textareaRef?: HTMLTextAreaElement | null } | null>(null)

watch(() => [s.messages, s.stream, s.view], () => nextTick(() => {
  if (msgsBox.value) msgsBox.value.scrollTop = 1e6
}), { flush: 'post', immediate: true })

watchEffect(() => {
  L.els.chat = prompt.value?.textareaRef ?? null
})
onBeforeUnmount(() => {
  L.els.chat = null
})

const streamingText = computed(() => s.stream && s.stream.target === 'chat' ? s.stream.text.slice(0, s.stream.pos) : null)

const setupSteps = computed(() => {
  const st = s.claudeStatus
  return [
    { title: 'Install Claude Code', desc: s.setupStep >= 1 ? `Found claude ${st?.version ?? ''} on PATH` : 'Not found on PATH', cmd: 'npm install -g @anthropic-ai/claude-code', ok: s.setupStep >= 1 },
    { title: 'Sign in with your Claude subscription', desc: s.setupStep >= 2 ? `Signed in as ${st?.email ?? 'your Claude account'}` : s.setupStep >= 1 ? 'Not signed in yet' : 'Waiting for step 1', cmd: 'claude login', ok: s.setupStep >= 2 }
  ]
})

const copyCode = (file: string, code: string) => {
  copyText(code)
  L.toast('success', 'Code copied', file)
}
</script>

<template>
  <div class="flex h-full">
    <nav v-if="s.showChats" class="w-[184px] flex-none border-r border-(--bd) overflow-y-auto px-1.5 pt-1 pb-2 box-border">
      <template v-for="g in L.chatGroups.value" :key="g.g">
        <div class="px-2 pt-2.5 pb-1 text-[11px] font-semibold tracking-[.04em] text-(--faint)">{{ g.g }}</div>
        <div
          v-for="c in g.items"
          :key="c.id"
          class="h-8 flex items-center px-2 rounded-[6px] text-[12.5px] cursor-default"
          :class="c.id === s.chatId ? 'bg-(--sel)' : 'bg-transparent hover:bg-(--hover)'"
          @click="L.openSavedChat(c.id)"
        >
          <span class="truncate">{{ c.title }}</span>
        </div>
      </template>
      <div v-if="!L.chatGroups.value.length" class="px-2 pt-2.5 text-[12px] text-(--muted) leading-normal">Your chats will appear here.</div>
    </nav>
    <div class="flex-1 min-w-0 flex flex-col">
      <template v-if="s.claudeReady">
        <div ref="msgsBox" class="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 flex flex-col gap-3.5 scroll-thin">
          <div v-if="!s.messages.length" class="m-auto text-center flex flex-col items-center gap-2">
            <div class="size-10 rounded-[8px] bg-(--accent-soft) text-(--accent-fg) grid place-items-center">
              <UIcon name="i-lucide-sparkles" class="size-[18px]" />
            </div>
            <div class="text-[14px] font-semibold">New chat</div>
            <div class="text-[12.5px] text-(--muted)">Ask about code, servers, or whatever is on your clipboard.</div>
          </div>
          <template v-for="(m, mi) in s.messages" :key="mi">
            <div v-if="m.role === 'user'" class="flex flex-col items-end gap-1">
              <span v-if="m.attach" class="inline-flex items-center gap-[5px] h-[22px] px-2 rounded-[6px] bg-(--tile) text-[11.5px] text-(--muted) max-w-[70%] overflow-hidden whitespace-nowrap text-ellipsis">
                <UIcon name="i-lucide-clipboard" class="size-[11px] flex-none" />{{ m.attach }}
              </span>
              <div class="max-w-[78%] bg-(--accent-soft) px-3 py-2 rounded-[8px_12px_4px_12px] text-[13.5px] leading-normal whitespace-pre-wrap">{{ m.blocks[0]?.type === 'p' ? m.blocks[0].text : '' }}</div>
            </div>
            <div v-else class="flex gap-2.5 items-start">
              <div class="size-6 flex-none rounded-[6px] bg-(--accent-soft) text-(--accent-fg) grid place-items-center mt-px">
                <UIcon name="i-lucide-sparkles" class="size-3" />
              </div>
              <div class="flex-1 min-w-0 flex flex-col gap-2.5 text-[13.5px] leading-[1.6]">
                <template v-for="(b, bi) in m.blocks" :key="bi">
                  <p v-if="b.type === 'p'" class="m-0 whitespace-pre-wrap text-pretty"><LauncherInlineMd :text="b.text" /></p>
                  <LauncherCodeBlock v-else-if="b.type === 'code'" :lang="b.lang" :file="b.file" :code="b.code" @copy="copyCode(b.file, b.code)" />
                  <div v-else-if="b.type === 'list'" class="flex flex-col gap-1">
                    <div v-for="(it, ii) in b.items" :key="ii" class="flex gap-2">
                      <span class="text-(--faint)">•</span><span><LauncherInlineMd :text="it" /></span>
                    </div>
                  </div>
                  <LauncherToolCallCard v-else-if="b.type === 'tool'" :cmd="b.cmd" :status="b.status" :out="b.out" />
                </template>
                <template v-if="mi === s.messages.length - 1 && streamingText !== null">
                  <p class="m-0 whitespace-pre-wrap">{{ streamingText }}</p>
                  <LauncherStreamShimmer />
                </template>
              </div>
            </div>
          </template>
        </div>
        <div class="flex-none mx-3 mb-3 border border-(--bd) rounded-[8px] bg-(--input-bg) pt-2 pr-2 pb-1.5 pl-3 flex flex-col gap-1">
          <span v-if="s.attach" class="self-start inline-flex items-center gap-1.5 h-[22px] pr-1 pl-2 rounded-[6px] bg-(--tile) text-[11.5px] text-(--muted) max-w-[90%]">
            <UIcon name="i-lucide-clipboard" class="size-[11px] flex-none" />
            <span class="whitespace-nowrap overflow-hidden text-ellipsis">{{ s.attach }}</span>
            <button tabindex="-1" class="border-0 bg-transparent text-(--muted) cursor-pointer px-0.5 grid place-items-center" @click="s.attach = null">
              <UIcon name="i-lucide-x" class="size-[11px]" />
            </button>
          </span>
          <UTextarea
            ref="prompt"
            v-model="s.chatInput"
            :rows="2"
            placeholder="Message Claude…"
            variant="none"
            class="w-full"
            :ui="{ base: 'p-0 text-[13.5px] leading-normal text-(--fg) resize-none placeholder:text-(--faint)' }"
          />
          <div class="flex items-center gap-2">
            <UButton
              tabindex="-1"
              title="Attach clipboard (Ctrl Shift V)"
              icon="i-lucide-paperclip"
              label="Clipboard"
              color="neutral"
              variant="ghost"
              class="h-[26px] gap-1.5 px-2 rounded-[6px] bg-(--tile) hover:bg-(--tile) text-(--fg) text-[12px] font-normal"
              :ui="{ leadingIcon: 'size-[13px]' }"
              @click="L.attachClip()"
            />
            <span class="w-px h-4 bg-(--bd)" />
            <USwitch
              v-model="s.agent"
              tabindex="-1"
              label="Agent mode"
              :ui="{
                root: 'items-center',
                base: 'w-7 border-2 data-[state=unchecked]:bg-(--tile) data-[state=checked]:bg-(--warn) focus-visible:outline-none',
                container: 'h-4',
                thumb: 'size-3 bg-white shadow-none data-[state=checked]:translate-x-3',
                wrapper: 'ms-2 text-[12px]',
                label: 'font-normal text-(--fg) cursor-pointer'
              }"
            />
            <UBadge
              v-if="s.agent"
              icon="i-lucide-triangle-alert"
              label="Can run commands"
              class="h-5 gap-[5px] px-[7px] rounded-[5px] bg-(--warn-soft) text-(--warn) text-[11px] font-semibold ring-0"
              :ui="{ leadingIcon: 'size-[11px]' }"
            />
            <span class="flex-1" />
            <Keys :keys="['↵']" />
            <UButton
              tabindex="-1"
              icon="i-lucide-arrow-up"
              color="primary"
              class="size-7 p-0 justify-center rounded-[6px] bg-(--accent) hover:bg-(--accent) text-(--on-accent)"
              :ui="{ leadingIcon: 'size-[15px]' }"
              @click="L.send()"
            />
          </div>
        </div>
      </template>
      <div v-else class="flex-1 grid place-items-center p-4">
        <UCard
          class="w-[462px] max-w-full rounded-[8px] ring-0 border border-(--bd) bg-(--surface) divide-y-0"
          :ui="{ body: 'p-0 sm:p-0 px-5 py-[18px] sm:px-5 sm:py-[18px] flex flex-col gap-3.5' }"
        >
          <div class="flex items-center gap-2.5">
            <div class="size-8 rounded-[6px] bg-(--accent-soft) text-(--accent-fg) grid place-items-center">
              <UIcon name="i-lucide-sparkles" class="size-4" />
            </div>
            <div>
              <div class="text-[15px] font-semibold">Connect Claude Code</div>
              <div class="text-[12.5px] text-(--muted) mt-0.5">AI Chat runs through your Claude subscription.</div>
            </div>
          </div>
          <div v-for="st in setupSteps" :key="st.title" class="flex gap-2.5 items-start">
            <UIcon :name="st.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'" class="size-4 mt-px flex-none" :style="{ color: st.ok ? 'var(--ok)' : 'var(--muted)' }" />
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-medium">{{ st.title }}</div>
              <div class="text-[12px] text-(--muted) mt-0.5">{{ st.desc }}</div>
              <div class="mt-1.5 font-mono text-[12px] bg-(--code-bg) border border-(--bd) rounded-[6px] px-2 py-1.5">{{ st.cmd }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2.5">
            <UButton
              color="primary"
              class="h-8 gap-2 pl-3 pr-2 rounded-[6px] bg-(--accent) hover:bg-(--accent) text-(--on-accent) text-[13px] font-medium"
              @click="L.checkAgain()"
            >
              <Spinner v-if="s.checking" />{{ s.checking ? 'Checking…' : 'Check again' }}
              <Keys :keys="['↵']" size="accent" />
            </UButton>
            <a href="#" class="text-[12.5px]" @click.prevent="openSettings({ tab: 'ai' })">Use an API key instead</a>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

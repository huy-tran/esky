export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate'
    },
    kbd: {
      base: 'normal-case'
    },
    // Form controls keep the font size each field sets (no responsive md:text-sm bump).
    input: { defaultVariants: { fixed: true } },
    inputNumber: { defaultVariants: { fixed: true } },
    select: { defaultVariants: { fixed: true } },
    textarea: { defaultVariants: { fixed: true } },
    toast: {
      slots: {
        root: 'relative overflow-hidden flex gap-[10px] items-start p-[10px_10px_10px_12px] rounded-[8px] border border-(--win-bd) bg-(--pop-bg) shadow-[0_12px_32px_rgba(0,0,0,.3)] ring-0 focus-visible:outline-none data-[state=open]:animate-[lp-in_.16s_ease-out]',
        wrapper: 'min-w-0',
        icon: 'size-4 mt-px',
        title: 'text-[13px] font-semibold text-(--fg)',
        description: 'text-[12px] text-(--muted) mt-0.5 leading-[1.45] wrap-break-word',
        actions: 'gap-[10px] items-start',
        close: 'size-[22px] p-0 grid place-items-center text-(--muted) hover:text-(--fg)'
      }
    }
  }
})

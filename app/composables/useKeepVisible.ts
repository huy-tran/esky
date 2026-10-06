// Keep the [data-sel="true"] row of a scroll box in view (no page scroll). Mirrors keepVisible in the prototype.
export function keepVisible(box: HTMLElement | null | undefined) {
  if (!box) return
  const el = box.querySelector<HTMLElement>('[data-sel="true"]')
  if (!el) return
  const t = el.offsetTop
  const b = t + el.offsetHeight
  if (t < box.scrollTop + 8) box.scrollTop = Math.max(0, t - 30)
  else if (b > box.scrollTop + box.clientHeight) box.scrollTop = b - box.clientHeight + 8
}

export function useKeepVisible(box: Ref<HTMLElement | null | undefined>, source: () => unknown) {
  watch(source, () => nextTick(() => keepVisible(box.value)), { flush: 'post' })
}

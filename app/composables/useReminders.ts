// Reminders: "remind 10am standup" in root search. They are saved, checked every 20 seconds while Esky
// runs (so a sleeping PC fires them on wake), and shown as a notification from the operating system.
import { persistRef } from './usePersist'
import { isTauri } from './usePlatform'

export interface Reminder {
  id: string
  text: string
  /** When it is due (ms since the epoch). */
  at: number
  /** When it went off. Set before the notification is sent, so a restart never sends it twice. */
  fired?: number
}

const TICK_MS = 20_000
/** A reminder that went off this long after it was due is reported as missed. */
const LATE_MS = 2 * 60_000
/** Reminders that already went off stay in the list this long. */
const KEEP_MS = 24 * 3_600_000

async function notify(title: string, body: string) {
  try {
    if (isTauri()) {
      const n = await import('@tauri-apps/plugin-notification')
      if (!(await n.isPermissionGranted()) && (await n.requestPermission()) !== 'granted') return
      n.sendNotification({ title, body })
    } else if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') await Notification.requestPermission()
      if (Notification.permission === 'granted') new Notification(title, { body })
    }
  } catch {
    // no notification service available
  }
}

let instance: ReturnType<typeof create> | null = null

function create() {
  const list = ref<Reminder[]>([])
  const ready = persistRef('reminders', list)
  let timer: ReturnType<typeof setInterval> | null = null

  const pending = computed(() => list.value.filter(r => !r.fired).sort((a, b) => a.at - b.at))
  const recent = computed(() => list.value.filter(r => r.fired).sort((a, b) => b.at - a.at))

  function tick() {
    const now = Date.now()
    const due = list.value.filter(r => !r.fired && r.at <= now)
    const stale = list.value.some(r => r.fired && now - r.fired > KEEP_MS)
    if (!due.length && !stale) return
    // Saved as fired first; the notification follows.
    list.value = list.value
      .filter(r => !(r.fired && now - r.fired > KEEP_MS))
      .map(r => due.includes(r) ? { ...r, fired: now } : r)
    for (const r of due) notify(now - r.at > LATE_MS ? 'Missed reminder' : 'Reminder', r.text)
  }

  /** Starts checking. Call it from the launcher window only, or every window would send each notification. */
  function start() {
    if (timer) return
    ready.then(() => {
      tick()
      timer = setInterval(tick, TICK_MS)
    })
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick()
    })
  }

  async function add(text: string, at: number) {
    await ready
    list.value = [...list.value, { id: `rm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, text, at }]
    // Ask for permission now rather than when the first one goes off.
    if (isTauri()) {
      const n = await import('@tauri-apps/plugin-notification').catch(() => null)
      if (n && !(await n.isPermissionGranted().catch(() => true))) n.requestPermission().catch(() => {})
    }
  }
  const remove = (id: string) => {
    list.value = list.value.filter(r => r.id !== id)
  }
  const snooze = (id: string, minutes = 10) => {
    list.value = list.value.map(r => r.id === id ? { id: r.id, text: r.text, at: Date.now() + minutes * 60_000 } : r)
  }

  return { list, pending, recent, ready, start, add, remove, snooze }
}

export function useReminders() {
  instance ??= create()
  return instance
}

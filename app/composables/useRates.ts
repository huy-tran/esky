// Currency rates for "100 usd to aud" in root search: ExchangeRate-API's free daily rates (no key,
// 160+ currencies), cached on disk. Without a connection the built-in approximate rates are used.
import { persistRef } from './usePersist'

export interface Rates {
  /** Units per US dollar, by lower-case currency code. */
  rates: Record<string, number>
  /** When the provider last updated them (ms). */
  updated: number
  /** When Esky fetched them (ms). */
  fetched: number
}

const SOURCE = 'https://open.er-api.com/v6/latest/USD'
const STALE_MS = 6 * 60 * 60 * 1000

let instance: ReturnType<typeof create> | null = null

function create() {
  const rates = ref<Rates | null>(null)
  const ready = persistRef('rates', rates)
  let busy = false

  async function refresh(force = false) {
    await ready
    if (busy || (!force && rates.value && Date.now() - rates.value.fetched < STALE_MS)) return
    busy = true
    try {
      const res = await fetch(SOURCE)
      const data = await res.json() as { result: string, time_last_update_unix: number, rates: Record<string, number> }
      if (data.result !== 'success') return
      rates.value = {
        rates: Object.fromEntries(Object.entries(data.rates).map(([k, v]) => [k.toLowerCase(), v])),
        updated: data.time_last_update_unix * 1000,
        fetched: Date.now()
      }
    } catch {
      // Offline: keep the cached rates (or the built-in ones).
    } finally {
      busy = false
    }
  }

  return { rates, refresh }
}

export function useRates() {
  instance ??= create()
  return instance
}

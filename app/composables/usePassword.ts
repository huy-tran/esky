// Password Generator state: the options (saved) and the current value (never saved).
import { PW_DEFAULTS, generatePassphrase, generatePassword, minimumLength, sanitize, type PasswordOptions } from '~/utils/password'
import { persistRef } from './usePersist'

let words: Promise<string[]> | null = null
let wordsLoaded = false
/** The EFF word list, loaded the first time it's needed. */
export const wordlist = () => (words ??= import('~/data/eff-wordlist').then((m) => {
  wordsLoaded = true
  return m.default.split(' ')
}))

let instance: ReturnType<typeof create> | null = null

function create() {
  const opts = ref<PasswordOptions>({ ...PW_DEFAULTS })
  const value = ref('')
  persistRef('password.opts', opts, { merge: true })

  let seq = 0
  async function regenerate() {
    const mine = ++seq
    const o = sanitize(opts.value)
    // Show Bitwarden's fix-ups in the form (length and word count are kept in range by their inputs).
    const fix: Partial<PasswordOptions> = {}
    if (o.lowercase !== opts.value.lowercase) fix.lowercase = o.lowercase
    if (o.minNumbers !== opts.value.minNumbers) fix.minNumbers = o.minNumbers
    if (o.minSpecial !== opts.value.minSpecial) fix.minSpecial = o.minSpecial
    if (opts.value.length < minimumLength(o)) fix.length = minimumLength(o)
    if (Object.keys(fix).length) {
      opts.value = { ...opts.value, ...fix }
      return // the watcher runs this again with the fixed options
    }
    // Don't leave a password showing under the Passphrase tab while the word list loads.
    if (o.type === 'passphrase' && !wordsLoaded) value.value = ''
    const next = o.type === 'password' ? generatePassword(o) : generatePassphrase(o, await wordlist())
    if (mine === seq) value.value = next
  }

  const setType = (type: PasswordOptions['type']) => {
    opts.value = { ...opts.value, type }
  }

  // Any change to the options makes a new value, as in Bitwarden.
  watch(opts, regenerate, { deep: true })

  return { opts, value, regenerate, setType }
}

export function usePassword() {
  instance ??= create()
  return instance
}

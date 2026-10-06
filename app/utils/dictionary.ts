// English dictionary backed by Wiktionary (free, no key, CORS enabled).
//  - definitions: /api/rest_v1/page/definition/{word}  (senses + examples per part of speech)
//  - page HTML:   /api/rest_v1/page/html/{word}         (pronunciation and headword forms, e.g. "runs, running, ran")

export interface DictSense {
  text: string
  examples: string[]
}

export interface DictPos {
  pos: string
  /** Inflections and related forms from the headword line, e.g. "plural runs". */
  forms: string[]
  senses: DictSense[]
}

export interface DictEntry {
  word: string
  ipa: string
  parts: DictPos[]
  url: string
  /** Settles once pronunciation and forms have been filled in. */
  details: Promise<void> | null
}

const API = 'https://en.wiktionary.org/api/rest_v1/page'
const HEADERS = { 'Api-User-Agent': 'Esky/0.1 (desktop launcher)' }

/** HTML fragment → plain text. Examples keep the headword in **bold** markers. */
function text(html: string, keepBold = false) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement
  root.querySelectorAll('ol, ul, dl, .reference, sup, style').forEach(n => n.remove())
  if (keepBold) root.querySelectorAll('b').forEach(b => b.replaceWith(`**${b.textContent}**`))
  return (root.textContent || '').replace(/\s+/g, ' ').trim()
}

/** First line of a definition; nested sub-senses (<ol>) are dropped, falling back to the first one if the line is empty. */
function senseText(html: string) {
  const main = text(html)
  if (main) return main
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return text(doc.querySelector('li')?.innerHTML || '')
}

interface RestSense { definition: string, examples?: string[], parsedExamples?: { example: string }[] }
interface RestPos { partOfSpeech: string, language: string, definitions: RestSense[] }

async function fetchSenses(word: string): Promise<DictPos[]> {
  const res = await fetch(`${API}/definition/${encodeURIComponent(word)}`, { headers: HEADERS })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Wiktionary returned ${res.status}`)
  const data = await res.json() as Record<string, RestPos[]>
  const merged = new Map<string, DictPos>()
  for (const p of data.en || []) {
    if (p.language !== 'English') continue
    const entry = merged.get(p.partOfSpeech) ?? { pos: p.partOfSpeech, forms: [], senses: [] }
    for (const d of p.definitions) {
      const t = senseText(d.definition)
      if (!t) continue
      const examples = (d.parsedExamples?.map(e => e.example) ?? d.examples ?? []).map(e => text(e, true)).filter(Boolean)
      entry.senses.push({ text: t, examples })
    }
    if (entry.senses.length) merged.set(p.partOfSpeech, entry)
  }
  return [...merged.values()]
}

const POS = /^(Noun|Proper noun|Verb|Adjective|Adverb|Pronoun|Preposition|Conjunction|Interjection|Determiner|Article|Numeral|Particle|Prefix|Suffix|Phrase|Prepositional phrase|Proverb|Contraction|Abbreviation|Initialism|Acronym)(\s\d+)?$/

/** Pronunciation (IPA) and headword forms per part of speech, from the English section of the page. */
async function fetchPage(word: string): Promise<{ ipa: string, forms: Record<string, string[]> }> {
  const res = await fetch(`${API}/html/${encodeURIComponent(word)}`, { headers: HEADERS })
  if (!res.ok) return { ipa: '', forms: {} }
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
  const english = doc.querySelector('h2#English')?.closest('section')
  if (!english) return { ipa: '', forms: {} }
  const ipa = english.querySelector('.IPA')?.textContent?.trim() || ''
  const forms: Record<string, string[]> = {}
  english.querySelectorAll('h3, h4, h5').forEach((h) => {
    const m = (h.textContent || '').trim().match(POS)
    if (!m) return
    const pos = m[1]!
    if (forms[pos]?.length) return
    const line = h.closest('section')?.querySelector('.headword-line')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const open = line.indexOf('(')
    const inner = open >= 0 ? line.slice(open + 1, line.lastIndexOf(')')) : ''
    forms[pos] = splitForms(inner)
  })
  return { ipa, forms }
}

/** "plural runs, present participle running" → ["plural runs", "present participle running"], ignoring commas inside parentheses. */
function splitForms(s: string) {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur.trim())
  // Keep real forms ("plural runs"), drop grammar labels ("countable and uncountable").
  return out.filter(f => f && !/^((usually|chiefly|often) )?(not comparable|comparable|uncountable|countable)( and (uncountable|countable))?$/i.test(f)).slice(0, 6)
}

const cache = new Map<string, Promise<DictEntry | null>>()

/**
 * Look a word up. Resolves with the senses as soon as they arrive (null when Wiktionary has no
 * English entry); pronunciation and forms come from the much larger page and are passed to
 * `onDetails` when ready. Results are cached for the session.
 */
export function lookup(raw: string, onDetails?: (entry: DictEntry) => void): Promise<DictEntry | null> {
  const word = raw.trim()
  const key = word.toLowerCase()
  if (!cache.has(key)) {
    const p = (async () => {
      // Try the word as typed, then lower case ("Run" → "run").
      for (const w of [...new Set([word, key])]) {
        const parts = await fetchSenses(w)
        if (!parts.length) continue
        const entry: DictEntry = { word: w, ipa: '', parts, url: `https://en.wiktionary.org/wiki/${encodeURIComponent(w)}#English`, details: null }
        entry.details = fetchPage(w).then((page) => {
          entry.ipa = page.ipa
          for (const p of entry.parts) p.forms = page.forms[p.pos] ?? []
        }).catch(() => {})
        return entry
      }
      return null
    })()
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return cache.get(key)!.then((entry) => {
    entry?.details?.then(() => onDetails?.(entry))
    return entry
  })
}

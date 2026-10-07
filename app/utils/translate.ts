// Google Translate through the free endpoint its web widget uses (no key, CORS enabled).
// It is unofficial, so it may rate-limit heavy use; "Open in Google Translate" is the fallback.

export const LANGS: { code: string, name: string }[] = [
  ['af', 'Afrikaans'], ['sq', 'Albanian'], ['ar', 'Arabic'], ['hy', 'Armenian'], ['az', 'Azerbaijani'],
  ['eu', 'Basque'], ['be', 'Belarusian'], ['bn', 'Bengali'], ['bs', 'Bosnian'], ['bg', 'Bulgarian'],
  ['ca', 'Catalan'], ['zh-CN', 'Chinese (Simplified)'], ['zh-TW', 'Chinese (Traditional)'], ['hr', 'Croatian'],
  ['cs', 'Czech'], ['da', 'Danish'], ['nl', 'Dutch'], ['en', 'English'], ['eo', 'Esperanto'], ['et', 'Estonian'],
  ['fil', 'Filipino'], ['fi', 'Finnish'], ['fr', 'French'], ['gl', 'Galician'], ['ka', 'Georgian'], ['de', 'German'],
  ['el', 'Greek'], ['gu', 'Gujarati'], ['iw', 'Hebrew'], ['hi', 'Hindi'], ['hu', 'Hungarian'], ['is', 'Icelandic'],
  ['id', 'Indonesian'], ['ga', 'Irish'], ['it', 'Italian'], ['ja', 'Japanese'], ['kn', 'Kannada'], ['kk', 'Kazakh'],
  ['km', 'Khmer'], ['ko', 'Korean'], ['lo', 'Lao'], ['lv', 'Latvian'], ['lt', 'Lithuanian'], ['mk', 'Macedonian'],
  ['ms', 'Malay'], ['ml', 'Malayalam'], ['mt', 'Maltese'], ['mr', 'Marathi'], ['mn', 'Mongolian'], ['my', 'Myanmar (Burmese)'],
  ['ne', 'Nepali'], ['no', 'Norwegian'], ['fa', 'Persian'], ['pl', 'Polish'], ['pt', 'Portuguese'], ['pa', 'Punjabi'],
  ['ro', 'Romanian'], ['ru', 'Russian'], ['sr', 'Serbian'], ['si', 'Sinhala'], ['sk', 'Slovak'], ['sl', 'Slovenian'],
  ['es', 'Spanish'], ['sw', 'Swahili'], ['sv', 'Swedish'], ['ta', 'Tamil'], ['te', 'Telugu'], ['th', 'Thai'],
  ['tr', 'Turkish'], ['uk', 'Ukrainian'], ['ur', 'Urdu'], ['uz', 'Uzbek'], ['vi', 'Vietnamese'], ['cy', 'Welsh'],
  ['yi', 'Yiddish'], ['zu', 'Zulu']
].map(([code, name]) => ({ code: code!, name: name! }))

export const langName = (code: string) => LANGS.find(l => l.code === code)?.name ?? code

/** Google reports "he" for Hebrew and "zh-CN" or "zh" for Chinese; compare on the base code. */
const base = (code: string) => (code === 'he' ? 'iw' : code).toLowerCase().split('-')[0]
export const sameLang = (a: string, b: string) => base(a) === base(b)

/** The default pair: English and this PC's language (or Spanish on an English PC). */
export function defaultPair(): [string, string] {
  const sys = typeof navigator === 'undefined' ? 'en' : navigator.language
  const hit = LANGS.find(l => l.code.toLowerCase() === sys.toLowerCase()) ?? LANGS.find(l => sameLang(l.code, sys))
  return hit && !sameLang(hit.code, 'en') ? ['en', hit.code] : ['en', 'es']
}

export interface Translation { text: string, from: string, to: string }

async function call(text: string, sl: string, tl: string, signal?: AbortSignal) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dj=1&sl=${sl}&tl=${tl}&q=${encodeURIComponent(text)}`
  const res = await fetch(url, { signal })
  if (res.status === 429) throw new Error('Google Translate is rate-limiting requests. Try again in a minute.')
  if (!res.ok) throw new Error(`Google Translate answered ${res.status}`)
  const j = await res.json() as { sentences?: { trans?: string }[], src?: string }
  return { text: (j.sentences ?? []).map(x => x.trans ?? '').join(''), src: j.src ?? sl }
}

/**
 * Translate between the pair `a` and `b`, whichever way round: the language is detected, and text
 * already in `b` goes back into `a`. Text in a third language goes into `b`.
 */
export async function translatePair(text: string, a: string, b: string, signal?: AbortSignal): Promise<Translation> {
  const first = await call(text, 'auto', b, signal)
  if (!sameLang(first.src, b)) return { text: first.text, from: first.src, to: b }
  const back = await call(text, b, a, signal)
  return { text: back.text, from: b, to: a }
}

export const googleUrl = (text: string, from: string, to: string) =>
  `https://translate.google.com/?sl=${from}&tl=${to}&text=${encodeURIComponent(text)}&op=translate`

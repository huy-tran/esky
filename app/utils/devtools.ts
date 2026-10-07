// Developer utilities: each tool turns the input text into an output, all on this PC.

export interface DevTool {
  id: string
  title: string
  icon: string
  /** Placeholder for the input box; tools without input (UUID) leave it out. */
  input?: string
  run: (text: string) => string | Promise<string>
}

const utf8ToB64 = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

const b64ToUtf8 = (s: string) => {
  const clean = s.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  const bin = atob(padded)
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
}

const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

/** MD5 (not in Web Crypto). Fine for checksums; not for security. */
function md5(input: string): string {
  const msg = new TextEncoder().encode(input)
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0)
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]
  const len = ((msg.length + 8) >>> 6) * 64 + 64
  const buf = new Uint8Array(len)
  buf.set(msg)
  buf[msg.length] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(len - 8, (msg.length * 8) >>> 0, true)
  view.setUint32(len - 4, Math.floor((msg.length * 8) / 2 ** 32), true)
  let [a0, b0, c0, d0] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476]
  for (let off = 0; off < len; off += 64) {
    const M = Array.from({ length: 16 }, (_, i) => view.getUint32(off + i * 4, true))
    let [a, b, c, d] = [a0, b0, c0, d0]
    for (let i = 0; i < 64; i++) {
      let f: number, g: number
      if (i < 16) { f = (b & c) | (~b & d); g = i }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16 }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16 }
      else { f = c ^ (b | ~d); g = (7 * i) % 16 }
      const t = d
      d = c
      c = b
      const x = (a + f + K[i]! + M[g]!) >>> 0
      const sh = S[(i >> 4) * 4 + (i % 4)]!
      b = (b + ((x << sh) | (x >>> (32 - sh)))) >>> 0
      a = t
    }
    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }
  const out = new DataView(new ArrayBuffer(16))
  ;[a0, b0, c0, d0].forEach((v, i) => out.setUint32(i * 4, v, true))
  return hex(out.buffer)
}

async function sha(alg: 'SHA-1' | 'SHA-256' | 'SHA-512', s: string) {
  return hex(await crypto.subtle.digest(alg, new TextEncoder().encode(s)))
}

/** A Unix timestamp (seconds or milliseconds) or a date, shown every useful way. */
function timestamp(text: string): string {
  const t = text.trim()
  let d: Date
  if (!t) d = new Date()
  else if (/^-?\d{1,11}(\.\d+)?$/.test(t)) d = new Date(Number(t) * 1000)
  else if (/^-?\d{12,16}$/.test(t)) d = new Date(Number(t))
  else d = new Date(t)
  if (Number.isNaN(d.getTime())) throw new Error('Not a timestamp or a date Esky understands')
  const local = d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })
  return [
    `Unix seconds   ${Math.floor(d.getTime() / 1000)}`,
    `Milliseconds   ${d.getTime()}`,
    `ISO 8601       ${d.toISOString()}`,
    `Local          ${local}`,
    `UTC            ${d.toUTCString()}`
  ].join('\n')
}

function jwt(text: string): string {
  const parts = text.trim().replace(/^Bearer\s+/i, '').split('.')
  if (parts.length < 2) throw new Error('A JWT has three parts separated by dots')
  const header = JSON.parse(b64ToUtf8(parts[0]!))
  const payload = JSON.parse(b64ToUtf8(parts[1]!)) as Record<string, unknown>
  const notes: string[] = []
  for (const k of ['iat', 'nbf', 'exp'] as const) {
    if (typeof payload[k] === 'number') notes.push(`${k}  ${new Date((payload[k] as number) * 1000).toLocaleString()}`)
  }
  if (typeof payload.exp === 'number') notes.push((payload.exp as number) * 1000 < Date.now() ? 'Expired' : 'Not expired')
  return `// Header\n${JSON.stringify(header, null, 2)}\n\n// Payload\n${JSON.stringify(payload, null, 2)}${notes.length ? `\n\n// Dates\n${notes.join('\n')}` : ''}\n\nThe signature isn't checked.`
}

export const DEV_TOOLS: DevTool[] = [
  { id: 'json', title: 'Format JSON', icon: 'i-lucide-braces', input: 'Paste JSON…', run: t => JSON.stringify(JSON.parse(t), null, 2) },
  { id: 'jsonmin', title: 'Minify JSON', icon: 'i-lucide-minimize-2', input: 'Paste JSON…', run: t => JSON.stringify(JSON.parse(t)) },
  { id: 'b64enc', title: 'Base64 Encode', icon: 'i-lucide-binary', input: 'Text to encode…', run: utf8ToB64 },
  { id: 'b64dec', title: 'Base64 Decode', icon: 'i-lucide-binary', input: 'Base64 to decode…', run: b64ToUtf8 },
  { id: 'urlenc', title: 'URL Encode', icon: 'i-lucide-link', input: 'Text to encode…', run: t => encodeURIComponent(t) },
  { id: 'urldec', title: 'URL Decode', icon: 'i-lucide-link', input: 'Encoded text…', run: t => decodeURIComponent(t.replace(/\+/g, ' ')) },
  { id: 'hash', title: 'Hash Text', icon: 'i-lucide-hash', input: 'Text to hash…', run: async t => `MD5      ${md5(t)}\nSHA-1    ${await sha('SHA-1', t)}\nSHA-256  ${await sha('SHA-256', t)}\nSHA-512  ${await sha('SHA-512', t)}` },
  { id: 'time', title: 'Convert Timestamp', icon: 'i-lucide-clock', input: 'Unix timestamp or date (empty for now)…', run: timestamp },
  { id: 'jwt', title: 'Decode JWT', icon: 'i-lucide-key-square', input: 'Paste a JWT…', run: jwt },
  { id: 'uuid', title: 'Generate UUID', icon: 'i-lucide-fingerprint', run: () => Array.from({ length: 5 }, () => crypto.randomUUID()).join('\n') }
]

export const devTool = (id: string) => DEV_TOOLS.find(t => t.id === id) ?? DEV_TOOLS[0]!

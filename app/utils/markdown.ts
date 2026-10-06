// Claude's Markdown reply → the chat's block types (paragraph, code, list).
import type { ChatBlock } from '~/data/fixtures'

export function markdownBlocks(md: string): ChatBlock[] {
  const blocks: ChatBlock[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let para: string[] = []
  let list: string[] = []

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join('\n') })
    para = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', items: list })
    list = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/)
    if (fence) {
      flushPara()
      flushList()
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i]!)) code.push(lines[i++]!)
      blocks.push({ type: 'code', lang: fence[1] || 'text', file: '', code: code.join('\n') })
      continue
    }
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)
    if (item) {
      flushPara()
      list.push(item[1]!)
      continue
    }
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    flushList()
    // Headings read as bold paragraphs in a chat bubble.
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    para.push(heading ? `**${heading[1]}**` : line)
  }
  flushPara()
  flushList()
  return blocks
}

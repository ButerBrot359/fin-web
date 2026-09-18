/** Блок минимального markdown текстового виджета. */
export type TextBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; lines: string[] }

const HEADING_RE = /^(#{1,3})\s+(.*)$/
const BULLET_RE = /^[-*]\s+(.*)$/
const ORDERED_RE = /^\d+[.)]\s+(.*)$/

/**
 * Минимальный markdown: заголовки, абзацы и списки. Жирный (`**…**`) разбирает
 * рендер построчно. Разметка собирается React-элементами — никакого
 * `dangerouslySetInnerHTML`, поэтому текст из спецификации не может внести в
 * страницу разметку.
 */
export const parseTextBlocks = (source: string): TextBlock[] => {
  const blocks: TextBlock[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let listOrdered = false

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', lines: paragraph })
      paragraph = []
    }
  }
  const flushList = (): void => {
    if (listItems.length > 0) {
      blocks.push({ kind: 'list', ordered: listOrdered, items: listItems })
      listItems = []
    }
  }

  source.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim()
    if (line === '') {
      flushParagraph()
      flushList()
      return
    }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        text: heading[2],
      })
      return
    }

    const bullet = BULLET_RE.exec(line)
    const ordered = bullet ? null : ORDERED_RE.exec(line)
    const item = bullet ?? ordered
    if (item) {
      flushParagraph()
      const isOrdered = bullet === null
      if (listOrdered !== isOrdered) flushList()
      listOrdered = isOrdered
      listItems.push(item[1])
      return
    }

    flushList()
    paragraph.push(line)
  })

  flushParagraph()
  flushList()
  return blocks
}

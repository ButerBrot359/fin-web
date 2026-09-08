import { Fragment, useMemo, type ReactNode } from 'react'
import { Typography } from '@mui/material'

export interface TextWidgetProps {
  markdown?: string | null
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; lines: string[] }

const HEADING_RE = /^(#{1,3})\s+(.*)$/
const BULLET_RE = /^[-*]\s+(.*)$/
const ORDERED_RE = /^\d+[.)]\s+(.*)$/
const BOLD_RE = /(\*\*[^*]+\*\*)/g

/**
 * Минимальный markdown: заголовки, абзацы, списки и `**жирный**`.
 * Разметку собираем React-элементами — никакого `dangerouslySetInnerHTML`,
 * поэтому текст из спецификации не может внести в страницу разметку.
 */
const parseBlocks = (source: string): Block[] => {
  const blocks: Block[] = []
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

const renderInline = (text: string): ReactNode[] =>
  text
    .split(BOLD_RE)
    .filter((part) => part !== '')
    .map((part, index) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      )
    )

const headingClass = (level: number): string => {
  if (level === 1) return 'text-h2'
  if (level === 2) return 'text-h3'
  return 'text-body1'
}

const renderBlock = (block: Block, index: number): ReactNode => {
  if (block.kind === 'heading') {
    return (
      <Typography
        key={index}
        className={`${headingClass(block.level)} text-ui-06`}
      >
        {renderInline(block.text)}
      </Typography>
    )
  }

  if (block.kind === 'list') {
    const items = block.items.map((item, itemIndex) => (
      <li key={itemIndex} className="text-body2 text-ui-06">
        {renderInline(item)}
      </li>
    ))
    return block.ordered ? (
      <ol key={index} className="list-decimal pl-5">
        {items}
      </ol>
    ) : (
      <ul key={index} className="list-disc pl-5">
        {items}
      </ul>
    )
  }

  return (
    <Typography key={index} className="text-body2 text-ui-06">
      {block.lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && ' '}
          {renderInline(line)}
        </Fragment>
      ))}
    </Typography>
  )
}

/** Текстовый виджет: содержимое берётся из `encoding.markdown`. */
export const TextWidget = ({ markdown }: TextWidgetProps) => {
  const blocks = useMemo(() => parseBlocks(markdown ?? ''), [markdown])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto">
      {blocks.map(renderBlock)}
    </div>
  )
}

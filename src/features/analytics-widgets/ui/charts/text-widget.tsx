import { Fragment, useMemo, type ReactNode } from 'react'
import { Typography } from '@mui/material'

import { parseTextBlocks, type TextBlock } from '../../lib/parse-text-blocks'

export interface TextWidgetProps {
  markdown?: string | null
}

const BOLD_RE = /(\*\*[^*]+\*\*)/g

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

const renderBlock = (block: TextBlock, index: number): ReactNode => {
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
  const blocks = useMemo(() => parseTextBlocks(markdown ?? ''), [markdown])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto">
      {blocks.map(renderBlock)}
    </div>
  )
}

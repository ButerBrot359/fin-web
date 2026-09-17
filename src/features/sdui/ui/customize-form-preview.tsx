import type { FC } from 'react'

import { cn } from '@/shared/lib/utils/cn'

import type { PreviewNode } from '../lib/customize-form/build-preview-model'
import { widthToStep } from '../lib/customize-form/width-steps'

interface CustomizeFormPreviewProps {
  model: PreviewNode
  selectedId: string | null
  hidden: Set<string>
  widths: Map<string, number | undefined>
  onSelect: (nodeId: string) => void
}

/** Доля строки под ступень ширины — превью показывает пропорцию, не пиксели. */
const STEP_BASIS: Record<string, string> = {
  narrow: '25%',
  medium: '50%',
  wide: '75%',
}

/**
 * Живое превью «Изменить форму» (решение владельца 11.09): схема реальной
 * сетки формы. Клик по плашке выбирает элемент; скрытые — пунктиром и
 * полупрозрачные, ширина ступени видна долей строки. Это схема, не рендер
 * боевой формы: плашки с подписями вместо живых полей — пользователю нужно
 * «что куда встанет», а не значения.
 */
export const CustomizeFormPreview: FC<CustomizeFormPreviewProps> = ({
  model,
  selectedId,
  hidden,
  widths,
  onSelect,
}) => {
  const renderNode = (node: PreviewNode): React.ReactNode => {
    if (node.kind === 'row') {
      return (
        <div key={node.nodeId} className="flex min-w-0 gap-2">
          {node.children.map((child) => (
            <div key={child.nodeId} className="min-w-0 flex-1">
              {renderNode(child)}
            </div>
          ))}
        </div>
      )
    }
    if (node.kind === 'column') {
      return (
        <div key={node.nodeId} className="flex min-w-0 flex-col gap-2">
          {node.children.map(renderNode)}
        </div>
      )
    }

    const isHidden = hidden.has(node.nodeId)
    const step = widthToStep(widths.get(node.nodeId))
    const basis = node.wide ? undefined : STEP_BASIS[step]
    const selected = selectedId === node.nodeId

    return (
      <div
        key={node.nodeId}
        style={basis ? { width: basis } : undefined}
        className={cn('min-w-0', node.kind === 'tabs' && 'w-full')}
      >
        <button
          type="button"
          disabled={!node.editable}
          onClick={() => {
            onSelect(node.nodeId)
          }}
          className={cn(
            'w-full truncate rounded-md border px-2 text-left text-xs',
            node.wide || node.kind === 'tabs' ? 'py-3' : 'py-1.5',
            selected
              ? 'border-accent-02 bg-ui-04 text-accent-02'
              : 'border-ui-03 bg-ui-01 text-ui-06',
            isHidden && 'border-dashed opacity-40',
            node.editable
              ? 'cursor-pointer hover:border-accent-02'
              : 'cursor-default text-ui-05'
          )}
        >
          {node.label}
        </button>
      </div>
    )
  }

  return (
    <div className="border-ui-03 bg-ui-02 flex flex-col gap-2 rounded-lg border p-3">
      {renderNode(model)}
    </div>
  )
}

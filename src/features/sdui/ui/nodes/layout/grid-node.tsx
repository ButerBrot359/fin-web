import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { isNodeVisible } from '../../../lib/utils/node-visibility'
import { resolveStackGap } from '../../../lib/utils/resolve-stack-gap'
import { NodeRenderer } from '../../node-renderer'

/**
 * GRID — сеточная раскладка. Со спекой грид-модели (2026-09-11) это основной
 * контейнер шапки объектных форм: бэк отдаёт `columns: 24`, дети несут
 * `colSpan` (единицы сетки, дефолт — вся строка) и `newRow` (явный разрыв
 * строки, `grid-column-start: 1`). Вертикальный и горизонтальный зазоры
 * раздельные: `gap` — между строками, `columnGap` — между колонками
 * (в исходных стековых конфигах они были разными: 12px и 24px).
 *
 * SPACER-ячейки конвертации рендерятся пустыми клетками — они держат дыры
 * исходной раскладки, пока пользователь не задал свой порядок.
 */
export const GridNode: FC<NodeProps> = ({ node }) => {
  const columns = (node.props?.columns as number | undefined) ?? 1
  const rowGap = resolveStackGap(node.props?.gap as number | undefined)
  const columnGap = resolveStackGap(
    (node.props?.columnGap as number | undefined) ??
      (node.props?.gap as number | undefined)
  )

  const cellSpan = (raw: unknown): number => {
    if (typeof raw !== 'number' || raw < 1) return columns
    return Math.min(columns, Math.round(raw))
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${String(columns)}, 1fr)`,
        rowGap,
        columnGap,
      }}
    >
      {node.children?.filter(isNodeVisible).map((c) => (
        <div
          key={c.id}
          style={{
            gridColumn: `${c.props?.newRow === true ? '1 / ' : ''}span ${String(cellSpan(c.props?.colSpan))}`,
            minWidth: 0,
          }}
        >
          {c.type === 'SPACER' ? null : <NodeRenderer node={c} />}
        </div>
      ))}
    </div>
  )
}

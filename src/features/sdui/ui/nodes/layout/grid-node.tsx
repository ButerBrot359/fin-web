import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { layoutGridCells } from '../../../lib/utils/grid-bands'
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
/**
 * Потолок ширины НОРМАЛИЗОВАННОЙ шапки (columns=24). Без него резиновая сетка
 * растягивает инпуты на всю ширину окна, и на широких экранах поля шапки
 * доминируют над табличными частями (SCRUM-412 п.3 — «уменьшить ширину
 * инпутов, приоритет у табличных частей»). 1200px ≈ два поля по ~580px — как
 * компактные ряды параметров reportalt. Легаси-гриды (columns=2 страницы
 * модуля) не трогаем: у них своя раскладка.
 */
const NORMALIZED_GRID_MAX_WIDTH = 1200
const NORMALIZED_GRID_COLUMNS = 24

export const GridNode: FC<NodeProps> = ({ node }) => {
  const columns = (node.props?.columns as number | undefined) ?? 1
  const rowGap = resolveStackGap(node.props?.gap as number | undefined)
  const columnGap = resolveStackGap(
    (node.props?.columnGap as number | undefined) ??
      (node.props?.gap as number | undefined)
  )

  // Дефолт — ОДНА ячейка, как в легаси-гридах (страница модуля: columns=2,
  // дети без colSpan). Нормализованная шапка всегда шлёт colSpan явно.
  const cellSpan = (raw: unknown): number => {
    if (typeof raw !== 'number' || raw < 1) return 1
    return Math.min(columns, Math.round(raw))
  }

  const cellStart = (colStart: unknown, newRow: unknown): string => {
    if (typeof colStart === 'number' && colStart >= 1 && colStart <= columns) {
      return `${String(Math.round(colStart))} / `
    }
    return newRow === true ? '1 / ' : ''
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${String(columns)}, 1fr)`,
        rowGap,
        columnGap,
        ...(columns === NORMALIZED_GRID_COLUMNS
          ? { maxWidth: NORMALIZED_GRID_MAX_WIDTH }
          : {}),
      }}
    >
      {layoutGridCells(node.children ?? []).map((c) => (
        <div
          key={c.id}
          style={{
            gridColumn: `${cellStart(c.props?.colStart, c.props?.newRow)}span ${String(cellSpan(c.props?.colSpan))}`,
            minWidth: 0,
          }}
        >
          {c.type === 'SPACER' ? null : <NodeRenderer node={c} />}
        </div>
      ))}
    </div>
  )
}

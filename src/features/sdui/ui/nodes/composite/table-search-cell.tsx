import type { ReactNode } from 'react'
import { TableCell } from '@mui/material'

// Общий рендер ячейки ТЧ с подсветкой текущего совпадения поиска (§6.5 спеки:
// поиск не фильтрует строки — только подсвечивает найденную ячейку и скроллит
// к ней). data-search-hit — маркер для scrollIntoView в родительской таблице.
// Используется в рендере строк editable-table.tsx и complex-editable-table.tsx
// (не в мемоизированных cell-определениях колонок — иначе сбрасывается фокус
// инпутов при вводе). isSearchHit живёт в use-table-search.ts (react-refresh).

interface SearchHitCellProps {
  isHit: boolean
  children: ReactNode
}

export const SearchHitCell = ({ isHit, children }: SearchHitCellProps) => (
  <TableCell
    data-search-hit={isHit || undefined}
    sx={{ p: 0, bgcolor: isHit ? 'action.focus' : undefined }}
  >
    {children}
  </TableCell>
)

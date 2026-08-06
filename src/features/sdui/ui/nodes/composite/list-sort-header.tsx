// SCRUM-291: заголовок сортируемой колонки LIST — вынесен из list-node.tsx
// (split на файлы < 300 строк). Новое здесь — клавиатурная активация
// сортировки (Enter/Space), остальное поведение перенесено verbatim.
import type { FC, ReactNode } from 'react'

export interface ListSortHeaderProps {
  label: string
  arrowDir: 'ASC' | 'DESC' | undefined
  // Present ⟺ column is sortable; absent → plain, non-interactive label.
  onSort: (() => void) | undefined
  // Funnel node (or null) rendered next to the label; built by the caller.
  funnel: ReactNode
}

export const ListSortHeader: FC<ListSortHeaderProps> = ({
  label,
  arrowDir,
  onSort,
  funnel,
}) => (
  <div className="inline-flex items-center gap-1">
    <span
      {...(onSort
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: onSort,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSort()
              }
            },
            className:
              'inline-flex cursor-pointer select-none items-center gap-1',
          }
        : {})}
    >
      {label}
      {arrowDir && (
        <span aria-hidden="true">{arrowDir === 'ASC' ? '▲' : '▼'}</span>
      )}
    </span>
    {funnel}
  </div>
)

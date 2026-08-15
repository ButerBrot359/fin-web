import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

export interface ListTrailEntry {
  id: number
  label: string
}

interface ListBreadcrumbsProps {
  /** Путь от корня к текущему уровню; пустой — мы в корне. */
  trail: ListTrailEntry[]
  /** Переход на уровень: `depth` — сколько сегментов пути оставить. */
  onNavigate: (depth: number) => void
}

/**
 * «Где мы находимся» при навигации по уровням справочника: корень + пройденные
 * папки. Клик по сегменту возвращает на его уровень.
 */
export const ListBreadcrumbs: FC<ListBreadcrumbsProps> = ({
  trail,
  onNavigate,
}) => {
  const { t } = useTranslation()

  if (trail.length === 0) return null

  return (
    <nav className="flex shrink-0 flex-wrap items-center gap-1 px-1">
      <Crumb
        label={t('table.treeRoot')}
        onClick={() => {
          onNavigate(0)
        }}
      />
      {trail.map((entry, index) => {
        const isLast = index === trail.length - 1
        return (
          <span key={entry.id} className="flex items-center gap-1">
            <Typography variant="body2" className="text-ui-05">
              /
            </Typography>
            <Crumb
              label={entry.label}
              isCurrent={isLast}
              onClick={() => {
                onNavigate(index + 1)
              }}
            />
          </span>
        )
      })}
    </nav>
  )
}

interface CrumbProps {
  label: string
  isCurrent?: boolean
  onClick: () => void
}

const Crumb: FC<CrumbProps> = ({ label, isCurrent = false, onClick }) => (
  <button
    type="button"
    disabled={isCurrent}
    onClick={onClick}
    className={cn(
      'max-w-50 truncate rounded px-1 text-body2',
      isCurrent
        ? 'cursor-default font-medium text-ui-06'
        : 'text-primary hover:underline'
    )}
  >
    {label}
  </button>
)

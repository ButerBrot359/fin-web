import type { DragEvent, FC, ReactNode } from 'react'
import { IconButton, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { figmaIcons } from '@/shared/ui/icons'

interface MenuTreeRowProps {
  label: string
  /** Скрыт ли пункт черновиком ЭТОГО слоя. */
  hiddenInLayer: boolean
  /** Скрыт ли пункт нижними слоями (бейдж «скрыт другим уровнем»). */
  hiddenBelow: boolean
  busy: boolean
  onToggle: () => void
  /** Пункт «Настройка меню» — тумблер скрытия не показывается (нескрываем). */
  protectedItem?: boolean
  /** Раскрытие кликом по всей строке (модули). */
  expandable?: boolean
  expanded?: boolean
  onExpand?: () => void
  /** Drag-n-drop в пределах родителя (решение владельца 24.09). */
  onDragStart: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
  onDragEnd: () => void
  /** Подсветка строки-цели при перетаскивании над ней. */
  dropTarget?: boolean
}

/**
 * Строка дерева редактора меню (SCRUM-426): перетаскивается целиком (dnd),
 * глазик скрывает/показывает, у модулей клик по строке раскрывает содержимое.
 */
export const MenuTreeRow: FC<MenuTreeRowProps> = ({
  label,
  hiddenInLayer,
  hiddenBelow,
  busy,
  onToggle,
  protectedItem = false,
  expandable = false,
  expanded = false,
  onExpand,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dropTarget = false,
}) => {
  const { t } = useTranslation()
  const dimmed = hiddenInLayer || hiddenBelow

  return (
    <div
      draggable={!busy}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex cursor-grab items-center gap-2 rounded-lg border border-solid px-2 py-1 ${
        dropTarget ? 'border-interactive-01 bg-selection' : 'border-transparent'
      } ${expandable ? 'hover:bg-ui-01' : ''}`}
    >
      {protectedItem ? (
        <span className="inline-block w-8 shrink-0" />
      ) : (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          disabled={busy}
          aria-label={t('sdui.menuSettings.toggleVisibility', { label })}
        >
          {figmaIcons[hiddenInLayer ? 'eye-closed' : 'eye-opened']}
        </IconButton>
      )}
      {expandable ? (
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-label={t('sdui.menuSettings.expand', { label })}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
        >
          <RowLabel label={label} dimmed={dimmed} />
          <Typography variant="body2" className="shrink-0 text-interactive-01">
            {expanded ? '▴' : '▾'}
          </Typography>
        </button>
      ) : (
        <RowLabel label={label} dimmed={dimmed} />
      )}
      {hiddenBelow && !hiddenInLayer && (
        <Typography variant="caption" className="shrink-0 text-ui-05">
          {t('sdui.menuSettings.hiddenBelow')}
        </Typography>
      )}
      <span className="shrink-0 cursor-grab select-none text-ui-05">⠿</span>
    </div>
  )
}

const RowLabel: FC<{ label: string; dimmed: boolean }> = ({
  label,
  dimmed,
}): ReactNode => (
  <Typography
    variant="body2"
    className={`min-w-0 flex-1 truncate ${dimmed ? 'text-ui-05' : ''}`}
  >
    {label}
  </Typography>
)

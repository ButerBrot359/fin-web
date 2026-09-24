import type { FC, ReactNode } from 'react'
import { IconButton, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { figmaIcons } from '@/shared/ui/icons'

interface MenuTreeRowProps {
  label: string
  /** Скрыт ли пункт черновиком ЭТОГО слоя. */
  hiddenInLayer: boolean
  /** Скрыт ли пункт нижними слоями (бейдж «скрыт уровнем ниже»). */
  hiddenBelow: boolean
  busy: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onToggle: () => void
  onMove: (dir: -1 | 1) => void
  /** Пункт «Настройка меню» — тумблер скрытия не показывается (нескрываем). */
  protectedItem?: boolean
  children?: ReactNode
}

/**
 * Строка дерева редактора меню (SCRUM-426 §4.2): глазик, подпись, бейдж
 * «скрыт уровнем ниже», кнопки ↑/↓ (dnd-библиотеки в проекте нет — перестановка
 * кнопками, как в конструкторе дизайна).
 */
export const MenuTreeRow: FC<MenuTreeRowProps> = ({
  label,
  hiddenInLayer,
  hiddenBelow,
  busy,
  canMoveUp,
  canMoveDown,
  onToggle,
  onMove,
  protectedItem = false,
  children,
}) => {
  const { t } = useTranslation()
  const dimmed = hiddenInLayer || hiddenBelow

  return (
    <div className="flex items-center gap-2">
      {protectedItem ? (
        // Ширина глазика — чтобы подписи не прыгали.
        <span className="inline-block w-8" />
      ) : (
        <IconButton
          size="small"
          onClick={onToggle}
          disabled={busy}
          aria-label={t('sdui.menuSettings.toggleVisibility', { label })}
        >
          {figmaIcons[hiddenInLayer ? 'eye-closed' : 'eye-opened']}
        </IconButton>
      )}
      <Typography
        variant="body2"
        className={`min-w-0 flex-1 truncate ${dimmed ? 'text-ui-05' : ''}`}
      >
        {label}
      </Typography>
      {hiddenBelow && !hiddenInLayer && (
        <Typography variant="caption" className="shrink-0 text-ui-05">
          {t('sdui.menuSettings.hiddenBelow')}
        </Typography>
      )}
      {children}
      <IconButton
        size="small"
        onClick={() => {
          onMove(-1)
        }}
        disabled={busy || !canMoveUp}
        aria-label={t('sdui.menuSettings.moveUp', { label })}
      >
        ↑
      </IconButton>
      <IconButton
        size="small"
        onClick={() => {
          onMove(1)
        }}
        disabled={busy || !canMoveDown}
        aria-label={t('sdui.menuSettings.moveDown', { label })}
      >
        ↓
      </IconButton>
    </div>
  )
}

import type { FC } from 'react'
import { Checkbox, IconButton, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { CustomizableNode } from '../lib/customize-form/collect-customizable-nodes'

interface CustomizeFormRowProps {
  node: CustomizableNode
  hidden: boolean
  width: number | undefined
  canMoveUp: boolean
  canMoveDown: boolean
  busy: boolean
  onToggle: () => void
  onMove: (direction: -1 | 1) => void
  onWidthChange: (width: number | undefined) => void
}

/**
 * Строка диалога «Изменить форму»: видимость (чекбокс), порядок среди соседей
 * (стрелки), ширина поля (px, пусто = авто). Глифы стрелок текстовые — в
 * реестре иконок проекта их нет, а тянуть новые ради диалога незачем.
 */
export const CustomizeFormRow: FC<CustomizeFormRowProps> = ({
  node,
  hidden,
  width,
  canMoveUp,
  canMoveDown,
  busy,
  onToggle,
  onMove,
  onWidthChange,
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={!hidden}
        onChange={onToggle}
        disabled={busy}
        size="small"
      />
      <Typography variant="body2" className="min-w-0 flex-1 truncate">
        {node.label}
      </Typography>
      {node.isField && (
        <TextField
          size="small"
          type="number"
          value={width ?? ''}
          placeholder={t('sdui.customizeForm.widthAuto')}
          onChange={(e) => {
            const parsed = Number(e.target.value)
            onWidthChange(
              e.target.value === '' || Number.isNaN(parsed) || parsed <= 0
                ? undefined
                : parsed
            )
          }}
          disabled={busy}
          slotProps={{ htmlInput: { min: 100, max: 1200, step: 10 } }}
          sx={{ width: 96 }}
          aria-label={t('sdui.customizeForm.widthLabel', {
            label: node.label,
          })}
        />
      )}
      <IconButton
        size="small"
        onClick={() => {
          onMove(-1)
        }}
        disabled={busy || !canMoveUp}
        aria-label={t('sdui.customizeForm.moveUp', { label: node.label })}
      >
        ↑
      </IconButton>
      <IconButton
        size="small"
        onClick={() => {
          onMove(1)
        }}
        disabled={busy || !canMoveDown}
        aria-label={t('sdui.customizeForm.moveDown', { label: node.label })}
      >
        ↓
      </IconButton>
    </div>
  )
}

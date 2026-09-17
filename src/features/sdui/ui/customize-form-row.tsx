import type { FC } from 'react'
import {
  Checkbox,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { CustomizableNode } from '../lib/customize-form/collect-customizable-nodes'
import {
  WIDTH_STEPS,
  stepToWidth,
  widthToStep,
} from '../lib/customize-form/width-steps'

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
 * Строка диалога «Изменить форму»: видимость (чекбокс), порядок среди
 * соседей своей группы (стрелки) и ширина поля ИМЕНОВАННЫМИ ступенями —
 * пиксели пользователю непонятны (решение владельца 11.09). Глифы стрелок
 * текстовые — в реестре иконок проекта их нет.
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
          select
          hiddenLabel
          size="small"
          value={widthToStep(width)}
          onChange={(e) => {
            onWidthChange(stepToWidth(e.target.value as never))
          }}
          disabled={busy}
          sx={{ width: 128 }}
          aria-label={t('sdui.customizeForm.widthLabel', {
            label: node.label,
          })}
        >
          {WIDTH_STEPS.map((step) => (
            <MenuItem key={step.key} value={step.key}>
              {t(`sdui.customizeForm.widthSteps.${step.key}`)}
            </MenuItem>
          ))}
        </TextField>
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

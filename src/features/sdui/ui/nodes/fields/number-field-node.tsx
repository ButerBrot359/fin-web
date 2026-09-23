import type { FC } from 'react'
import { Typography } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { useChangeOnBlur } from '../../../lib/hooks/use-change-on-blur'
import {
  allowsDecimalInput,
  numberPrecision,
} from '../../../lib/utils/number-input-mode'
import {
  WIDTH_CONSTRAINED_SX,
  hasLeftLabel,
  widthCharsInputStyle,
  widthCharsOf,
} from '../../../lib/utils/field-width'
import { NumberInput } from '@/shared/ui/inputs'
import { FieldLabelLeft } from './field-label-left'

export const NumberFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  // Правило общее с ячейкой ТЧ — см. allowsDecimalInput.
  const allowDecimal = allowsDecimalInput(
    node.props,
    node.props?.dataType as string | undefined
  )
  const precision = numberPrecision(node.props)
  const rawValue = f.value as number | string | null | undefined
  const changeOnBlur = useChangeOnBlur(f, rawValue)

  // SCRUM-355 §5: ширина в знаках, единица справа, подпись слева и снаружи
  // рамки. Отсутствие каждого пропа сохраняет прежнее поведение.
  const widthChars = widthCharsOf(node.props)
  const suffix = node.props?.suffix as string | undefined
  const leftLabel = hasLeftLabel(node.props)

  if (!f.visible) return null

  const stringValue =
    rawValue === null || rawValue === undefined ? '' : String(rawValue)

  // SCRUM-278 v4 → SCRUM-317 v4 §4.1: helperText — всегда пояснение поля;
  // текст ошибки живёт в панели и тултипе, под полем — только рамка.
  const helperText = node.props?.helperText as string | undefined

  const field = (
    <NumberInput
      // Подпись слева живёт СНАРУЖИ (FieldLabelLeft): MUI держит label внутри
      // рамки и на трёх знаках от «Длина генерируемого кода:» осталось бы «Дл…»
      label={leftLabel ? undefined : f.label}
      value={stringValue}
      size={node.props?.size as 'small' | undefined}
      required={f.required}
      readOnly={f.readonly}
      disabled={!f.enabled}
      error={!!f.error}
      helperText={helperText}
      fullWidth={widthChars === undefined}
      sx={widthChars === undefined ? undefined : WIDTH_CONSTRAINED_SX}
      slotProps={{
        formHelperText: {
          sx: {
            // Тема абсолютит FormHelperText — comment-пояснение должно
            // занимать место в потоке, иначе его перекроет соседнее поле
            position: 'static',
            fontSize: 14,
            lineHeight: 1.35,
            color: 'text.secondary',
            ml: 0,
          },
        },
        htmlInput: {
          ...(widthChars !== undefined
            ? { style: widthCharsInputStyle(widthChars, 'right') }
            : {}),
          // Подпись ушла наружу — без aria-label поле теряет доступное имя
          ...(leftLabel && f.label ? { 'aria-label': f.label } : {}),
        },
      }}
      decimal={allowDecimal}
      precision={precision}
      calculator={node.props?.calculator === true}
      onCalculatorApply={(result) => {
        f.fireServerEvent('change', result)
      }}
      onChange={(e) => {
        const raw = e.target.value
        const parsed = raw === '' ? null : parseFloat(raw)
        f.setValue(parsed)
      }}
      onFocus={changeOnBlur.onFocus}
      onBlur={changeOnBlur.onBlur}
    />
  )

  if (!suffix && !leftLabel) return field

  return (
    // §8.5: [подпись] [поле] [suffix] одной строкой. alignItems 'center', не
    // 'baseline': при непустом helperText поле выше, и единица уехала бы вниз.
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {leftLabel && f.label && <FieldLabelLeft text={f.label} />}
      {field}
      {suffix && (
        <Typography variant="body2" whiteSpace="nowrap">
          {suffix}
        </Typography>
      )}
    </div>
  )
}

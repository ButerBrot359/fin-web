import type { FC } from 'react'
import {
  Checkbox,
  FormControlLabel,
  FormHelperText,
  FormControl,
} from '@mui/material'

import { DisabledReasonTooltip } from '@/shared/ui/disabled-reason-tooltip'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'

export const CheckboxFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const value = (f.value as boolean | undefined) ?? false
  const helperText = node.props?.helperText as string | undefined

  if (!f.visible) return null

  // MuiFormControl — inline-flex и по умолчанию сжимается до содержимого. В
  // блочном контейнере (содержимое TAB рендерится без flex-обёртки) пустое
  // перечисление схлопывается до ~40px и обрезает подпись. Тема задаёт fullWidth
  // только для MuiTextField/MuiPickersTextField, поэтому прочие поля не страдают
  // — они стоят на TextField. Растягиваем контейнер поля, а не сам контрол.
  return (
    <FormControl fullWidth error={!!f.error} required={f.required}>
      {/* SCRUM-308 §3.1/§9.1: причина недоступности — props.tooltip; цель
          наведения — весь FormControlLabel (подпись — часть цели, как в 1С). */}
      <DisabledReasonTooltip reason={node.props?.tooltip as string | undefined}>
        <FormControlLabel
          label={f.label ?? ''}
          control={
            <Checkbox
              checked={value}
              disabled={!f.enabled || f.readonly}
              // SCRUM-317 v4 §4.1: у флажка нет рамки — состояние ошибки
              // показывает сам квадрат цветом error из палитры темы; текст
              // ошибки живёт в панели и тултипе.
              sx={f.error ? { color: 'error.main' } : undefined}
              onChange={(e) => {
                const newVal = e.target.checked
                // §9.1: погашенный узел не шлёт команду, даже если событие
                // доставлено мимо MUI-атрибута disabled.
                if (!f.enabled || f.readonly) return
                f.setValue(newVal)
                f.fireServerEvent('change', newVal)
              }}
            />
          }
        />
      </DisabledReasonTooltip>
      {/* SCRUM-278 v4: пояснение под лейблом чекбокса с видимым отступом,
          не в line-box лейбла. SCRUM-317 v4 §4.1: текста ошибки здесь больше
          нет, поэтому пояснение показывается всегда, не только без ошибки.
          position static ОБЯЗАТЕЛЕН: тема глобально абсолютит FormHelperText
          (bottom: -18), из-за чего следующий элемент формы его перекрывает */}
      {helperText && (
        <FormHelperText
          sx={{
            position: 'static',
            ml: 0,
            mt: 0.5,
            fontSize: 14,
            lineHeight: 1.35,
            color: 'text.secondary',
          }}
        >
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  )
}

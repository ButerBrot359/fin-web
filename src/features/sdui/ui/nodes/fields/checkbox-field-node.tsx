import type { FC } from 'react'
import {
  Checkbox,
  FormControlLabel,
  FormHelperText,
  FormControl,
} from '@mui/material'

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
      <FormControlLabel
        label={f.label ?? ''}
        control={
          <Checkbox
            checked={value}
            disabled={!f.enabled || f.readonly}
            onChange={(e) => {
              const newVal = e.target.checked
              f.setValue(newVal)
              f.fireServerEvent('change', newVal)
            }}
          />
        }
      />
      {f.error && <FormHelperText>{f.error}</FormHelperText>}
      {/* SCRUM-278 v4: пояснение под лейблом чекбокса с видимым отступом,
          не в line-box лейбла; показывается только без ошибки валидации.
          position static ОБЯЗАТЕЛЕН: тема глобально абсолютит FormHelperText
          (bottom: -18), из-за чего следующий элемент формы его перекрывает */}
      {!f.error && helperText && (
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

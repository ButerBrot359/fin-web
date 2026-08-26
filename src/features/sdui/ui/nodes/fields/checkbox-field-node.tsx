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

  return (
    <FormControl
      error={!!f.error}
      required={f.required}
      sx={{ flex: f.flex !== undefined ? f.flex : undefined }}
    >
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

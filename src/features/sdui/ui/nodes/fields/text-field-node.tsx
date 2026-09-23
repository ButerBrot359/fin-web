import type { FC } from 'react'
import { TextField } from '@mui/material'

import { DisabledReasonTooltip } from '@/shared/ui/disabled-reason-tooltip'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { useChangeOnBlur } from '../../../lib/hooks/use-change-on-blur'
import { useEditConfirm } from '../../../lib/hooks/use-edit-confirm'

export const TextFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const placeholder = node.props?.placeholder as string | undefined
  const maxLength = node.props?.maxLength as number | undefined
  // SCRUM-308 v1 §4.2 / SCRUM-355 §5.5: поле секрета — скрытый ввод.
  // autoComplete="new-password" обязателен: без него менеджер паролей
  // подставляет в настройку SMTP пароль пользователя от самого приложения.
  const secret = node.props?.secret === true
  const value = (f.value as string | undefined) ?? ''
  const changeOnBlur = useChangeOnBlur(f, value)
  const editConfirm = useEditConfirm(
    f.readonly ? undefined : (node.props?.editConfirm as string | undefined)
  )

  if (!f.visible) return null

  return (
    // SCRUM-308 §3.1: причина недоступности — props.tooltip (приезжает только
    // вместе с гашением); блочная обёртка, чтобы не схлопнуть fullWidth.
    <DisabledReasonTooltip
      reason={node.props?.tooltip as string | undefined}
      block
    >
      <TextField
        label={f.label}
        size={node.props?.size as 'small' | undefined}
        type={secret ? 'password' : undefined}
        autoComplete={secret ? 'new-password' : undefined}
        value={value}
        placeholder={placeholder}
        required={f.required}
        // SCRUM-317 v4 §4.1: текст ошибки живёт в панели и тултипе — под полем только рамка
        error={!!f.error}
        disabled={!f.enabled}
        onChange={(e) => {
          f.setValue(e.target.value)
        }}
        onFocus={(e) => {
          changeOnBlur.onFocus()
          editConfirm.onFocus(e)
        }}
        onBlur={changeOnBlur.onBlur}
        slotProps={{
          input: { readOnly: f.readonly },
          htmlInput:
            maxLength !== undefined && maxLength > 0
              ? { maxLength }
              : undefined,
        }}
      />
    </DisabledReasonTooltip>
  )
}

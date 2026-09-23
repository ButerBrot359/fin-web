import type { FC } from 'react'
import {
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'

import { DisabledReasonTooltip } from '@/shared/ui/disabled-reason-tooltip'

import type { NodeProps } from '../../../types/view'
import {
  useFieldNode,
  type FieldNodeCommon,
} from '../../../lib/hooks/use-field-node'
import {
  resolveEnumValue,
  type EnumOption,
} from '../../../lib/utils/enum-value'

// SCRUM-308 v3 §4: props.control у ENUM_FIELD — "radio" (радиогруппа) и
// "segmented" (сегментированный переключатель). Контракт options тот же, что у
// селекта, включая options[].disabled/disabledReason; отдельного типа узла нет.

const selectOption = (f: FieldNodeCommon, opt: EnumOption) => {
  // SCRUM-308 §9.1: недоступность проверяем в обработчике, а не только
  // атрибутом — событие, доставленное мимо MUI, не должно слать команду.
  if (opt.disabled === true) return
  const enumValue = {
    id: opt.id ?? opt.value,
    code: opt.code ?? opt.value,
    presentation: opt.label,
  }
  f.setValue(enumValue)
  f.fireServerEvent('change', enumValue)
}

const optionLabel = (opt: EnumOption) =>
  opt.disabled === true && opt.disabledReason ? (
    // У отключённого пункта pointer-events: none наследуется вложенным
    // span — тултипу нужен явный pointerEvents: auto (как в селекте).
    <Tooltip title={opt.disabledReason}>
      <span style={{ pointerEvents: 'auto' }}>{opt.label}</span>
    </Tooltip>
  ) : (
    opt.label
  )

export const EnumFieldControl: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const control = node.props?.control as string | undefined
  const options = (node.props?.options as EnumOption[] | undefined) ?? []
  const value = resolveEnumValue(f.value, options)
  const reason = node.props?.tooltip as string | undefined

  if (!f.visible) return null

  const body =
    control === 'segmented' ? (
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        disabled={!f.enabled}
        onChange={(_, next: string | null) => {
          if (next == null || next === value || f.readonly) return
          const opt = options.find((o) => o.value === next)
          if (opt) selectOption(f, opt)
        }}
      >
        {options.map((opt) => (
          <ToggleButton
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled === true}
          >
            {optionLabel(opt)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    ) : (
      <RadioGroup value={value}>
        {options.map((opt) => (
          <FormControlLabel
            key={opt.value}
            value={opt.value}
            control={<Radio size="small" />}
            label={optionLabel(opt)}
            disabled={!f.enabled || f.readonly || opt.disabled === true}
            onChange={() => {
              if (value !== opt.value) selectOption(f, opt)
            }}
          />
        ))}
      </RadioGroup>
    )

  return (
    <DisabledReasonTooltip reason={reason} block>
      <FormControl
        disabled={!f.enabled}
        error={!!f.error}
        required={f.required}
        sx={{ width: '100%' }}
      >
        {f.label && (
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {f.label}
          </Typography>
        )}
        {body}
      </FormControl>
    </DisabledReasonTooltip>
  )
}

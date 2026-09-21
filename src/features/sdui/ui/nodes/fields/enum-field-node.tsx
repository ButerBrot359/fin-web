import type { FC } from 'react'
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
} from '@mui/material'

import { DisabledReasonTooltip } from '@/shared/ui/disabled-reason-tooltip'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import {
  resolveEnumValue,
  type EnumOption,
} from '../../../lib/utils/enum-value'

export const EnumFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const options = (node.props?.options as EnumOption[] | undefined) ?? []
  const value = resolveEnumValue(f.value, options)
  // SCRUM-308 §3.1: причина недоступности узла — тот же props.tooltip, что у
  // кнопок (SCRUM-181); приезжает только вместе с признаком гашения.
  const reason = node.props?.tooltip as string | undefined

  if (!f.visible) return null

  const labelId = `enum-field-${node.id}-label`

  // MuiFormControl — inline-flex и по умолчанию сжимается до содержимого. В
  // блочном контейнере (содержимое TAB рендерится без flex-обёртки) пустое
  // перечисление схлопывается до ~40px и обрезает подпись. Тема задаёт fullWidth
  // только для MuiTextField/MuiPickersTextField, поэтому прочие поля не страдают
  // — они стоят на TextField. Растягиваем контейнер поля, а не сам контрол.
  // variant="filled": голый Select по умолчанию outlined (56px, прозрачный,
  // рамка) и выбивался из темы — все остальные поля идут через filled-стили
  // (белый фон, ~44px, наш лейбл).
  return (
    <DisabledReasonTooltip reason={reason} block>
      <FormControl
        fullWidth
        variant="filled"
        error={!!f.error}
        required={f.required}
        disabled={!f.enabled}
      >
        {f.label && <InputLabel id={labelId}>{f.label}</InputLabel>}
        <Select
          labelId={f.label ? labelId : undefined}
          label={f.label}
          value={value}
          readOnly={f.readonly}
          IconComponent={f.readonly ? () => null : undefined}
          onChange={(e) => {
            const selectedValue = e.target.value
            const opt = options.find((o) => o.value === selectedValue)
            // SCRUM-308 §9.1: недоступность проверяем В ОБРАБОТЧИКЕ, а не
            // только атрибутом — событие, доставленное мимо MUI, не должно
            // слать команду с погашенной опции.
            if (opt?.disabled === true) return
            const enumValue = opt
              ? {
                  id: opt.id ?? selectedValue,
                  code: opt.code ?? opt.value,
                  presentation: opt.label,
                }
              : {
                  id: selectedValue,
                  code: selectedValue,
                  presentation: selectedValue,
                }
            f.setValue(enumValue)
            f.fireServerEvent('change', enumValue)
          }}
        >
          {options.map((opt) =>
            // SCRUM-308 §3.5: недоступная опция остаётся в списке (удалить —
            // спрятать пробел), не выбирается и объясняет причину. У
            // отключённого пункта pointer-events: none наследуется вложенным
            // span — тултипу нужен явный pointerEvents: auto.
            opt.disabled === true ? (
              <MenuItem key={opt.value} value={opt.value} disabled>
                {opt.disabledReason ? (
                  <Tooltip title={opt.disabledReason}>
                    <span style={{ pointerEvents: 'auto' }}>{opt.label}</span>
                  </Tooltip>
                ) : (
                  opt.label
                )}
              </MenuItem>
            ) : (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            )
          )}
        </Select>
        {/* SCRUM-317 v4 §4.1: текст ошибки живёт в панели и тултипе — под полем только рамка */}
      </FormControl>
    </DisabledReasonTooltip>
  )
}

import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Radio, RadioGroup } from '@mui/material'

import type {
  ReportAltGroupingOptionDto,
  ReportAltGroupingSelectionDto,
} from '../../types/reportalt'

interface SettingsGroupingTabProps {
  /** Предопределённые группировки отчёта (пресеты + тумблеры). */
  options: ReportAltGroupingOptionDto[]
  value: ReportAltGroupingSelectionDto
  onChange: (value: ReportAltGroupingSelectionDto) => void
  isKz: boolean
}

/**
 * Вкладка «Группировка» (settings-design §4.3/§7): выбор из ПРЕДОПРЕДЕЛЁННЫХ
 * группировок — радио для PRESET (взаимоисключающие, «Стандартная» = пресет
 * варианта), чекбоксы для TOGGLE. Свободного конструктора дерева нет.
 */
export const SettingsGroupingTab = ({
  options,
  value,
  onChange,
  isKz,
}: SettingsGroupingTabProps) => {
  const { t } = useTranslation()

  const titleOf = (o: ReportAltGroupingOptionDto): string =>
    (isKz ? o.titleKz : o.titleRu) || o.titleRu

  const presets = options.filter((o) => o.kind === 'PRESET')
  const toggles = options.filter((o) => o.kind === 'TOGGLE')

  return (
    <div className="flex flex-col gap-2">
      {presets.length > 0 && (
        <RadioGroup
          value={value.presetCode ?? ''}
          onChange={(e) => {
            onChange({
              ...value,
              ...(e.target.value === ''
                ? { presetCode: undefined }
                : { presetCode: e.target.value }),
            })
          }}
        >
          <FormControlLabel
            value=""
            control={<Radio size="small" />}
            label={t('reportalt.settings.standardGrouping')}
          />
          {presets.map((o) => (
            <FormControlLabel
              key={o.code}
              value={o.code}
              control={<Radio size="small" />}
              label={titleOf(o)}
            />
          ))}
        </RadioGroup>
      )}

      {toggles.map((o) => (
        <FormControlLabel
          key={o.code}
          control={
            <Checkbox
              size="small"
              checked={value.toggles?.[o.code] === true}
              onChange={(e) => {
                onChange({
                  ...value,
                  toggles: { ...value.toggles, [o.code]: e.target.checked },
                })
              }}
            />
          }
          label={titleOf(o)}
        />
      ))}
    </div>
  )
}

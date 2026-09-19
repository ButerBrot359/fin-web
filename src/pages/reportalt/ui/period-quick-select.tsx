import { MenuItem, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'

import {
  matchPeriodPreset,
  PERIOD_PRESETS,
  periodPresetRange,
  type PeriodPresetCode,
} from '../lib/utils/period-presets'
import type { PeriodValue } from '../lib/utils/params'

interface PeriodQuickSelectProps {
  period: PeriodValue
  onChange: (period: PeriodValue) => void
  disabled?: boolean
}

/**
 * Быстрый выбор периода рядом с парой «с … по …»: месяц, квартал, год одним
 * действием вместо двух дат руками (просьба со стенда 19.09.2026 по форме 4-20).
 *
 * <p>Поля дат остаются рабочими: список — надстройка, произвольный период по-прежнему
 * вводится вручную, и тогда пункт списка просто не выбран
 * (см. {@link matchPeriodPreset}).
 */
export const PeriodQuickSelect = ({
  period,
  onChange,
  disabled,
}: PeriodQuickSelectProps) => {
  const { t } = useTranslation()
  const selected = matchPeriodPreset(period) ?? ''

  return (
    <TextField
      select
      size="small"
      fullWidth
      disabled={disabled}
      label={t('reportalt.period.quickLabel')}
      value={selected}
      onChange={(e) => {
        const code = e.target.value as PeriodPresetCode | ''
        if (!code) return
        onChange(periodPresetRange(code))
      }}
    >
      {PERIOD_PRESETS.map((code) => (
        <MenuItem key={code} value={code}>
          {t(`reportalt.period.${code}`)}
        </MenuItem>
      ))}
    </TextField>
  )
}

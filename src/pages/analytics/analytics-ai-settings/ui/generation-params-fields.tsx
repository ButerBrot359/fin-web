import { Controller, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Slider, Switch, TextField, Typography } from '@mui/material'

import {
  MAX_TOKENS_MAX,
  MAX_TOKENS_MIN,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  TEMPERATURE_STEP,
} from '../lib/consts/providers'
import type { AiSettingsFormValues } from '../lib/utils/ai-settings-schema'
import { MicroLabel } from '@/shared/ui/micro-label'

interface GenerationParamsFieldsProps {
  control: Control<AiSettingsFormValues>
}

/** Ограничение значения диапазоном: инпут не должен уводить форму в невалид. */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * Параметры генерации: температура, лимит токенов и общий выключатель.
 *
 * Температура — слайдер, а не число: диапазон 0..1 он гарантирует физически,
 * поэтому у поля нет состояния ошибки. Лимит токенов зажимается при вводе по
 * той же причине. Значения набраны табличными цифрами — они меняются на месте,
 * и ширина строки не должна прыгать.
 */
export const GenerationParamsFields = ({
  control,
}: GenerationParamsFieldsProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <Controller
        name="temperature"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <MicroLabel>{t('analytics.settings.temperature')}</MicroLabel>
              <Typography variant="body2" className="tabular-nums">
                {field.value.toFixed(1)}
              </Typography>
            </div>
            <Slider
              value={field.value}
              min={TEMPERATURE_MIN}
              max={TEMPERATURE_MAX}
              step={TEMPERATURE_STEP}
              marks
              onChange={(_event, next) => {
                field.onChange(next)
              }}
            />
          </div>
        )}
      />

      <Controller
        name="maxTokens"
        control={control}
        render={({ field }) => (
          <TextField
            type="number"
            label={t('analytics.settings.maxTokens')}
            value={field.value}
            slotProps={{
              htmlInput: {
                min: MAX_TOKENS_MIN,
                max: MAX_TOKENS_MAX,
                step: 256,
                className: 'tabular-nums',
              },
            }}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              field.onChange(
                Number.isFinite(parsed)
                  ? clamp(Math.round(parsed), MAX_TOKENS_MIN, MAX_TOKENS_MAX)
                  : MAX_TOKENS_MIN
              )
            }}
          />
        )}
      />

      <Controller
        name="enabled"
        control={control}
        render={({ field }) => (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md bg-ui-02 py-1.5 pr-2 pl-3">
            <Typography variant="body2">
              {t('analytics.settings.enabled')}
            </Typography>
            <Switch
              checked={field.value}
              onChange={(_event, checked) => {
                field.onChange(checked)
              }}
            />
          </label>
        )}
      />
    </div>
  )
}

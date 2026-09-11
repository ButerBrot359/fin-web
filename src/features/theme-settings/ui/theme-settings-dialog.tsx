import { useState, type FC } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Radio,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { themeApi, themeKeys, type ThemeTokens } from '@/entities/theme'
import {
  THEME_PRESET_TOKEN,
  UI_SCALE_TOKEN,
} from '@/shared/design/apply-server-theme'
import { Button } from '@/shared/ui/buttons'

import {
  THEME_PRESETS,
  UI_SCALE_OPTIONS,
  type ThemePresetId,
} from '@/shared/design/theme-presets'

interface ThemeSettingsDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Диалог «Тема оформления» (конструктор дизайна Ф3): выбор из ГОТОВЫХ тем
 * (решение владельца 10.09 — без RGB-палитры и без экспорта/сброса: тем
 * три, «сброс» — это выбор Стандартной) и масштаб интерфейса. Значения
 * хранит бэк (`/api/theme-settings`), применитель накатывает их на `:root`
 * после инвалидации слитой темы — диалог сам ничего не красит.
 */
export const ThemeSettingsDialog: FC<ThemeSettingsDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: overrides } = useQuery({
    queryKey: ['theme', 'overrides'],
    queryFn: ({ signal }) => themeApi.getOverrides(signal),
    enabled: open,
  })

  const [preset, setPreset] = useState<ThemePresetId>('standard')
  const [scale, setScale] = useState<string>('1')
  // Снимок, из которого заполнены контролы: перезаполняем при приходе НОВЫХ
  // override'ов (открытие диалога), не перетирая выбор внутри него.
  // Подстройка состояния во время рендера, не эффект — без каскадов.
  const [seededFrom, setSeededFrom] = useState<ThemeTokens | null>(null)
  if (open && overrides != null && seededFrom !== overrides) {
    setSeededFrom(overrides)
    const stored = overrides[THEME_PRESET_TOKEN]
    setPreset(
      THEME_PRESETS.some((p) => p.id === stored)
        ? (stored as ThemePresetId)
        : 'standard'
    )
    setScale(overrides[UI_SCALE_TOKEN] ?? '1')
  }

  const buildTokens = (): ThemeTokens => {
    // Ключи, которыми управляют пресеты, пересобираются с нуля; чужие
    // (например, выставленные ИИ-помощником) проходят как есть.
    const presetKeys = new Set(
      THEME_PRESETS.flatMap((p) => Object.keys(p.tokens))
    )
    const tokens: ThemeTokens = Object.fromEntries(
      Object.entries(overrides ?? {}).filter(
        ([key]) =>
          !presetKeys.has(key) &&
          key !== UI_SCALE_TOKEN &&
          key !== THEME_PRESET_TOKEN
      )
    )
    const chosen = THEME_PRESETS.find((p) => p.id === preset)
    if (chosen && preset !== 'standard') {
      Object.assign(tokens, chosen.tokens)
      tokens[THEME_PRESET_TOKEN] = chosen.id
    }
    if (scale !== '1') tokens[UI_SCALE_TOKEN] = scale
    return tokens
  }

  const saveMutation = useMutation({
    mutationFn: (tokens: ThemeTokens) => themeApi.putOverrides(tokens),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: themeKeys.merged() })
      await queryClient.invalidateQueries({ queryKey: ['theme', 'overrides'] })
      onClose()
    },
  })
  const busy = saveMutation.isPending

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{t('themeSettings.title')}</DialogTitle>
      <DialogContent className="flex flex-col gap-3 pt-2">
        <Typography variant="body2">
          {t('themeSettings.description')}
        </Typography>
        {THEME_PRESETS.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-2"
          >
            <Radio
              size="small"
              checked={preset === option.id}
              onChange={() => {
                setPreset(option.id)
              }}
              disabled={busy}
              value={option.id}
              name="theme-preset"
            />
            <span className="flex gap-1">
              {option.swatch.map((color) => (
                <span
                  key={color}
                  className="border-ui-03 h-5 w-5 rounded-full border"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <Typography variant="body2">
              {t(`themeSettings.presets.${option.id}`)}
            </Typography>
          </label>
        ))}
        {/* Подпись слева + select без floating label: плавающая подпись
            проектной темы наезжала на значение (живой дефект 10.09). */}
        <div className="mt-1 flex items-center gap-3">
          <Typography variant="body2" className="min-w-0 flex-1">
            {t('themeSettings.scale')}
          </Typography>
          <TextField
            select
            hiddenLabel
            size="small"
            value={scale}
            onChange={(e) => {
              setScale(e.target.value)
            }}
            disabled={busy}
            sx={{ width: 200 }}
          >
            {UI_SCALE_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {t(`themeSettings.scaleOptions.${option}`)}
              </MenuItem>
            ))}
          </TextField>
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t('themeSettings.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            saveMutation.mutate(buildTokens())
          }}
          disabled={busy || overrides == null}
        >
          {t('themeSettings.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

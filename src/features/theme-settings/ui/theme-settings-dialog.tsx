import { useRef, useState, type FC } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { themeApi, themeKeys, type ThemeTokens } from '@/entities/theme'
import { UI_SCALE_TOKEN } from '@/shared/design/apply-server-theme'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

import {
  EDITABLE_THEME_TOKENS,
  UI_SCALE_OPTIONS,
} from '../lib/consts/editable-tokens'
import {
  downloadThemeSettings,
  parseThemeSettingsFile,
} from '../lib/theme-transfer'

interface ThemeSettingsDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Диалог «Тема оформления» (конструктор дизайна Ф3): пер-пользовательские
 * override'ы токенов + масштаб интерфейса, экспорт/импорт файлом. Значения
 * хранит бэк (`/api/theme-settings`), применитель накатывает их на `:root`
 * после инвалидации слитой темы — диалог сам ничего не красит.
 */
export const ThemeSettingsDialog: FC<ThemeSettingsDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { data: overrides } = useQuery({
    queryKey: ['theme', 'overrides'],
    queryFn: ({ signal }) => themeApi.getOverrides(signal),
    enabled: open,
  })

  const [colors, setColors] = useState<Record<string, string>>({})
  const [scale, setScale] = useState<string>('1')
  // Снимок, из которого заполнены контролы: перезаполняем при приходе НОВЫХ
  // override'ов (открытие, сброс), не перетирая правки внутри диалога.
  // Подстройка состояния во время рендера — паттерн React «adjusting state
  // when props change», эффект здесь был бы каскадным ре-рендером.
  const [seededFrom, setSeededFrom] = useState<ThemeTokens | null>(null)
  if (open && overrides != null && seededFrom !== overrides) {
    setSeededFrom(overrides)
    const next: Record<string, string> = {}
    for (const token of EDITABLE_THEME_TOKENS) {
      next[token.key] = overrides[token.key] ?? token.defaultValue
    }
    setColors(next)
    setScale(overrides[UI_SCALE_TOKEN] ?? '1')
  }

  const buildTokens = (): ThemeTokens => {
    // Пересборка без delete: чужие ключи (агентские) проходят как есть,
    // редактируемые — только когда отличаются от дефолта реестра.
    const editableKeys = new Set(EDITABLE_THEME_TOKENS.map((t) => t.key))
    const tokens: ThemeTokens = Object.fromEntries(
      Object.entries(overrides ?? {}).filter(
        ([key]) => !editableKeys.has(key) && key !== UI_SCALE_TOKEN
      )
    )
    for (const token of EDITABLE_THEME_TOKENS) {
      const value = colors[token.key]
      // Значение, равное дефолту реестра, не храним — это «не переопределено».
      if (value && value.toLowerCase() !== token.defaultValue.toLowerCase()) {
        tokens[token.key] = value
      }
    }
    if (scale !== '1') tokens[UI_SCALE_TOKEN] = scale
    return tokens
  }

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: themeKeys.merged() })
    await queryClient.invalidateQueries({ queryKey: ['theme', 'overrides'] })
    onClose()
  }

  const saveMutation = useMutation({
    mutationFn: (tokens: ThemeTokens) => themeApi.putOverrides(tokens),
    onSuccess: finish,
  })
  const resetMutation = useMutation({
    mutationFn: () => themeApi.reset(),
    onSuccess: finish,
  })
  const busy = saveMutation.isPending || resetMutation.isPending

  const importFile = async (file: File) => {
    try {
      const imported = parseThemeSettingsFile(await file.text())
      await themeApi.putOverrides(imported)
      await finish()
    } catch (error) {
      showToast(
        'error',
        error instanceof Error ? error.message : t('themeSettings.importFailed')
      )
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{t('themeSettings.title')}</DialogTitle>
      <DialogContent className="flex flex-col gap-4 pt-2">
        <Typography variant="body2">
          {t('themeSettings.description')}
        </Typography>
        {EDITABLE_THEME_TOKENS.map((token) => (
          <div key={token.key} className="flex items-center gap-3">
            <Typography variant="body2" className="min-w-0 flex-1">
              {t(`themeSettings.tokens.${token.labelKey}`)}
            </Typography>
            <input
              type="color"
              value={colors[token.key] ?? token.defaultValue}
              onChange={(e) => {
                setColors((current) => ({
                  ...current,
                  [token.key]: e.target.value,
                }))
              }}
              disabled={busy}
              aria-label={t(`themeSettings.tokens.${token.labelKey}`)}
              className="h-8 w-12 cursor-pointer"
            />
          </div>
        ))}
        <TextField
          select
          size="small"
          label={t('themeSettings.scale')}
          value={scale}
          onChange={(e) => {
            setScale(e.target.value)
          }}
          disabled={busy}
        >
          {UI_SCALE_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`themeSettings.scaleOptions.${option}`)}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importFile(file)
          }}
        />
        <Button
          variant="tertiary"
          onClick={() => {
            downloadThemeSettings(buildTokens())
          }}
          disabled={busy}
        >
          {t('themeSettings.export')}
        </Button>
        <Button
          variant="tertiary"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {t('themeSettings.import')}
        </Button>
        <Button
          variant="tertiary"
          onClick={() => {
            resetMutation.mutate()
          }}
          disabled={busy}
        >
          {t('themeSettings.reset')}
        </Button>
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

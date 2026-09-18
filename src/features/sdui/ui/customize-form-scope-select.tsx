import type { FC } from 'react'
import { MenuItem, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { ViewSettingsProfile } from '../api/view-settings-profile-defaults-api'

/** Значение пункта «Для всех» в селекте слоя (см. комментарий у TextField). */
const ALL_SCOPE = '__all__'

interface CustomizeFormScopeSelectProps {
  /** Текущий слой: '' — «для всех», иначе код профиля групп доступа. */
  profile: string
  profiles: ViewSettingsProfile[] | undefined
  busy: boolean
  onChange: (profile: string) => void
}

/**
 * Выбор слоя режима «для всех» (Ф5, пер-ролевые дефолты): общий дефолт или
 * профиль групп доступа — плюс предупреждение, на кого повлияет сохранение.
 */
export const CustomizeFormScopeSelect: FC<CustomizeFormScopeSelectProps> = ({
  profile,
  profiles,
  busy,
  onChange,
}) => {
  const { t } = useTranslation()

  return (
    <>
      {/* Сентинел вместо '': MUI трактует пустую строку как «ничего не
          выбрано» и не показывает пункт «Для всех» выбранным. */}
      <TextField
        select
        label={t('sdui.customizeForm.defaultScope')}
        value={profile === '' ? ALL_SCOPE : profile}
        onChange={(e) => {
          onChange(e.target.value === ALL_SCOPE ? '' : e.target.value)
        }}
        disabled={busy}
        className="max-w-xs"
      >
        <MenuItem value={ALL_SCOPE}>
          {t('sdui.customizeForm.defaultScopeAll')}
        </MenuItem>
        {(profiles ?? []).map((p) => (
          <MenuItem key={p.code} value={p.code}>
            {p.name ?? p.code}
          </MenuItem>
        ))}
      </TextField>
      <Typography variant="body2" className="text-support-01">
        {profile === ''
          ? t('sdui.customizeForm.defaultWarning')
          : t('sdui.customizeForm.defaultRoleWarning', {
              name: profiles?.find((p) => p.code === profile)?.name ?? profile,
            })}
      </Typography>
    </>
  )
}

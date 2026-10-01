import type { FC } from 'react'
import { MenuItem, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { menuSettingsApi, type MenuScope } from '../../api/menu-settings-api'

interface MenuScopeSelectProps {
  scope: MenuScope
  busy: boolean
  onChange: (scope: MenuScope) => void
}

/**
 * Выбор уровня настройки меню (SCRUM-426 §4.2): Моё меню / Для всех / Роль /
 * Пользователь. Показывается только обладателям права «Настройка меню» —
 * остальным редактор фиксирован на личном слое.
 */
export const MenuScopeSelect: FC<MenuScopeSelectProps> = ({
  scope,
  busy,
  onChange,
}) => {
  const { t } = useTranslation()

  const { data: profiles } = useQuery({
    queryKey: ['menu-settings-profiles'],
    queryFn: ({ signal }) => menuSettingsApi.profiles(signal),
  })
  const { data: users } = useQuery({
    queryKey: ['menu-settings-users'],
    queryFn: ({ signal }) => menuSettingsApi.users(signal),
  })

  return (
    <div className="flex flex-wrap items-center gap-4">
      <TextField
        select
        size="small"
        label={t('sdui.menuSettings.scopeLabel')}
        value={scope.kind}
        onChange={(e) => {
          const kind = e.target.value
          if (kind === 'my' || kind === 'global') {
            onChange({ kind })
          } else if (kind === 'profile') {
            onChange({ kind, profileKey: profiles?.[0]?.key ?? '' })
          } else if (kind === 'user') {
            onChange({ kind, userKey: users?.[0]?.key ?? '' })
          }
        }}
        disabled={busy}
        className="w-56"
      >
        <MenuItem value="my">{t('sdui.menuSettings.scopeMy')}</MenuItem>
        <MenuItem value="global">{t('sdui.menuSettings.scopeGlobal')}</MenuItem>
        <MenuItem value="profile">
          {t('sdui.menuSettings.scopeProfile')}
        </MenuItem>
        <MenuItem value="user">{t('sdui.menuSettings.scopeUser')}</MenuItem>
      </TextField>
      {scope.kind === 'profile' && (
        <TextField
          select
          size="small"
          label={t('sdui.menuSettings.profileLabel')}
          value={scope.profileKey}
          onChange={(e) => {
            onChange({ kind: 'profile', profileKey: e.target.value })
          }}
          disabled={busy}
          className="w-72"
        >
          {(profiles ?? []).map((p) => (
            <MenuItem key={p.key} value={p.key}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {scope.kind === 'user' && (
        <TextField
          select
          size="small"
          label={t('sdui.menuSettings.userLabel')}
          value={scope.userKey}
          onChange={(e) => {
            onChange({ kind: 'user', userKey: e.target.value })
          }}
          disabled={busy}
          className="w-72"
        >
          {(users ?? []).map((u) => (
            <MenuItem key={u.key} value={u.key}>
              {u.name}
            </MenuItem>
          ))}
        </TextField>
      )}
    </div>
  )
}

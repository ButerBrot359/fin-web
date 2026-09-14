import { useState, type FC } from 'react'
import { MenuItem, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  viewSettingsDefaultsApi,
  viewSettingsProfileDefaultsApi,
  type ViewSettingsProfile,
  type ViewSettingsScreen,
} from '@/features/sdui'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

interface ScreenCardProps {
  screen: ViewSettingsScreen
  profiles: ViewSettingsProfile[]
  onEdit: (profile: string) => void
}

/**
 * Карточка выбранной формы в админке: настроенные слои со сбросом и запуск
 * редактора для выбранного слоя («Для всех» или роль).
 */
export const ScreenCard: FC<ScreenCardProps> = ({
  screen,
  profiles,
  onEdit,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [profile, setProfile] = useState('')

  const profileName = (key: string) =>
    profiles.find((p) => p.code === key)?.name ?? key

  const resetMutation = useMutation({
    mutationFn: (layer: string) =>
      layer === ''
        ? viewSettingsDefaultsApi.reset(screen.code)
        : viewSettingsProfileDefaultsApi.reset(screen.code, layer),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['view-settings-admin-screens'],
      })
    },
    onError: () => {
      showToast('error', t('sdui.designAdmin.resetFailed'))
    },
  })

  const layers = [...(screen.hasDefault ? [''] : []), ...screen.profileKeys]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Typography variant="h6">{screen.nameRu ?? screen.code}</Typography>
        <Typography variant="caption" className="text-ui-05">
          {screen.code}
        </Typography>
      </div>

      <div className="flex flex-col gap-2">
        <Typography variant="body2" className="font-medium">
          {t('sdui.designAdmin.layersTitle')}
        </Typography>
        {layers.length === 0 && (
          <Typography variant="body2" className="text-ui-05">
            {t('sdui.designAdmin.noLayers')}
          </Typography>
        )}
        {layers.map((layer) => (
          <div
            key={layer === '' ? '::all' : layer}
            className="flex items-center justify-between gap-4 rounded-lg border border-solid border-divider px-4 py-2"
          >
            <Typography variant="body2">
              {layer === ''
                ? t('sdui.designAdmin.layerAll')
                : profileName(layer)}
            </Typography>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="tertiary"
                disabled={resetMutation.isPending}
                onClick={() => {
                  resetMutation.mutate(layer)
                }}
              >
                {t('sdui.designAdmin.resetLayer')}
              </Button>
              <Button
                variant="tertiary"
                onClick={() => {
                  onEdit(layer)
                }}
              >
                {t('sdui.designAdmin.editLayer')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <TextField
          select
          size="small"
          label={t('sdui.designAdmin.editFor')}
          value={profile}
          onChange={(e) => {
            setProfile(e.target.value)
          }}
          className="min-w-64"
        >
          <MenuItem value="">{t('sdui.designAdmin.layerAll')}</MenuItem>
          {profiles.map((p) => (
            <MenuItem key={p.code} value={p.code}>
              {p.name ?? p.code}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="primary"
          onClick={() => {
            onEdit(profile)
          }}
        >
          {t('sdui.designAdmin.edit')}
        </Button>
      </div>
    </div>
  )
}

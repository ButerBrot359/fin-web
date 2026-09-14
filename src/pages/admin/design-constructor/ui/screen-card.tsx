import type { FC } from 'react'
import { Typography } from '@mui/material'
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
 * Карточка выбранной формы в админке: один список слоёв — «Для всех» и каждая
 * роль — со статусом «настроено». «Настроить»/«Изменить» открывает редактор
 * формы для этого слоя, «Сбросить» удаляет слой. Никаких отдельных селектов:
 * весь флоу — выбрал форму → выбрал строку → настроил.
 */
export const ScreenCard: FC<ScreenCardProps> = ({
  screen,
  profiles,
  onEdit,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

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

  const rows = [
    {
      key: '',
      name: t('sdui.designAdmin.layerAll'),
      configured: screen.hasDefault,
    },
    ...profiles.map((p) => ({
      key: p.code,
      name: p.name ?? p.code,
      configured: screen.profileKeys.includes(p.code),
    })),
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <Typography variant="h6">{screen.nameRu ?? screen.code}</Typography>
        <Typography variant="body2" className="text-ui-05">
          {t('sdui.designAdmin.cardHint')}
        </Typography>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 pr-2">
          {rows.map((row) => (
            <div
              key={row.key === '' ? '::all' : row.key}
              className="flex items-center justify-between gap-4 rounded-lg border border-solid border-divider px-4 py-2"
            >
              <div className="min-w-0">
                <Typography variant="body2" className="truncate font-medium">
                  {row.name}
                </Typography>
                {row.configured && (
                  <Typography variant="caption" className="text-ui-05">
                    {t('sdui.designAdmin.configured')}
                  </Typography>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {row.configured && (
                  <Button
                    variant="tertiary"
                    disabled={resetMutation.isPending}
                    onClick={() => {
                      resetMutation.mutate(row.key)
                    }}
                  >
                    {t('sdui.designAdmin.resetLayer')}
                  </Button>
                )}
                <Button
                  variant={row.configured ? 'tertiary' : 'primary'}
                  onClick={() => {
                    onEdit(row.key)
                  }}
                >
                  {row.configured
                    ? t('sdui.designAdmin.editLayer')
                    : t('sdui.designAdmin.configure')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useEffect, type FC } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  resetAdminCustomizeAutoOpen,
  viewSettingsAdminApi,
  viewSettingsProfileDefaultsApi,
  type ViewSettingsScreen,
} from '@/features/sdui'

import { ScreenCard } from './screen-card'

/**
 * Админка конструктора дизайна: реестр всех форм системы со сводкой слоёв
 * («для всех» / роли), сбросы и вход во встроенный редактор формы. Реестр
 * отдаётся только административным ролям — остальным показывается заглушка.
 */
export const DesignConstructorPage: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Поиск и выбранная форма живут в URL (replace, без мусора в истории):
  // возврат «назад» из редактора восстанавливает открытую карточку с ролями —
  // иначе каждую следующую роль пришлось бы искать заново.
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const selectedCode = searchParams.get('screen')

  const setParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === '') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true }
    )
  }

  // Вход в админку сбрасывает «уже открывали» автозапуска редактора: без
  // этого повторный клик по той же форме и слою не открыл бы диалог.
  useEffect(() => {
    resetAdminCustomizeAutoOpen()
  }, [])

  /** Открывает реальную форму с автозапуском диалога настройки слоя. */
  const editLayer = (screen: ViewSettingsScreen, profile: string) => {
    if (screen.targetTypeCode == null) return
    void navigate(
      `/documents/${screen.targetTypeCode}/new?adminCustomize=${encodeURIComponent(profile === '' ? 'all' : profile)}`
    )
  }

  const {
    data: screens,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['view-settings-admin-screens'],
    queryFn: ({ signal }) => viewSettingsAdminApi.screens(signal),
    // Возврат из редактора должен показать свежие бейджи слоёв.
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: profiles } = useQuery({
    queryKey: ['view-settings-profiles'],
    queryFn: ({ signal }) => viewSettingsProfileDefaultsApi.profiles(signal),
  })

  if (error != null) {
    return (
      <div className="p-8">
        <Typography variant="body1">
          {t('sdui.designAdmin.forbidden')}
        </Typography>
      </div>
    )
  }

  const needle = search.trim().toLowerCase()
  const filtered = (screens ?? []).filter(
    (s) =>
      needle === '' ||
      (s.nameRu ?? '').toLowerCase().includes(needle) ||
      s.code.toLowerCase().includes(needle)
  )
  const selected = filtered.find((s) => s.code === selectedCode) ?? null

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div>
        <Typography variant="h5">{t('sdui.designAdmin.title')}</Typography>
        <Typography variant="body2" className="text-ui-05">
          {t('sdui.designAdmin.subtitle')}
        </Typography>
      </div>
      <div className="flex min-h-0 flex-1 gap-8">
        <div className="flex w-96 shrink-0 flex-col gap-3">
          <TextField
            size="small"
            placeholder={t('sdui.designAdmin.search')}
            value={search}
            onChange={(e) => {
              setParam('q', e.target.value)
            }}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1 pr-2">
              {isLoading && (
                <Typography variant="body2" className="text-ui-05">
                  {t('sdui.designAdmin.loading')}
                </Typography>
              )}
              {filtered.map((screen) => {
                const layerCount =
                  (screen.hasDefault ? 1 : 0) + screen.profileKeys.length
                const isSelected = screen.code === selectedCode
                return (
                  <button
                    key={screen.code}
                    type="button"
                    onClick={() => {
                      setParam('screen', screen.code)
                    }}
                    className={`flex items-center justify-between gap-2 rounded-lg border border-solid px-4 py-2 text-left ${
                      isSelected
                        ? 'border-interactive-01 bg-selection'
                        : 'border-divider bg-ui-01'
                    }`}
                  >
                    <Typography variant="body2" className="truncate">
                      {screen.nameRu ?? screen.code}
                    </Typography>
                    {layerCount > 0 && (
                      <Typography
                        variant="caption"
                        className="shrink-0 text-ui-05"
                      >
                        {t('sdui.designAdmin.layersBadge', {
                          count: layerCount,
                        })}
                      </Typography>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {selected == null ? (
            <Typography variant="body2" className="text-ui-05">
              {t('sdui.designAdmin.selectHint')}
            </Typography>
          ) : (
            <ScreenCard
              screen={selected}
              profiles={profiles ?? []}
              onEdit={(profile) => {
                editLayer(selected, profile)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

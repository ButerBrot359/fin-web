import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Button, Paper, Typography } from '@mui/material'
import { useDictionaryPermissionsCopy } from '@/pages/analytics/analytics-dictionary-permissions/lib/copy'

import { useAiSettings } from '@/entities/analytics'
import {
  AiDisclosurePanel,
  AnalyticsSurfaceForm,
  AssistantSettingsForm,
} from '@/features/ai-assistant'
import { AiConnectionsPanel } from '@/features/ai-connections'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

/**
 * Страница «Настройки ИИ» раздела «Аналитика».
 *
 * Ошибка загрузки страницу не блокирует: форма разворачивается на значениях по
 * умолчанию, и настройки можно завести с нуля — иначе организация без записи в
 * `analytics_ai_settings` не смогла бы включить ассистента вообще.
 */
export const AnalyticsAiSettingsPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode } = useParams()
  const { copy } = useDictionaryPermissionsCopy()
  const location = useLocation()

  useTabMeta(t('analytics.settings.title'))

  const { isLoading } = useAiSettings()

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate('/')
  }

  if (isLoading) return <PageSkeleton />

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-ui-02 pt-5 pb-6">
      <PageHeader title={t('analytics.settings.title')} onClose={handleClose} />

      {/* Две колонки: настройки слева, раскрытие «что уходит в ИИ» справа.
          Раньше раскрытие занимало всю ширину сверху и уводило сами настройки за
          пределы экрана — решение о провайдере принимается, ГЛЯДЯ на то, какие
          данные ему достанутся, а не вспоминая прочитанное выше.

          На узком экране колонки складываются в одну, и раскрытие снова идёт
          первым: без места для двух колонок порядок «сначала прочитай» остаётся
          единственным способом показать цену выбора до самого выбора. */}
      <div className="flex w-full flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex w-full min-w-0 flex-col gap-4 xl:max-w-[720px]">
          <Typography variant="body2" className="text-ui-05">
            {t('analytics.settings.subtitle')}
          </Typography>

          {/* Подключения — первыми: контуры ниже выбирают из уже заведённых,
              и порядок на экране повторяет порядок действий. */}
          <AiConnectionsPanel />

          <AnalyticsSurfaceForm />
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ flex: '1 1 240px' }}>
                <Typography fontWeight={700}>{copy.title}</Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1, lineHeight: 1.7 }}
                >
                  {copy.cardHint}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                data-testid="dictionary-permissions-settings-link"
                onClick={() => {
                  void navigate(
                    pageCode
                      ? `/modules/${pageCode}/analytics/dictionary-permissions`
                      : '/analytics/dictionary-permissions'
                  )
                }}
              >
                {copy.open} →
              </Button>
            </Box>
          </Paper>

          <AssistantSettingsForm />
        </div>

        {/* Липкая: настройки длиннее раскрытия, и при прокрутке к галочкам
            предупреждение должно оставаться перед глазами. */}
        <div className="w-full min-w-0 xl:sticky xl:top-5 xl:w-[26rem] xl:shrink-0">
          <AiDisclosurePanel />
        </div>
      </div>
    </div>
  )
}

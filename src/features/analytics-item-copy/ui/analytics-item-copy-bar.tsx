import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { useCopyAnalyticsItem } from '@/entities/analytics'
import type { AnalyticsItem } from '@/entities/analytics'
import { extractErrorText } from '@/features/analytics-assistant'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

interface AnalyticsItemCopyBarProps {
  item: AnalyticsItem
}

export const AnalyticsItemCopyBar = ({ item }: AnalyticsItemCopyBarProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode = '' } = useParams()
  const { mutate, isPending } = useCopyAnalyticsItem()

  const handleCopy = () => {
    mutate(item.code, {
      onSuccess: (copy) => {
        showToast('success', t('analytics.item.copied'))
        void navigate(
          pageCode
            ? `/modules/${pageCode}/analytics/${copy.code}`
            : `/analytics/${copy.code}`
        )
      },
      onError: (error: unknown) => {
        showToast(
          'error',
          extractErrorText(error) ?? t('errors.somethingWentWrong')
        )
      },
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      {item.shared && (
        <Typography
          variant="body2"
          className="rounded-sm bg-ui-04 px-2 py-0.5 text-ui-06"
          title={t('analytics.item.sharedHint')}
        >
          {t('analytics.item.shared')}
        </Typography>
      )}
      <Button size="small" disabled={isPending} onClick={handleCopy}>
        {t('analytics.item.copy')}
      </Button>
    </div>
  )
}

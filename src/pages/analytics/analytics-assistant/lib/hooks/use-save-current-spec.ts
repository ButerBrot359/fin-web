import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useSaveAnalyticsItem } from '@/entities/analytics'
import type { AnalyticsItem, AnalyticsSpec } from '@/entities/analytics'
import { extractErrorText } from '@/features/analytics-assistant'
import type { SaveItemValues } from '@/features/analytics-assistant'
import { showToast } from '@/shared/ui/toast/show-toast'

interface SaveCurrentSpec {
  save: (values: SaveItemValues, onDone: () => void) => void
  isPending: boolean
}

/**
 * Сохранение построенного ассистентом представления в раздел «Аналитика» и
 * переход на сохранённый объект. Промпт уходит вместе со спекой — он попадает
 * в историю версий и объясняет, откуда взялось представление.
 */
export const useSaveCurrentSpec = (
  spec: AnalyticsSpec | null,
  prompt: string | null
): SaveCurrentSpec => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode = '' } = useParams()
  const { mutate, isPending } = useSaveAnalyticsItem()

  const save = useCallback(
    (values: SaveItemValues, onDone: () => void) => {
      if (!spec) return
      mutate(
        {
          kind: spec.kind,
          titleRu: values.titleRu,
          titleKz: values.titleKz || null,
          description: values.description || null,
          spec,
          prompt,
        },
        {
          onSuccess: (item: AnalyticsItem) => {
            showToast('success', t('analytics.item.saved'))
            onDone()
            void navigate(`/modules/${pageCode}/analytics/${item.code}`)
          },
          onError: (error: unknown) => {
            showToast(
              'error',
              extractErrorText(error) ?? t('errors.somethingWentWrong')
            )
          },
        }
      )
    },
    [mutate, navigate, pageCode, prompt, spec, t]
  )

  return { save, isPending }
}

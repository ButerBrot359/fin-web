import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  postDocumentEntry,
  unpostDocumentEntry,
} from '@/entities/document-entry'
import { openMovementsForEntry } from '@/features/sdui'
import { invalidateDocumentQueries } from '@/shared/lib/query/invalidate-entities'
import { getApiErrorMessage } from '@/shared/lib/utils/get-api-error-message'
import { showToast } from '@/shared/ui/toast/show-toast'

/**
 * Мутации тулбара списка документов — одна реализация для обычного и
 * Tabel-режимов (провести, отменить проведение, движения). Ошибка показывает
 * серверный текст, если он есть, иначе — общий ключ.
 */
export function useToolbarMutations() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const post = useMutation({
    mutationFn: (id: number) => postDocumentEntry(id),
    onSuccess: () => {
      invalidateDocumentQueries(queryClient)
      showToast('success', t('documentListToolbar.postSuccess'))
    },
    onError: (error) => {
      showToast(
        'error',
        getApiErrorMessage(error) ?? t('documentListToolbar.postError')
      )
    },
  })

  const unpost = useMutation({
    mutationFn: (id: number) => unpostDocumentEntry(id),
    onSuccess: () => {
      invalidateDocumentQueries(queryClient)
      showToast('success', t('documentListToolbar.unpostSuccess'))
    },
    onError: (error) => {
      showToast(
        'error',
        getApiErrorMessage(error) ?? t('documentListToolbar.unpostError')
      )
    },
  })

  // ДтКт/«Отчёты»: движения открываются SDUI workspace-вкладкой (паритет с
  // формой), legacy-роут .../movements больше не используется.
  const movements = useMutation({
    mutationFn: (id: number) => openMovementsForEntry(String(id)),
    onError: (error) => {
      showToast(
        'error',
        getApiErrorMessage(error) ?? t('documentListToolbar.movementsError')
      )
    },
  })

  return { post, unpost, movements }
}

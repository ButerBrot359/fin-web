import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  createAccountPlanEntry,
  updateAccountPlanEntry,
  type AccountPlanCreatePayload,
} from '@/entities/account-plan'
import { showToast } from '@/shared/ui/toast/show-toast'

interface UseAccountPlanEntryActionsParams {
  entryId: string | undefined
  /** Колбэк после успешного create — обычно навигация на карточку с новым id. */
  onCreated?: (id: number) => void
  /** Колбэк после успешного update — обычно переход в view-режим. */
  onUpdated?: () => void
}

/**
 * Мутации сохранения карточки + общий toast/invalidate.
 * Аналог `use-document-entry-actions.ts` — выносим из страницы, чтобы
 * keep handler logic из UI-компонента.
 */
export const useAccountPlanEntryActions = ({
  entryId,
  onCreated,
  onUpdated,
}: UseAccountPlanEntryActionsParams) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: ['account-plan', 'list'] })
  }

  const createMutation = useMutation({
    mutationFn: (payload: AccountPlanCreatePayload) =>
      createAccountPlanEntry(payload),
    onSuccess: (res) => {
      invalidateList()
      showToast('success', t('accountPlan.saved'))
      onCreated?.(res.data.data.id)
    },
    onError: () => {
      showToast('error', t('accountPlan.saveError'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: AccountPlanCreatePayload) =>
      updateAccountPlanEntry(entryId!, payload),
    onSuccess: () => {
      invalidateList()
      void queryClient.invalidateQueries({
        queryKey: ['account-plan', 'item', entryId],
      })
      showToast('success', t('accountPlan.saved'))
      onUpdated?.()
    },
    onError: () => {
      showToast('error', t('accountPlan.saveError'))
    },
  })

  return {
    createMutation,
    updateMutation,
    isSaving: createMutation.isPending || updateMutation.isPending,
  }
}

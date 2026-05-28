import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  createAccountPlanEntry,
  updateAccountPlanEntry,
  type AccountPlanEntryPayload,
} from '@/entities/account-plan'
import { showToast } from '@/shared/ui/toast/show-toast'

interface UseAccountPlanEntryActionsParams {
  entryId: string | undefined
  typeCode: string
  onCreated?: (id: number) => void
  onUpdated?: () => void
}

export const useAccountPlanEntryActions = ({
  entryId,
  typeCode,
  onCreated,
  onUpdated,
}: UseAccountPlanEntryActionsParams) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: ['account-plan', 'list'] })
  }

  const createMutation = useMutation({
    mutationFn: (payload: AccountPlanEntryPayload) =>
      createAccountPlanEntry(typeCode, payload),
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
    mutationFn: (payload: AccountPlanEntryPayload) =>
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

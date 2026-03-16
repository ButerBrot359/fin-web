import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'

import {
  createDocumentEntry,
  type CreateDocumentEntryPayload,
} from '@/entities/document-entry'
import { showToast } from '@/shared/ui/toast/show-toast'

interface UseDocumentEntryActionsParams {
  isNew: boolean
  form: UseFormReturn<Record<string, unknown>>
}

export const useDocumentEntryActions = ({
  isNew,
  form,
}: UseDocumentEntryActionsParams) => {
  const { moduleCode = '', pageCode = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { mutate } = useMutation({
    mutationFn: (payload: CreateDocumentEntryPayload) =>
      createDocumentEntry(moduleCode, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['document-entries', moduleCode],
      })
    },
  })

  const buildPayload = useCallback(
    (isPosted: boolean): CreateDocumentEntryPayload => ({
      code: '',
      nameRu: '',
      nameKz: '',
      parentId: null,
      sortOrder: 0,
      isPosted,
      attributes: form.getValues(),
    }),
    [form]
  )

  const submitWith = useCallback(
    (isPosted: boolean, onSuccess: (entry: { id: number }) => void) => {
      void form.handleSubmit(() => {
        mutate(buildPayload(isPosted), {
          onSuccess: (response) => {
            onSuccess(response.data.data as { id: number })
          },
          onError: () => {
            showToast(
              'error',
              t(
                isPosted ? 'documentEntry.postError' : 'documentEntry.saveError'
              )
            )
          },
        })
      })()
    },
    [form, mutate, buildPayload, t]
  )

  const handleSave = useCallback(() => {
    submitWith(false, (entry) => {
      showToast('info', t('documentEntry.saved'))
      if (isNew) {
        void navigate(
          `/modules/${pageCode}/document/${moduleCode}/${String(entry.id)}`,
          { replace: true }
        )
      }
    })
  }, [submitWith, isNew, navigate, pageCode, moduleCode, t])

  const handlePost = useCallback(() => {
    submitWith(true, (entry) => {
      showToast('info', t('documentEntry.posted'))
      if (isNew) {
        void navigate(
          `/modules/${pageCode}/document/${moduleCode}/${String(entry.id)}`,
          { replace: true }
        )
      }
    })
  }, [submitWith, isNew, navigate, pageCode, moduleCode, t])

  const handlePostAndClose = useCallback(() => {
    submitWith(true, () => {
      showToast('info', t('documentEntry.posted'))
      void navigate(`/modules/${pageCode}/document/${moduleCode}`)
    })
  }, [submitWith, navigate, pageCode, moduleCode, t])

  return { handleSave, handlePost, handlePostAndClose }
}

import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'

import {
  createDocumentEntry,
  updateDocumentEntry,
} from '@/entities/document-entry/api/document-entry'
import type {
  CreateDocumentEntryPayload,
  DocumentEntry,
} from '@/entities/document-entry'
import type { DocumentAttribute } from '@/entities/document-type'
import { showToast } from '@/shared/ui/toast/show-toast'

import { serializeTableRows } from '../utils/serialize-table-rows'

interface UseDocumentEntryActionsParams {
  isNew: boolean
  existingEntry: DocumentEntry | null
  form: UseFormReturn<Record<string, unknown>>
  attributes: DocumentAttribute[]
}

export const useDocumentEntryActions = ({
  isNew,
  existingEntry,
  form,
  attributes,
}: UseDocumentEntryActionsParams) => {
  const { moduleCode = '', pageCode = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { mutate: mutateCreate } = useMutation({
    mutationFn: (payload: CreateDocumentEntryPayload) =>
      createDocumentEntry(moduleCode, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['document-entries', moduleCode],
      })
    },
  })

  const { mutate: mutateUpdate } = useMutation({
    mutationFn: (payload: CreateDocumentEntryPayload) =>
      updateDocumentEntry(existingEntry!.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['document-entries', moduleCode],
      })
      void queryClient.invalidateQueries({
        queryKey: ['document-entry', String(existingEntry?.id)],
      })
    },
  })

  const buildCreatePayload = useCallback(
    (isPosted: boolean): CreateDocumentEntryPayload => ({
      code: '',
      nameRu: '',
      nameKz: '',
      parentId: null,
      sortOrder: 0,
      isPosted,
      attributes: serializeTableRows(form.getValues(), attributes),
    }),
    [form, attributes]
  )

  const buildUpdatePayload = useCallback(
    (isPosted: boolean): CreateDocumentEntryPayload => ({
      code: existingEntry?.code ?? '',
      nameRu: existingEntry?.nameRu ?? '',
      nameKz: existingEntry?.nameKz ?? '',
      parentId: existingEntry?.parentId ?? null,
      sortOrder: existingEntry?.sortOrder ?? 0,
      isPosted,
      attributes: serializeTableRows(form.getValues(), attributes),
    }),
    [existingEntry, form, attributes]
  )

  const submitWith = useCallback(
    (isPosted: boolean, onSuccess: (entry: { id: number }) => void) => {
      void form.handleSubmit(() => {
        const payload = isNew
          ? buildCreatePayload(isPosted)
          : buildUpdatePayload(isPosted)
        const mutate = isNew ? mutateCreate : mutateUpdate

        mutate(payload, {
          onSuccess: (response) => {
            form.reset(form.getValues())
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
    [
      form,
      isNew,
      mutateCreate,
      mutateUpdate,
      buildCreatePayload,
      buildUpdatePayload,
      t,
    ]
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

  const handleSaveAndClose = () => {
    submitWith(false, () => {
      showToast('info', t('documentEntry.saved'))
      void navigate(`/modules/${pageCode}/document/${moduleCode}`)
    })
  }

  return { handleSave, handlePost, handlePostAndClose, handleSaveAndClose }
}

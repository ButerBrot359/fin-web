import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'

import {
  createDocumentEntry,
  updateDocumentEntry,
} from '@/entities/document-entry'
import type {
  CreateDocumentEntryPayload,
  DocumentEntry,
} from '@/entities/document-entry'
import type { DocumentAttribute } from '@/entities/document-type'
import { showToast } from '@/shared/ui/toast/show-toast'

import { serializeTableRows } from '../utils/serialize-table-rows'
import {
  getDocumentListPath,
  getDocumentEntryPath,
} from '../utils/get-document-paths'

interface UseDocumentEntryActionsParams {
  isNew: boolean
  existingEntry: DocumentEntry | null
  form: UseFormReturn<Record<string, unknown>>
  attributes: DocumentAttribute[]
}

type SubmitAction = 'save' | 'post' | 'saveAndClose' | 'postAndClose'

const ACTION_CONFIG: Record<
  SubmitAction,
  { isPosted: boolean; shouldClose: boolean }
> = {
  save: { isPosted: false, shouldClose: false },
  post: { isPosted: true, shouldClose: false },
  saveAndClose: { isPosted: false, shouldClose: true },
  postAndClose: { isPosted: true, shouldClose: true },
}

const buildPayload = (
  isPosted: boolean,
  attributes: Record<string, unknown>,
  isNew: boolean,
  existingEntry: DocumentEntry | null
): CreateDocumentEntryPayload => ({
  code: isNew ? '' : (existingEntry?.code ?? ''),
  nameRu: isNew ? '' : (existingEntry?.nameRu ?? ''),
  nameKz: isNew ? '' : (existingEntry?.nameKz ?? ''),
  parentId: isNew ? null : (existingEntry?.parentId ?? null),
  sortOrder: isNew ? 0 : (existingEntry?.sortOrder ?? 0),
  isPosted,
  attributes,
})

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

  const listPath = getDocumentListPath({ pageCode, moduleCode })

  const { mutate } = useMutation({
    mutationFn: (payload: CreateDocumentEntryPayload) =>
      isNew
        ? createDocumentEntry(moduleCode, payload)
        : updateDocumentEntry(existingEntry!.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['document-entries', moduleCode],
      })
      if (!isNew && existingEntry) {
        void queryClient.invalidateQueries({
          queryKey: ['document-entry', String(existingEntry.id)],
        })
      }
    },
  })

  const submitWith = useCallback(
    (action: SubmitAction) => {
      const { isPosted, shouldClose } = ACTION_CONFIG[action]
      const toastKey = isPosted ? 'documentEntry.posted' : 'documentEntry.saved'
      const errorKey = isPosted
        ? 'documentEntry.postError'
        : 'documentEntry.saveError'

      void form.handleSubmit((data) => {
        const serialized = serializeTableRows(data, attributes)
        const payload = buildPayload(isPosted, serialized, isNew, existingEntry)

        mutate(payload, {
          onSuccess: (response) => {
            form.reset(data)
            showToast('info', t(toastKey))
            const entry = response.data.data as { id: number }

            if (shouldClose) {
              void navigate(listPath)
            } else if (isNew) {
              void navigate(
                getDocumentEntryPath({ pageCode, moduleCode }, entry.id),
                { replace: true }
              )
            }
          },
          onError: () => {
            showToast('error', t(errorKey))
          },
        })
      })()
    },
    [
      form,
      isNew,
      existingEntry,
      attributes,
      mutate,
      t,
      navigate,
      listPath,
      pageCode,
      moduleCode,
    ]
  )

  return {
    handleSave: useCallback(() => {
      submitWith('save')
    }, [submitWith]),
    handlePost: useCallback(() => {
      submitWith('post')
    }, [submitWith]),
    handleSaveAndClose: useCallback(() => {
      submitWith('saveAndClose')
    }, [submitWith]),
    handlePostAndClose: useCallback(() => {
      submitWith('postAndClose')
    }, [submitWith]),
  }
}

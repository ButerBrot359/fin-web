import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  createDocumentEntry,
  updateDocumentEntry,
} from '@/entities/document-entry'
import type { CreateDocumentEntryPayload } from '@/entities/document-entry'
import { showToast } from '@/shared/ui/toast/show-toast'

import type {
  SubmitAction,
  UseDocumentEntryActionsParams,
} from '../../types/document-entry-actions'
import { ACTION_CONFIG } from '../consts/action-config'
import { buildPayload } from '../utils/build-payload'
import { serializeTableRows } from '../utils/serialize-table-rows'
import {
  getDocumentListPath,
  getDocumentEntryPath,
} from '../utils/get-document-paths'

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

  const submitWith = (action: SubmitAction) => {
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
  }

  return {
    handleSave: () => {
      submitWith('save')
    },
    handlePost: () => {
      submitWith('post')
    },
    handleSaveAndClose: () => {
      submitWith('saveAndClose')
    },
    handlePostAndClose: () => {
      submitWith('postAndClose')
    },
  }
}

import { useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  createDocumentEntry,
  updateDocumentEntry,
} from '@/entities/document-entry'
import type { CreateDocumentEntryPayload } from '@/entities/document-entry'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { isApiConflictError, isApiTransportError } from '@/shared/api/api-error'
import { getApiErrorMessage } from '@/shared/lib/utils/get-api-error-message'
import { getConflictErrorMessage } from '@/shared/lib/utils/get-conflict-error-message'
import { invalidateDocumentListQueries } from '@/shared/lib/query/invalidate-entities'
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
  const location = useLocation()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const listPath = getDocumentListPath({ pageCode, moduleCode })

  // Какая именно команда сейчас выполняется — тулбар по ней гасит все кнопки
  // записи/проведения и крутит спиннер ровно на нажатой.
  const [pendingAction, setPendingAction] = useState<SubmitAction | null>(null)

  // Ref-страховка от дабл-клика. Состояние React доезжает до кнопок только со
  // следующим рендером, а два клика подряд успевают пройти в одном тике — и
  // тогда уходят ПАРАЛЛЕЛЬНЫЕ PUT, каждый из которых на бэкенде удаляет и
  // пересоздаёт все строки ТЧ (наблюдались дубли документов).
  const inFlightRef = useRef(false)

  const finishSubmit = () => {
    inFlightRef.current = false
    setPendingAction(null)
  }

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: CreateDocumentEntryPayload) =>
      isNew
        ? createDocumentEntry(moduleCode, payload)
        : updateDocumentEntry(existingEntry!.id, payload),
    // Снятие блокировки — на уровне МУТАЦИИ, а не в колбэках конкретного
    // `mutate`: последние React Query пропускает, если у наблюдателя не осталось
    // слушателей, и кнопки могли бы залипнуть заблокированными навсегда.
    onSettled: finishSubmit,
    onSuccess: () => {
      // Свежие списки документов + ссылочные пикеры сразу после сохранения
      // (ключи списков — из use-eav-entries: ['document','entries',…]).
      //
      // Карточку (`['document-entry', entryId]`) здесь НЕ инвалидируем: она —
      // источник изменения, форма ниже ресетится отправленными значениями.
      // Инвалидация попадала по префиксу в активный запрос карточки и тянула
      // повторный полный GET документа сразу после тяжёлого PUT (на ТЧ ~1200
      // строк это второй такой же дорогой round-trip + лишний form.reset и
      // полная перерисовка). Актуальность при повторном открытии карточки
      // обеспечивает refetchOnMount: 'always' в use-document-entry-form.
      invalidateDocumentListQueries(queryClient)
    },
  })

  const submitWith = (action: SubmitAction) => {
    if (inFlightRef.current) return

    const { isPosted, shouldClose } = ACTION_CONFIG[action]
    const toastKey = isPosted ? 'documentEntry.posted' : 'documentEntry.saved'
    const errorKey = isPosted
      ? 'documentEntry.postError'
      : 'documentEntry.saveError'

    inFlightRef.current = true
    setPendingAction(action)

    void form.handleSubmit(
      (data) => {
        let payload: CreateDocumentEntryPayload
        try {
          const serialized = serializeTableRows(data, attributes)
          payload = buildPayload(isPosted, serialized, isNew, existingEntry)
        } catch (error) {
          // Сборка payload упала — запрос не уйдёт и `onSettled` мутации не
          // сработает: снимаем блокировку сами, иначе кнопки залипнут.
          finishSubmit()
          showToast('error', t(errorKey), getApiErrorMessage(error))
          return
        }

        mutate(payload, {
          onSuccess: (response) => {
            form.reset(data)
            showToast('info', t(toastKey))
            const entry = response.data.data as { id: number }

            if (shouldClose) {
              useWorkspaceTabsStore.getState().closeTab(location.pathname)
              void navigate(listPath)
            } else if (isNew) {
              void navigate(
                getDocumentEntryPath({ pageCode, moduleCode }, entry.id),
                { replace: true }
              )
            }
          },
          onError: (error) => {
            // 409 (SCRUM-330): объект занят другим пользователем/фоновой
            // задачей либо доменная блокировка — POST/PUT с isPosted тоже её
            // ловит. Правки целы, форма не сбрасывается — warning с текстом
            // бэка «кем занято», пользователь повторяет той же кнопкой.
            if (isApiConflictError(error)) {
              showToast('warning', getConflictErrorMessage(error))
              return
            }

            // Обрыв транспорта ≠ отказ сервера: запись/проведение приняты и
            // ПРОДОЛЖАЮТСЯ в транзакции, документ может успешно провестись уже
            // после того, как ingress разорвал соединение. Показывать «Ошибка
            // сохранения» здесь вредно — пользователь жмёт кнопку повторно и
            // получает дубль.
            if (isApiTransportError(error)) {
              showToast(
                'warning',
                t('documentEntry.stillRunningTitle'),
                t('documentEntry.stillRunningHint')
              )
              return
            }

            // Обычная ошибка с телом (валидация заполнения и т.п.) — как раньше.
            showToast('error', t(errorKey), getApiErrorMessage(error))
          },
        })
      },
      () => {
        // Клиентская валидация не прошла — запроса не будет, снимаем блокировку.
        finishSubmit()
      }
    )()
  }

  return {
    // Мутация может остаться в полёте даже если локальное состояние сброшено —
    // блокируем кнопки по объединённому признаку.
    isSubmitting: isPending || pendingAction !== null,
    pendingAction,
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

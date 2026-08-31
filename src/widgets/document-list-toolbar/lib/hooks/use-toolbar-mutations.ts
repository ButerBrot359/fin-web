import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useTaskCompletionWatcher } from '@/entities/async-task'
import {
  postDocumentEntry,
  unpostDocumentEntry,
} from '@/entities/document-entry'
import { openMovementsForEntry } from '@/features/sdui'
import { isApiConflictError } from '@/shared/api/api-error'
import { invalidateDocumentQueries } from '@/shared/lib/query/invalidate-entities'
import { getApiErrorMessage } from '@/shared/lib/utils/get-api-error-message'
import { getConflictErrorMessage } from '@/shared/lib/utils/get-conflict-error-message'
import { showToast } from '@/shared/ui/toast/show-toast'

/**
 * Мутации тулбара списка документов — одна реализация для обычного и
 * Tabel-режимов (провести, отменить проведение, движения). Ошибка показывает
 * серверный текст, если он есть, иначе — общий ключ; 409 (объект занят /
 * доменная блокировка, SCRUM-330) — warning с текстом бэка «кем занято».
 */
export function useToolbarMutations() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Итог фонового проведения (202 → задача): список инвалидируем только по
  // ЗАВЕРШЕНИИ задачи — раньше него isPosted в строке всё равно не изменится.
  const postingWatcher = useTaskCompletionWatcher((task) => {
    if (task.status === 'SUCCEEDED') {
      invalidateDocumentQueries(queryClient)
      showToast('success', t('documentListToolbar.postSuccess'))
    } else if (task.status === 'FAILED') {
      // errorMessage доменный (в т.ч. готовый текст про блокировку) —
      // показываем пользователю как есть
      showToast(
        'error',
        t('documentListToolbar.postError'),
        task.errorMessage ?? undefined
      )
    } else {
      showToast('info', t('documentListToolbar.postTaskCancelled'))
    }
    // Значок «проводится» в списке и бейдж «Мои операции» гаснут сразу,
    // не дожидаясь своих неспешных интервалов опроса
    void queryClient.invalidateQueries({ queryKey: ['background-tasks'] })
  })

  const post = useMutation({
    mutationFn: (id: number) => postDocumentEntry(id),
    onSuccess: (response) => {
      const result = response.data
      if (result.async) {
        // 202: проведение ушло в фон — итог (тост + инвалидация) приедет из
        // вотчера; освежаем опрос задач, чтобы значок «проводится» появился сразу
        showToast('info', t('documentListToolbar.postQueued'))
        if (result.task) postingWatcher.watch(result.task)
        void queryClient.invalidateQueries({ queryKey: ['background-tasks'] })
        return
      }
      invalidateDocumentQueries(queryClient)
      showToast('success', t('documentListToolbar.postSuccess'))
    },
    onError: (error) => {
      if (isApiConflictError(error)) {
        // Объект занят: операция не выполнена, но это не «ошибка» — повторяемо
        showToast('warning', getConflictErrorMessage(error))
        return
      }
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
      if (isApiConflictError(error)) {
        showToast('warning', getConflictErrorMessage(error))
        return
      }
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

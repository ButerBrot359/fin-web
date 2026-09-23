import i18n from '@/app/config/i18n'
import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ActionBehavior, ViewAction, ViewEffect } from '../types/view'
import { pickFile } from './pick-file'

// Ответ приёмника файла. Форма минимальная и НЕ привязана к конкретной команде:
// `uspeshno` отличает отказ от успеха (эндпоинт отвечает 200 в обоих случаях —
// «файл не тот» не ошибка сервера), `soobshcheniya` — готовый текст для
// пользователя. Отсутствие `uspeshno` трактуем как успех: так эффект переживёт
// приёмник, которому нечего сообщать.
interface UploadResult {
  uspeshno?: boolean
  soobshcheniya?: string[] | null
}

type Redispatch = (
  action: ViewAction,
  behavior?: ActionBehavior | null
) => Promise<boolean>

function formatLimit(maxSizeBytes: number): string {
  const megabytes = maxSizeBytes / (1024 * 1024)
  return megabytes >= 1
    ? `${String(Math.floor(megabytes))} MB`
    : `${String(Math.ceil(maxSizeBytes / 1024))} KB`
}

/**
 * Эффект `uploadFile`: выбрать файл, отправить его на серверный приёмник и по успеху
 * перечитать форму серверной командой.
 *
 * Предел размера проверяется ДО отправки и приходит от сервера — свой предел фронт не
 * выдумывает: у разных команд он разный и меняется настройкой стенда.
 */
export async function uploadFileByEffect(
  effect: ViewEffect,
  redispatch: Redispatch
): Promise<void> {
  const url = effect.url
  if (!url) {
    console.warn('[sdui] эффект uploadFile без url', effect)
    return
  }

  const file = await pickFile(effect.accept)
  if (!file) return

  if (effect.maxSizeBytes && file.size > effect.maxSizeBytes) {
    showToast(
      'error',
      i18n.t('sdui.upload.tooLarge', {
        limit: formatLimit(effect.maxSizeBytes),
      })
    )
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  let result: UploadResult | undefined
  try {
    const response = await apiService.postFormData<
      ApiResponse<UploadResult | undefined>
    >({ url, data: formData })
    result = response.data.data
  } catch {
    showToast('error', i18n.t('sdui.upload.failed'))
    return
  }

  const failed = result?.uspeshno === false
  const text = (result?.soobshcheniya ?? []).filter(Boolean).join('\n')
  showToast(
    failed ? 'error' : 'success',
    text || (failed ? i18n.t('sdui.upload.failed') : i18n.t('sdui.upload.done'))
  )
  if (failed) return

  // Документ изменён на сервере МИМО сессии формы (файл ушёл отдельным
  // запросом), поэтому обновить экран может только серверная команда.
  if (effect.successCommand) {
    await redispatch({ type: 'COMMAND', command: effect.successCommand })
  }
}

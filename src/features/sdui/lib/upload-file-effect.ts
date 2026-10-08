import i18n from '@/app/config/i18n'
import type {
  ValidationMessage,
  ValidationReport,
} from '@/entities/validation-report'
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

/**
 * Куда уходят сообщения итога загрузки. Это панель проверки экрана (SCRUM-317):
 * она не гаснет по таймеру и копит весь список — в отличие от тоста, в котором
 * многострочный отказ исчезал раньше, чем его успевали прочитать, а замечания
 * успешной загрузки тонули в зелёном «успехе». Форму к zustand напрямую не
 * привязываем (тестируемость): конкретный сток (ключ экрана + стор) даёт
 * dispatch-слой. Пустой отчёт гасит панель от прошлой попытки.
 */
export interface UploadFeedbackSink {
  report: (report: ValidationReport) => void
}

function formatLimit(maxSizeBytes: number): string {
  const megabytes = maxSizeBytes / (1024 * 1024)
  return megabytes >= 1
    ? `${String(Math.floor(megabytes))} MB`
    : `${String(Math.ceil(maxSizeBytes / 1024))} KB`
}

/**
 * Отчёт проверки из плоских строк итога загрузки. severity задаёт клиент по
 * `uspeshno`: отказ — ERROR (блокирующие), успех с замечаниями — WARNING. Цели
 * (target) нет: строки файла не адресуются в поле формы — файл разбирается вне
 * формы (ровно как операционный отказ на канале 422). Пустой список гасит
 * панель. blockingCount стор пересчитывает сам при вычёркивании, но исходный
 * считаем здесь.
 */
function buildReport(messages: string[], failed: boolean): ValidationReport {
  return {
    operation: null,
    blockingCount: failed ? messages.length : 0,
    messages: messages.map(
      (text, index): ValidationMessage => ({
        id: `upload-${String(index)}`,
        severity: failed ? 'ERROR' : 'WARNING',
        source: 'OPERATION',
        blocking: failed,
        message: text,
        target: null,
        attributeCode: null,
      })
    ),
  }
}

/**
 * Эффект `uploadFile`: выбрать файл, отправить его на серверный приёмник и по успеху
 * перечитать форму серверной командой.
 *
 * Предел размера проверяется ДО отправки и приходит от сервера — свой предел фронт не
 * выдумывает: у разных команд он разный и меняется настройкой стенда.
 *
 * Итог (причина отказа либо замечания успешной загрузки) уходит в `sink` —
 * панель проверки экрана, а не в тост: список не гаснет по таймеру и к нему
 * можно вернуться. Транспортный сбой (сеть/5xx) — это НЕ «файл не тот», его
 * показываем общим тостом, панель он не касается.
 */
export async function uploadFileByEffect(
  effect: ViewEffect,
  redispatch: Redispatch,
  sink?: UploadFeedbackSink
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
    // Транспортный сбой (сеть/5xx), а не «файл не тот»: панель это не касается.
    showToast('error', i18n.t('sdui.upload.failed'))
    return
  }

  const failed = result?.uspeshno === false
  const messages = (result?.soobshcheniya ?? []).filter(Boolean)

  // Итог — в панель проверки экрана: отказ красным (не гаснет, можно вернуться),
  // замечания успешной загрузки — жёлтым, а не зелёным «успехом». Пустой отчёт
  // гасит панель, оставшуюся от прошлой неудачной попытки.
  sink?.report(buildReport(messages, failed))

  if (failed) {
    // Отказ без текста (контрактом не ожидается, но провод шире контракта) —
    // хотя бы общий тост: пустая панель пользователю ничего не скажет.
    if (messages.length === 0) {
      showToast('error', i18n.t('sdui.upload.failed'))
    }
    return
  }

  // Чистый успех без замечаний — короткий тост факта (панель пуста/погашена).
  // При успехе с замечаниями отдельный тост не нужен: замечания уже в панели, а
  // факт загрузки подтвердит перечитывание формы (notify серверного reread).
  if (messages.length === 0) {
    showToast('success', i18n.t('sdui.upload.done'))
  }

  // Документ изменён на сервере МИМО сессии формы (файл ушёл отдельным
  // запросом), поэтому обновить экран может только серверная команда.
  if (effect.successCommand) {
    await redispatch({ type: 'COMMAND', command: effect.successCommand })
  }
}

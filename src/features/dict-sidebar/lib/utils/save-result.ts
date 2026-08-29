import type { AxiosResponse } from 'axios'

import { getApiErrorMessage } from '@/shared/lib/utils/get-api-error-message'
import { showToast } from '@/shared/ui/toast/show-toast'

/**
 * Сервер ПОДТВЕРДИЛ запись: ответ 2xx (иначе axios-слой бросил бы) и конверт не
 * помечен неуспехом.
 *
 * <p>Зачем отдельная проверка конверта: карточка показывала «Запись сохранена»
 * из локального обработчика, не глядя на ответ вовсе, и дефект «сохранил —
 * пропало» выглядел как успешная запись (разбор 29.08.2026). Успех обязан
 * приходить от сервера; в SDUI-форме за это отвечает `effects.notify`, в
 * легаси-CRUD — этот флаг.
 */
export const isSaveConfirmed = (
  // Конверт намеренно с необязательным `success`: сравнение именно с `false`, а
  // не проверка на истинность. Эндпоинты, которые флаг не кладут, иначе
  // считались бы неуспехом на каждой записи.
  res: AxiosResponse<{ success?: boolean }>
): boolean => res.data.success !== false

/**
 * Ошибка записи с ТЕКСТОМ СЕРВЕРА: api-слой бросает тело ответа, из которого
 * `getApiErrorMessage` достаёт валидационные сообщения или общий message.
 * Общая строка остаётся фолбэком — на случай пустого тела (обрыв транспорта).
 */
export const showSaveError = (error: unknown, fallback: string): void => {
  showToast('error', getApiErrorMessage(error) ?? fallback)
}

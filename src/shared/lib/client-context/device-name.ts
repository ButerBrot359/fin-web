/**
 * Имя компьютера, которое пользователь задал сам (SCRUM-371, «Компьютер» журнала регистрации).
 *
 * Браузер не знает сетевого имени машины и узнать его не может, поэтому имя — добровольная
 * подпись: «Бухгалтерия-1», «Кабинет 204». Хранится только в этом браузере (localStorage) и
 * уходит заголовком `X-Client-Device-Name`; не задано — заголовка нет, и журнал показывает
 * компьютер по идентификатору устройства и адресам.
 */

export const DEVICE_NAME_STORAGE_KEY = 'webbuh.client.deviceName'

/** Подпись, а не описание: длиннее в колонке журнала всё равно не прочитать. */
export const DEVICE_NAME_MAX_LENGTH = 64

/**
 * Приводит введённое имя к виду, пригодному для заголовка: без управляющих символов (перевод
 * строки в заголовке — это уже другой заголовок), без повторных пробелов, не длиннее лимита.
 */
export const normalizeDeviceName = (raw: string): string =>
  raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DEVICE_NAME_MAX_LENGTH)
    .trim()

export const getClientDeviceName = (): string | null => {
  try {
    const stored = window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY)
    const normalized = stored ? normalizeDeviceName(stored) : ''
    return normalized || null
  } catch {
    return null
  }
}

/** Пустое имя — удалить: «сбросить имя» и «не задавать» для журнала одно и то же. */
export const setClientDeviceName = (raw: string): void => {
  const normalized = normalizeDeviceName(raw)
  try {
    if (normalized) {
      window.localStorage.setItem(DEVICE_NAME_STORAGE_KEY, normalized)
    } else {
      window.localStorage.removeItem(DEVICE_NAME_STORAGE_KEY)
    }
  } catch {
    // Хранилище недоступно — имя не сохранится, запросы уйдут без него.
  }
}

/**
 * Значение заголовка. Кириллицу браузер в заголовок не пропустит (XHR `setRequestHeader`
 * бросает на символах вне ISO-8859-1 — и падал бы КАЖДЫЙ запрос), поэтому имя кодируется
 * `encodeURIComponent`; бэкенд декодирует его как UTF-8 (`URLDecoder`).
 */
export const encodeDeviceNameHeader = (name: string): string =>
  encodeURIComponent(name)

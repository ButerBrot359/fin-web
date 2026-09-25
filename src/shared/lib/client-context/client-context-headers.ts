import { getClientDeviceId } from './device-id'
import { encodeDeviceNameHeader, getClientDeviceName } from './device-name'
import { detectLocalIps } from './local-ip'

/**
 * Заголовки «откуда пришёл запрос» для журнала регистрации (SCRUM-371): рабочее место, его
 * адреса в локальной сети и подпись, которую дал компьютеру пользователь. Сервер добавляет к ним
 * то, что видит сам (внешний адрес, прокси), и получает цепочку «компьютер → роутер → сервер».
 */
export const CLIENT_DEVICE_ID_HEADER = 'X-Client-Device-Id'
export const CLIENT_LOCAL_IP_HEADER = 'X-Client-Local-Ip'
export const CLIENT_DEVICE_NAME_HEADER = 'X-Client-Device-Name'

let localIps: string[] = []
let detection: Promise<void> | null = null

/**
 * Запускает определение локальных адресов — один раз на загрузку приложения и НЕ блокируя
 * старт: первые запросы уйдут без `X-Client-Local-Ip`, и это нормально (журнал увидит адрес со
 * следующего запроса). Повторный вызов возвращает тот же процесс.
 */
export const startLocalIpDetection = (
  detect: () => Promise<string[]> = () => detectLocalIps()
): Promise<void> => {
  detection ??= detect()
    .then((ips) => {
      localIps = ips
    })
    .catch(() => {
      localIps = []
    })
  return detection
}

/** Заголовки для очередного запроса. Пустые значения не шлются вовсе. */
export const getClientContextHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    [CLIENT_DEVICE_ID_HEADER]: getClientDeviceId(),
  }
  if (localIps.length > 0) {
    headers[CLIENT_LOCAL_IP_HEADER] = localIps.join(',')
  }
  const deviceName = getClientDeviceName()
  if (deviceName) {
    headers[CLIENT_DEVICE_NAME_HEADER] = encodeDeviceNameHeader(deviceName)
  }
  return headers
}

/** Только для тестов: забыть найденные адреса и разрешить повторное определение. */
export const resetLocalIpDetection = (): void => {
  localIps = []
  detection = null
}

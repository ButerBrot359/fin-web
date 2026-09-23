/**
 * Постоянный идентификатор этого браузера на этом компьютере (SCRUM-371).
 *
 * Уходит заголовком `X-Client-Device-Id` на каждый запрос к webbuh: по нему журнал регистрации
 * связывает события одного рабочего места («все события этого компьютера») даже тогда, когда
 * IP-адрес меняется — DHCP, VPN, переезд ноутбука между офисами.
 *
 * <b>Это не секрет и не учётные данные.</b> Идентификатор генерируется локально, ничего не
 * подтверждает и не даёт доступа — только метка для группировки строк журнала. Поэтому он живёт
 * в localStorage и не стирается при выходе: смена пользователя не меняет компьютер.
 *
 * <b>Каждый доступ к хранилищу — в try/catch.</b> В приватном окне и при запрещённых site data
 * localStorage бросает. Тогда идентификатор живёт в памяти до закрытия вкладки: журнал увидит
 * «новый компьютер» после перезагрузки, но приложение из-за этого не упадёт.
 */

export const DEVICE_ID_STORAGE_KEY = 'webbuh.client.deviceId'

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Кэш на время жизни вкладки: и быстрый путь, и запасной вариант без хранилища. */
let cachedDeviceId: string | null = null

export const isUuidV4 = (value: string): boolean => UUID_V4.test(value)

const toHex = (byte: number): string => byte.toString(16).padStart(2, '0')

/**
 * UUID v4. `crypto.randomUUID` есть только в защищённом контексте (https или localhost) —
 * стенд по голому http его не даёт, поэтому запасной путь собирает UUID из `getRandomValues`
 * по RFC 4122 §4.4 (версия 4, вариант 10xx).
 */
export const generateUuidV4 = (): string => {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    // Среды без Web Crypto практически не встречаются; метка не секретная, Math.random хватает.
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, toHex).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const readStored = (): string | null => {
  try {
    return window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  } catch {
    return null
  }
}

const writeStored = (value: string): void => {
  try {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, value)
  } catch {
    // Хранилище недоступно — идентификатор проживёт до закрытия вкладки.
  }
}

/**
 * Идентификатор устройства: сохранённый, а при его отсутствии или порче — новый.
 * Испорченное значение (руками правили хранилище) заменяется, а не отправляется как есть:
 * в заголовок не должно уйти ничего, кроме UUID.
 */
export const getClientDeviceId = (): string => {
  if (cachedDeviceId) return cachedDeviceId
  const stored = readStored()
  if (stored && isUuidV4(stored)) {
    cachedDeviceId = stored.toLowerCase()
    return cachedDeviceId
  }
  const fresh = generateUuidV4()
  writeStored(fresh)
  cachedDeviceId = fresh
  return fresh
}

/** Только для тестов: забыть кэш вкладки. */
export const resetClientDeviceIdCache = (): void => {
  cachedDeviceId = null
}

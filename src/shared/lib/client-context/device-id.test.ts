import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEVICE_ID_STORAGE_KEY,
  generateUuidV4,
  getClientDeviceId,
  isUuidV4,
  resetClientDeviceIdCache,
} from './device-id'

describe('идентификатор устройства (SCRUM-371)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetClientDeviceIdCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('генерирует UUID v4 один раз и дальше возвращает сохранённый', () => {
    const first = getClientDeviceId()

    expect(isUuidV4(first)).toBe(true)
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(first)

    resetClientDeviceIdCache()
    expect(getClientDeviceId()).toBe(first)
  })

  it('испорченное значение в хранилище заменяет новым UUID', () => {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, 'не uuid\r\nX-Evil: 1')

    const id = getClientDeviceId()

    expect(isUuidV4(id)).toBe(true)
    expect(window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id)
  })

  it('без хранилища живёт в памяти вкладки и не падает', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    const id = getClientDeviceId()

    expect(isUuidV4(id)).toBe(true)
    expect(getClientDeviceId()).toBe(id)
  })

  it('без crypto.randomUUID (http-стенд) собирает UUID v4 сам', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xff)
        return bytes
      },
    })

    const id = generateUuidV4()

    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    expect(isUuidV4(id)).toBe(true)
  })
})

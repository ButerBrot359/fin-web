import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEVICE_NAME_MAX_LENGTH,
  DEVICE_NAME_STORAGE_KEY,
  encodeDeviceNameHeader,
  getClientDeviceName,
  normalizeDeviceName,
  setClientDeviceName,
} from './device-name'

describe('имя компьютера (SCRUM-371)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('чистит перевод строки, повторные пробелы и режет по лимиту', () => {
    expect(normalizeDeviceName('  Бухгалтерия\r\nX-Evil:  1 ')).toBe(
      'Бухгалтерия X-Evil: 1'
    )
    expect(normalizeDeviceName('я'.repeat(100))).toHaveLength(
      DEVICE_NAME_MAX_LENGTH
    )
  })

  it('сохраняет имя, а пустое — удаляет', () => {
    setClientDeviceName(' Кабинет 204 ')
    expect(window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY)).toBe(
      'Кабинет 204'
    )
    expect(getClientDeviceName()).toBe('Кабинет 204')

    setClientDeviceName('   ')
    expect(window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY)).toBeNull()
    expect(getClientDeviceName()).toBeNull()
  })

  it('кириллица уходит в заголовок в ASCII-виде и восстанавливается как есть', () => {
    const encoded = encodeDeviceNameHeader('Бухгалтерия 1')

    expect(encoded).toMatch(/^[\x20-\x7e]+$/)
    expect(decodeURIComponent(encoded)).toBe('Бухгалтерия 1')
  })

  it('недоступное хранилище — имени нет, исключения нет', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(() => {
      setClientDeviceName('Кабинет 204')
    }).not.toThrow()
    expect(getClientDeviceName()).toBeNull()
  })
})

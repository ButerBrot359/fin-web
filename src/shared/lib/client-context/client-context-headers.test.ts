import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CLIENT_DEVICE_ID_HEADER,
  CLIENT_DEVICE_NAME_HEADER,
  CLIENT_LOCAL_IP_HEADER,
  getClientContextHeaders,
  resetLocalIpDetection,
  startLocalIpDetection,
} from './client-context-headers'
import { isUuidV4, resetClientDeviceIdCache } from './device-id'
import { setClientDeviceName } from './device-name'

describe('заголовки рабочего места (SCRUM-371)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetClientDeviceIdCache()
    resetLocalIpDetection()
  })

  it('до определения адресов шлётся только идентификатор устройства', () => {
    const headers = getClientContextHeaders()

    expect(isUuidV4(headers[CLIENT_DEVICE_ID_HEADER])).toBe(true)
    expect(headers).not.toHaveProperty(CLIENT_LOCAL_IP_HEADER)
    expect(headers).not.toHaveProperty(CLIENT_DEVICE_NAME_HEADER)
  })

  it('после определения — адреса через запятую; определение запускается один раз', async () => {
    const detect = vi.fn(() => Promise.resolve(['192.168.1.15', '10.8.0.2']))

    await Promise.all([
      startLocalIpDetection(detect),
      startLocalIpDetection(detect),
    ])

    expect(detect).toHaveBeenCalledTimes(1)
    expect(getClientContextHeaders()[CLIENT_LOCAL_IP_HEADER]).toBe(
      '192.168.1.15,10.8.0.2'
    )
  })

  it('браузер ничего не раскрыл или отказал — заголовка адресов нет', async () => {
    await startLocalIpDetection(() => Promise.reject(new Error('отказ')))

    expect(getClientContextHeaders()).not.toHaveProperty(CLIENT_LOCAL_IP_HEADER)
  })

  it('имя компьютера уходит закодированным и читается на каждом запросе', () => {
    setClientDeviceName('Бухгалтерия 1')
    expect(getClientContextHeaders()[CLIENT_DEVICE_NAME_HEADER]).toBe(
      encodeURIComponent('Бухгалтерия 1')
    )

    setClientDeviceName('')
    expect(getClientContextHeaders()).not.toHaveProperty(
      CLIENT_DEVICE_NAME_HEADER
    )
  })
})

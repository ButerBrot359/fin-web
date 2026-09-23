import axios, { type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/lib/client-context', () => ({
  getClientContextHeaders: vi.fn(() => ({
    'X-Client-Device-Id': '5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
    'X-Client-Local-Ip': '192.168.1.15',
  })),
}))

const { attachClientContextHeaders } =
  await import('./attach-client-context-headers')

describe('attachClientContextHeaders (SCRUM-371)', () => {
  it('подставляет заголовки рабочего места в каждый запрос инстанса', async () => {
    const seen: InternalAxiosRequestConfig[] = []
    const instance = axios.create({
      adapter: (config) => {
        seen.push(config)
        return Promise.resolve({
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        })
      },
    })
    attachClientContextHeaders(instance)

    await instance.get('/api/audit')

    expect(seen[0].headers.get('X-Client-Device-Id')).toBe(
      '5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b'
    )
    expect(seen[0].headers.get('X-Client-Local-Ip')).toBe('192.168.1.15')
  })
})

import axios, { AxiosError } from 'axios'
import i18n from 'i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ViewHttpError, viewTransport } from './view-transport'

describe('ошибки транспорта SDUI', () => {
  beforeAll(async () => {
    await i18n.init({
      lng: 'ru',
      defaultNS: 'common',
      resources: {
        ru: {
          common: {
            errors: { transport: { network: 'Нет связи с сервером' } },
            sdui: { requestError: 'Ошибка запроса' },
          },
        },
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('при обрыве сети показывает переведённый текст, а не сообщение axios', async () => {
    vi.spyOn(axios.Axios.prototype, 'request').mockRejectedValue(
      new AxiosError('Network Error', AxiosError.ERR_NETWORK)
    )

    const error: unknown = await viewTransport
      .post({ action: 'OPEN' } as never)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ViewHttpError)
    expect((error as ViewHttpError).message).toBe('Нет связи с сервером')
  })

  it('при ответе без текста ошибки показывает общий переведённый текст', async () => {
    const response = { status: 500, data: {}, headers: {}, config: {} }
    vi.spyOn(axios.Axios.prototype, 'request').mockRejectedValue(
      new AxiosError(
        'Request failed with status code 500',
        AxiosError.ERR_BAD_RESPONSE,
        undefined,
        undefined,
        response as never
      )
    )

    const error: unknown = await viewTransport
      .post({ action: 'OPEN' } as never)
      .catch((e: unknown) => e)

    expect((error as ViewHttpError).message).toBe('Ошибка запроса')
  })
})

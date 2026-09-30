import axios from 'axios'
import i18n from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

import { attachLanguageHeader } from './attach-language-header'

describe('заголовок языка интерфейса', () => {
  beforeAll(async () => {
    await i18n.init({ lng: 'ru', resources: {} })
  })

  it('каждый запрос уходит с текущим языком интерфейса', async () => {
    const instance = axios.create()
    attachLanguageHeader(instance)
    const seen: unknown[] = []
    instance.defaults.adapter = (config) => {
      seen.push(config.headers.get('Accept-Language'))
      return Promise.resolve({
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      })
    }

    await instance.get('/api/view')
    await i18n.changeLanguage('kz')
    await instance.get('/api/view')

    expect(seen).toEqual(['ru', 'kz'])
  })
})

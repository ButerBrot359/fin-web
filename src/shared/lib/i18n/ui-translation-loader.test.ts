import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadModule = async () => {
  vi.resetModules()
  const { default: i18n } = await import('i18next')
  await i18n.init({
    resources: { ru: { common: { actions: { create: 'Создать' } } } },
    lng: 'ru',
    defaultNS: 'common',
  })
  return import('.')
}

describe('кэш словаря переводов интерфейса', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('сохраняет словарь с ETag и при следующем старте отдаёт его сразу, проверяя свежесть через If-None-Match', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { etag: '"v1"' },
      data: { data: { Создать: 'Жасау' } },
    })
    const first = await loadModule()
    await first.ensureUiTranslations()

    expect(
      JSON.parse(
        localStorage.getItem(first.UI_TRANSLATIONS_STORAGE_KEY) ?? 'null'
      )
    ).toEqual({ etag: '"v1"', data: { Создать: 'Жасау' } })

    let answer: (value: unknown) => void = () => undefined
    const get = vi
      .spyOn(axios, 'get')
      .mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const second = await loadModule()
    await second.ensureUiTranslations()

    expect(second.translateUi('Создать', 'kz')).toBe('Жасау')
    expect(get).toHaveBeenCalledWith(
      second.UI_TRANSLATIONS_URL,
      expect.objectContaining({ headers: { 'If-None-Match': '"v1"' } })
    )
    answer({ status: 304, headers: {}, data: '' })
  })

  it('обновляет словарь и кэш, когда бэкенд вернул новую версию', async () => {
    localStorage.setItem(
      'ui-translations',
      JSON.stringify({ etag: '"v1"', data: { Создать: 'Құру' } })
    )
    let answer: (value: unknown) => void = () => undefined
    const pending = new Promise((resolve) => (answer = resolve))
    vi.spyOn(axios, 'get').mockReturnValue(pending)
    const module = await loadModule()
    await module.ensureUiTranslations()

    expect(module.translateUi('Создать', 'kz')).toBe('Құру')

    answer({
      status: 200,
      headers: { etag: '"v2"' },
      data: { data: { Создать: 'Жасау' } },
    })
    await pending
    await Promise.resolve()

    expect(module.translateUi('Создать', 'kz')).toBe('Жасау')
    expect(
      JSON.parse(localStorage.getItem('ui-translations') ?? 'null')
    ).toEqual({ etag: '"v2"', data: { Создать: 'Жасау' } })
  })
})

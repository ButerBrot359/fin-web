import axios from 'axios'
import i18n from 'i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  applyUiDictionary,
  ensureUiTranslations,
  formatUi,
  localizeDeep,
  setUiDictionary,
  translateUi,
  UI_TRANSLATIONS_URL,
} from '.'

describe('словарь переводов интерфейса с бэкенда', () => {
  beforeAll(async () => {
    await i18n.init({
      resources: {
        ru: { common: { actions: { create: 'Создать' } } },
        kz: { common: { actions: { create: 'Создать' } } },
      },
      lng: 'ru',
      defaultNS: 'common',
    })
  })

  afterEach(async () => {
    setUiDictionary({})
    vi.restoreAllMocks()
    await i18n.changeLanguage('ru')
  })

  it('на казахском берёт перевод из словаря, без перевода оставляет русский текст', () => {
    setUiDictionary({ Создать: 'Жасау' })

    expect(translateUi('Создать', 'kz')).toBe('Жасау')
    expect(translateUi('Создать', 'ru')).toBe('Создать')
    expect(translateUi('Удалить', 'kz')).toBe('Удалить')
  })

  it('подставляет значения в переведённый шаблон', () => {
    setUiDictionary({
      'Страница {{page}} из {{count}}': '{{page}} / {{count}} бет',
    })

    expect(
      formatUi('Страница {{page}} из {{count}}', { page: 2, count: 5 }, 'kz')
    ).toBe('2 / 5 бет')
    expect(
      formatUi('Страница {{page}} из {{count}}', { page: 2, count: 5 }, 'ru')
    ).toBe('Страница 2 из 5')
  })

  it('переводит строки во вложенных объектах и массивах', () => {
    setUiDictionary({ Дни: 'Күндер', Итого: 'Барлығы' })

    expect(
      localizeDeep({ day: 'Дни', rows: ['Итого', 'Прочее'] }, 'kz')
    ).toEqual({
      day: 'Күндер',
      rows: ['Барлығы', 'Прочее'],
    })
  })

  it('строит казахские ресурсы i18n из русских, не трогая русские', async () => {
    applyUiDictionary({ Создать: 'Жасау' })

    await i18n.changeLanguage('kz')
    expect(i18n.t('actions.create')).toBe('Жасау')
    await i18n.changeLanguage('ru')
    expect(i18n.t('actions.create')).toBe('Создать')
  })

  it('загружает словарь с эндпоинта бэкенда', async () => {
    const get = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: { data: { Создать: 'Жасау' } } })

    await ensureUiTranslations()

    expect(get).toHaveBeenCalledWith(UI_TRANSLATIONS_URL, expect.anything())
    expect(translateUi('Создать', 'kz')).toBe('Жасау')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadI18n = async () => {
  vi.resetModules()
  const module = await import('./index')
  return module
}

describe('i18n: сохранение языка интерфейса', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('без сохранённого выбора интерфейс на русском', async () => {
    const { default: i18n } = await loadI18n()

    expect(i18n.language).toBe('ru')
  })

  it('после перезагрузки восстанавливает казахский, выбранный ранее', async () => {
    window.localStorage.setItem('i18nextLng', 'kz')

    const { default: i18n } = await loadI18n()

    expect(i18n.language).toBe('kz')
  })

  it('смена языка запоминается и переживает перезагрузку', async () => {
    const first = await loadI18n()
    await first.default.changeLanguage('kz')

    expect(window.localStorage.getItem(first.LANGUAGE_STORAGE_KEY)).toBe('kz')

    const second = await loadI18n()
    expect(second.default.language).toBe('kz')

    await second.default.changeLanguage('ru')
    const third = await loadI18n()
    expect(third.default.language).toBe('ru')
  })

  it('неизвестное значение в хранилище даёт русский', async () => {
    window.localStorage.setItem('i18nextLng', 'en')

    const { default: i18n } = await loadI18n()

    expect(i18n.language).toBe('ru')
  })
})

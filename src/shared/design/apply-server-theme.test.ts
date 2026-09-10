import { describe, expect, it, beforeEach } from 'vitest'

import { applyServerTheme } from './apply-server-theme'

const rootStyle = () => document.documentElement.style

describe('applyServerTheme', () => {
  beforeEach(() => {
    // Снять всё, что могло остаться от прошлого теста (модульное состояние
    // applied-списка сбрасывается пустым вызовом).
    applyServerTheme({})
  })

  it('накатывает известный токен на :root', () => {
    applyServerTheme({ 'accent-02': '#123456' })

    expect(rootStyle().getPropertyValue('--accent-02')).toBe('#123456')
  })

  it('неизвестный токен игнорируется — бэк не знает реестра', () => {
    applyServerTheme({ 'ghost-token': '#123456' })

    expect(rootStyle().getPropertyValue('--ghost-token')).toBe('')
  })

  it('повторный вызов снимает исчезнувшие override-ы (сброс темы)', () => {
    applyServerTheme({ 'accent-02': '#123456', 'ui-01': '#000000' })
    applyServerTheme({ 'accent-02': '#654321' })

    expect(rootStyle().getPropertyValue('--accent-02')).toBe('#654321')
    expect(rootStyle().getPropertyValue('--ui-01')).toBe('')
  })

  it('пустая тема возвращает всё к дефолтам инъекции', () => {
    applyServerTheme({ 'accent-02': '#123456' })
    applyServerTheme({})

    expect(rootStyle().getPropertyValue('--accent-02')).toBe('')
  })

  it('нестроковое значение не применяется', () => {
    applyServerTheme({ 'accent-02': 42 as unknown as string })

    expect(rootStyle().getPropertyValue('--accent-02')).toBe('')
  })

  describe('ui-scale', () => {
    const ensureAppRoot = (): HTMLElement => {
      let el = document.getElementById('root')
      if (!el) {
        el = document.createElement('div')
        el.id = 'root'
        document.body.appendChild(el)
      }
      return el
    }

    it('масштаб ставит zoom на #root (не на html — поповеры съезжали)', () => {
      const app = ensureAppRoot()

      applyServerTheme({ 'ui-scale': '1.1' })

      expect(app.style.getPropertyValue('zoom')).toBe('1.1')
      expect(rootStyle().getPropertyValue('zoom')).toBe('')
    })

    it('кламп 0.8–1.5 и снятие при сбросе', () => {
      const app = ensureAppRoot()

      applyServerTheme({ 'ui-scale': '9' })
      expect(app.style.getPropertyValue('zoom')).toBe('1.5')

      applyServerTheme({})
      expect(app.style.getPropertyValue('zoom')).toBe('')
    })
  })
})

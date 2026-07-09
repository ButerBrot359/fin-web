import { describe, expect, it } from 'vitest'

import { resolveViewLanguage } from './view-language'

describe('resolveViewLanguage', () => {
  it('ru → Ru', () => {
    expect(resolveViewLanguage('ru')).toBe('Ru')
  })

  it('kz → Kz', () => {
    expect(resolveViewLanguage('kz')).toBe('Kz')
  })

  it('неизвестный код → Ru (fallback)', () => {
    expect(resolveViewLanguage('en-US')).toBe('Ru')
  })
})

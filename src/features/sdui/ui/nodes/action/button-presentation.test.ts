import { describe, expect, it } from 'vitest'

import { resolveButtonPresentation } from './button-presentation'

describe('resolveButtonPresentation', () => {
  it('text-dropdown: меню, выглядящее ссылкой («Ещё...» панели «Перейти»)', () => {
    expect(resolveButtonPresentation('text-dropdown', true)).toEqual({
      muiVariant: 'text',
      isDropdown: true,
    })
  })

  it('dropdown: командное меню остаётся outlined', () => {
    expect(resolveButtonPresentation('dropdown', true)).toEqual({
      muiVariant: 'outlined',
      isDropdown: true,
    })
  })

  it('дропдаун без детей вырождается в кнопку', () => {
    expect(resolveButtonPresentation('text-dropdown', false).isDropdown).toBe(false)
    expect(resolveButtonPresentation('dropdown', false).isDropdown).toBe(false)
  })

  it('прямые MUI-варианты с бэка проходят как есть', () => {
    expect(resolveButtonPresentation('text', false).muiVariant).toBe('text')
    expect(resolveButtonPresentation('contained', false).muiVariant).toBe('contained')
    expect(resolveButtonPresentation('outlined', false).muiVariant).toBe('outlined')
  })

  it('легаси primary → contained, неизвестное/пустое → outlined', () => {
    expect(resolveButtonPresentation('primary', false).muiVariant).toBe('contained')
    expect(resolveButtonPresentation(undefined, false).muiVariant).toBe('outlined')
    expect(resolveButtonPresentation('weird', false).muiVariant).toBe('outlined')
  })
})

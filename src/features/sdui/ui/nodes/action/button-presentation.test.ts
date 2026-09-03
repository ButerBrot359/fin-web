import { describe, expect, it } from 'vitest'

import { resolveButtonPresentation } from './button-presentation'

describe('resolveButtonPresentation', () => {
  it('text-dropdown: меню, выглядящее ссылкой («Ещё...» панели «Перейти»)', () => {
    expect(resolveButtonPresentation('text-dropdown', true)).toEqual({
      variant: 'tertiary',
      isDropdown: true,
    })
  })

  it('dropdown: командное меню — обычная secondary-кнопка с шевроном', () => {
    expect(resolveButtonPresentation('dropdown', true)).toEqual({
      variant: 'secondary',
      isDropdown: true,
    })
  })

  it('дропдаун без детей вырождается в кнопку', () => {
    expect(resolveButtonPresentation('text-dropdown', false).isDropdown).toBe(
      false
    )
    expect(resolveButtonPresentation('dropdown', false).isDropdown).toBe(false)
  })

  it('варианты с провода мапятся на дизайн-систему (outlined в Figma нет → secondary)', () => {
    expect(resolveButtonPresentation('text', false).variant).toBe('tertiary')
    expect(resolveButtonPresentation('contained', false).variant).toBe(
      'primary'
    )
    expect(resolveButtonPresentation('outlined', false).variant).toBe(
      'secondary'
    )
  })

  it('легаси primary → primary, неизвестное/пустое → secondary', () => {
    expect(resolveButtonPresentation('primary', false).variant).toBe('primary')
    expect(resolveButtonPresentation(undefined, false).variant).toBe(
      'secondary'
    )
    expect(resolveButtonPresentation('weird', false).variant).toBe('secondary')
  })
})

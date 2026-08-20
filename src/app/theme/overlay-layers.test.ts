import { describe, expect, it } from 'vitest'

import {
  DICT_SIDEBAR_Z,
  panelZIndex,
  POPUP_Z,
} from '@/shared/lib/utils/overlay-z-index'

import { theme } from './theme'

describe('слой всплывашек (POPUP_Z)', () => {
  it('выше легаси-панели выбора справочника', () => {
    expect(POPUP_Z).toBeGreaterThan(DICT_SIDEBAR_Z)
  })

  it('выше любой разумной глубины стека панелей', () => {
    expect(POPUP_Z).toBeGreaterThan(panelZIndex(5))
  })

  it('ниже тостов — ошибка сохранения видна поверх открытого списка', () => {
    expect(POPUP_Z).toBeLessThan(theme.zIndex.snackbar)
  })

  it('тема прошита константой: Autocomplete, календарь пикера, Popover', () => {
    const components = theme.components as Record<
      string,
      { styleOverrides: Record<string, { zIndex?: number }> }
    >
    expect(components.MuiAutocomplete.styleOverrides.popper.zIndex).toBe(
      POPUP_Z
    )
    expect(components.MuiPickerPopper.styleOverrides.root.zIndex).toBe(POPUP_Z)
    expect(components.MuiPopover.styleOverrides.root.zIndex).toBe(POPUP_Z)
  })
})

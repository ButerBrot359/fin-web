import { describe, expect, it } from 'vitest'

import { palette, semantic } from '@/shared/design/tokens'

import { theme } from './theme'

type StyleRecord = Record<string, unknown>

const tabRoot = (): StyleRecord => {
  const components = theme.components as Record<
    string,
    { styleOverrides?: { root?: StyleRecord } }
  >
  return components.MuiTab.styleOverrides?.root ?? {}
}

/**
 * Пин глобальных MuiTab-overrides (Figma side-panel 324:13541, компонент Tab).
 * Они перекрашивают и ЛЕГАСИ-дроверы вне скриншотного покрытия
 * (report-settings-drawer, reportalt-settings-drawer): их экраны фикстурами
 * не открываются (кнопка «Настройки» ОСВ — серверное SDUI-событие), поэтому
 * контракт стилей держит этот юнит, а применение overrides видно на
 * SDUI-табах в эталоне otpusk-card.
 */
describe('MuiTab overrides — контракт для SDUI и легаси-дроверов', () => {
  it('нормальный регистр, высота 36, скругление сверху', () => {
    const root = tabRoot()
    expect(root.textTransform).toBe('none')
    expect(root.minHeight).toBe(36)
    expect(root.borderRadius).toBe('8px 8px 0 0')
  })

  it('активная вкладка — тёмная с белым текстом (ui-06/ui-01)', () => {
    const selected = tabRoot()['&.Mui-selected'] as StyleRecord
    expect(selected.backgroundColor).toContain(palette.ui06.cssVar)
    expect(selected.color).toContain(palette.ui01.cssVar)
  })

  it('невыбранная — белая с тёмным текстом, ховер — синий', () => {
    const root = tabRoot()
    expect(root.backgroundColor).toContain(palette.ui01.cssVar)
    expect(root.color).toContain(semantic.textPrimary.cssVar)
    const hover = root['&:hover:not(.Mui-selected)'] as StyleRecord
    expect(hover.color).toContain(semantic.primary.cssVar)
  })
})

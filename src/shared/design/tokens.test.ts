import { describe, expect, it } from 'vitest'

import { allTokens, cssVar, palette } from './tokens'
import { injectDesignTokens } from './inject-design-tokens'

describe('design tokens', () => {
  it('cssVar собирает var() с фолбэком-значением', () => {
    expect(cssVar(palette.ui01)).toBe('var(--ui-01, #ffffff)')
    expect(cssVar(palette.accent02)).toBe('var(--accent-02, #2a75f4)')
  })

  it('имена CSS-переменных уникальны, значения — валидные CSS-цвета/тени', () => {
    const tokens = allTokens()
    const vars = tokens.map((t) => t.cssVar)
    expect(new Set(vars).size).toBe(vars.length)
    for (const t of tokens) {
      expect(t.cssVar).toMatch(/^--[a-z0-9-]+$/)
      expect(t.value).toMatch(/^(#[0-9a-f]{6}|rgba?\(|[0-9.]+px |0 \d)/)
    }
  })

  it('injectDesignTokens пишет :root-переменные один раз', () => {
    injectDesignTokens()
    injectDesignTokens() // идемпотентность
    const styles = document.querySelectorAll('style[data-design-tokens]')
    expect(styles.length).toBe(1)
    expect(styles[0].textContent).toContain('--ui-01: #ffffff')
    expect(styles[0].textContent).toContain('--accent-02: #2a75f4')
  })
})

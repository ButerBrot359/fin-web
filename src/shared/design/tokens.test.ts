import { describe, expect, it } from 'vitest'

import { allTokens, cssVar, palette } from './tokens'
import { injectDesignTokens } from './inject-design-tokens'
import tailwindConfig from '../../../tailwind.config'

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

  it('tailwind-палитра построена из токенов (var() с фолбэками)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = tailwindConfig as any
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const colors = config.theme.extend.colors
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const shadows = config.theme.extend.boxShadow

    // Рекурсивно собрать все строковые значения из colors
    const collectValues = (obj: unknown, acc: string[] = []): string[] => {
      if (typeof obj === 'string') {
        acc.push(obj)
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach((v) => collectValues(v, acc))
      }
      return acc
    }

    const colorValues = collectValues(colors)
    const shadowValues = collectValues(shadows)
    const allValues = [...colorValues, ...shadowValues]

    // Все значения должны быть var() с фолбэком
    for (const val of allValues) {
      expect(val).toMatch(/^var\(--[a-z0-9-]+, .+\)$/)
    }

    // Точечные проверки конкретных токенов
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(colors.ui['01']).toBe('var(--ui-01, #ffffff)')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(colors.ui['06']).toBe('var(--ui-06, #222124)')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(colors.accent['01'].DEFAULT).toBe('var(--accent-01, #daf449)')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(colors.accent['02'].hover).toBe('var(--accent-02-hover, #1f66db)')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(colors.support['01']).toBe('var(--support-01, #f4482a)')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(colors.pending['gray-1']).toBe('var(--pending-gray-1, #d9d9d9)')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(colors.pending['weekend-bg']).toBe(
      'var(--pending-weekend-bg, rgba(211, 47, 47, 0.06))'
    )
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(shadows['primary-hover']).toBe(
      'var(--shadow-primary-hover, 2px 4px 8px rgba(218,244,73,0.8))'
    )
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(shadows.popup).toBe(
      'var(--shadow-popup, 0 3px 24px rgba(42, 117, 244, 0.4))'
    )
  })

  it('MUI-тема не содержит literal-hex (кроме none)', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/app/theme/theme.ts', 'utf8')
    const code = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })
})

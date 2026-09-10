import { allTokens } from './tokens'

/**
 * Накатывает серверную тему на `:root` поверх дефолтов `injectDesignTokens`
 * (конструктор дизайна Ф3, спека 2026-09-10 §1.2).
 *
 * Ключи с провода — канонические имена токенов БЕЗ префикса `--` («accent-02»).
 * Применяются только токены из реестра `tokens.ts`: неизвестный ключ
 * игнорируется (бэк намеренно не знает реестра), мусорное значение отбрасывает
 * сам CSS. Повторный вызов снимает override'ы, исчезнувшие с прошлого раза
 * (сброс темы), — иначе «Сбросить» не возвращал бы дефолт до перезагрузки.
 */

const knownCssVarByKey = (): Map<string, string> =>
  new Map(allTokens().map((t) => [t.cssVar.replace(/^--/, ''), t.cssVar]))

let appliedCssVars: string[] = []

export function applyServerTheme(tokens: Record<string, string>): void {
  const known = knownCssVarByKey()
  const root = document.documentElement
  const applied: string[] = []

  for (const [key, value] of Object.entries(tokens)) {
    const cssVar = known.get(key)
    if (!cssVar || typeof value !== 'string') continue
    root.style.setProperty(cssVar, value)
    applied.push(cssVar)
  }

  for (const cssVar of appliedCssVars) {
    if (!applied.includes(cssVar)) {
      root.style.removeProperty(cssVar)
    }
  }
  appliedCssVars = applied
}

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

/**
 * Специальный ключ темы «масштаб интерфейса» (запрос владельца 10.09:
 * «размер шрифтов во всём приложении»). Не CSS-переменная: раскладка проекта
 * почти вся в px, поэтому честный способ укрупнить шрифты вместе с
 * контейнерами — zoom. Значение — множитель строкой («1.1»).
 *
 * Zoom ставится на КОНТЕЙНЕР приложения (#root), а не на html: MUI-поповеры
 * (меню пользователя и т.п.) рендерятся порталами в body — вне зумленного
 * контейнера они позиционируются в обычных координатах и не съезжают за
 * экран (живой дефект 10.09: меню пользователя уезжало вправо при 110%).
 * Плата: сами поповеры остаются в масштабе 100% — приемлемо против
 * разъехавшегося позиционирования.
 */
export const UI_SCALE_TOKEN = 'ui-scale'
/** Ключ-маркер выбранного пресета темы — фронт его не применяет, только хранит. */
export const THEME_PRESET_TOKEN = 'theme-preset'
const UI_SCALE_MIN = 0.8
const UI_SCALE_MAX = 1.5

let appliedCssVars: string[] = []

export function applyServerTheme(tokens: Record<string, string>): void {
  const known = knownCssVarByKey()
  const root = document.documentElement
  const applied: string[] = []

  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== 'string') continue
    if (key === UI_SCALE_TOKEN) {
      applyUiScale(root, value)
      continue
    }
    const cssVar = known.get(key)
    if (!cssVar) continue
    root.style.setProperty(cssVar, value)
    applied.push(cssVar)
  }

  if (!(UI_SCALE_TOKEN in tokens)) {
    appContainer()?.style.removeProperty('zoom')
  }
  for (const cssVar of appliedCssVars) {
    if (!applied.includes(cssVar)) {
      root.style.removeProperty(cssVar)
    }
  }
  appliedCssVars = applied
}

const appContainer = (): HTMLElement | null => document.getElementById('root')

function applyUiScale(_root: HTMLElement, raw: string): void {
  const container = appContainer()
  if (!container) return
  const parsed = Number(raw)
  if (Number.isNaN(parsed)) {
    container.style.removeProperty('zoom')
    return
  }
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, parsed))
  container.style.setProperty('zoom', String(clamped))
}

import { allTokens } from './tokens'

/**
 * Пишет дефолты токенов в :root на старте приложения. Runtime-канал для
 * фазы 2 (/api/theme): серверная тема просто перепишет эти переменные через
 * setProperty — компоненты читают var() и перекрасятся сами (спека §4.1).
 */
export function injectDesignTokens(): void {
  if (document.querySelector('style[data-design-tokens]')) return
  const style = document.createElement('style')
  style.setAttribute('data-design-tokens', '')
  const lines = allTokens()
    .map((t) => `  ${t.cssVar}: ${t.value};`)
    .join('\n')
  style.textContent = `:root {\n${lines}\n}`
  document.head.appendChild(style)
}

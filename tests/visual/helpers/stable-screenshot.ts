import type { Page } from '@playwright/test'

/**
 * Скрин через page.screenshot() без стабилизатора toHaveScreenshot (тот
 * терял слой ламп на /login — см. коммент в login-спеке). Взамен ретраим
 * сами: кадр считается стабильным, когда два подряд снятых байт-в-байт
 * совпали; перед съёмкой дожидаемся загрузки шрифтов.
 */
export const stableScreenshot = async (page: Page): Promise<Buffer> => {
  // строкой: tsconfig тестов без lib DOM, типа document тут нет
  await page.evaluate('document.fonts.ready')

  let prev = await page.screenshot()
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.waitForTimeout(120)
    const next = await page.screenshot()
    if (next.equals(prev)) return next
    prev = next
  }
  return prev
}

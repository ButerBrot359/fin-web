import type { Page } from '@playwright/test'

export async function freezeTime(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fixed = new Date('2026-09-03T12:00:00+05:00').valueOf()
    const RealDate = Date
    // @ts-expect-error переопределение конструктора для детерминизма скриншотов
    globalThis.Date = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(fixed)
        else super(...(args as [number]))
      }
      static now() {
        return fixed
      }
    }
  })
}

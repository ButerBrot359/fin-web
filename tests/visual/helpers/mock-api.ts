import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page, Route } from '@playwright/test'

/**
 * Локальные woff2-сабсеты Google Sans (скачаны однократно с fonts.gstatic.com,
 * см. tests/visual/assets/). Google отдаёт для weight 500 и 700 одинаковые
 * файлы на сабсет (variable-font квирк), поэтому unicode-range определяет
 * реальный набор — вес это не меняет, но контракт (weight+subset в имени
 * файла) соблюдён для наглядности.
 */
const FONT_SUBSETS = [
  {
    weight: 500,
    subset: 'latin',
    file: 'google-sans-500-latin.woff2',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    weight: 500,
    subset: 'cyrillic',
    file: 'google-sans-500-cyrillic.woff2',
    unicodeRange: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  },
  {
    weight: 700,
    subset: 'latin',
    file: 'google-sans-700-latin.woff2',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    weight: 700,
    subset: 'cyrillic',
    file: 'google-sans-700-cyrillic.woff2',
    unicodeRange: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  },
] as const

const fontLocalUrl = (weight: number, subset: string): string =>
  `http://localhost:4173/__font-${String(weight)}-${subset}.woff2`

const buildFontsCss = (): string =>
  FONT_SUBSETS.map(
    ({ weight, subset, unicodeRange }) =>
      `@font-face{font-family:'Google Sans';font-style:normal;font-weight:${String(weight)};` +
      `font-display:swap;src:url('${fontLocalUrl(weight, subset)}') format('woff2');` +
      `unicode-range:${unicodeRange}}`
  ).join('\n')

const fontFileByUrl = (url: string): string | undefined =>
  FONT_SUBSETS.find(
    ({ weight, subset }) => url === fontLocalUrl(weight, subset)
  )?.file

/**
 * Полная изоляция от сети: все /api/* отвечаются фикстурами, шрифты —
 * локальными woff2 (CDN недетерминирован), прочий внешний трафик — 200 {}.
 * Ключ фикстуры: `${method} ${pathname}`; для POST /api/view — дополнительно
 * по `action.type` из тела: `POST /api/view#OPEN`.
 */
export async function mockApi(
  page: Page,
  fixtures: Record<string, unknown>
): Promise<void> {
  await page.route('**/fonts.googleapis.com/**', (r) =>
    r.fulfill({ contentType: 'text/css', body: buildFontsCss() })
  )
  // Страховка от preconnect-хинта в index.html: реальных woff2-запросов на
  // gstatic быть не должно (CSS выше ссылается только на локальные __font-*),
  // но домен всё равно перехватываем явно — иначе изоляция от сети держится
  // на негласном допущении, которое конкретная версия Chromium может нарушить.
  await page.route('**/fonts.gstatic.com/**', (r) =>
    r.fulfill({ status: 204, body: '' })
  )
  await page.route('**/__font-*.woff2', (r) => {
    const file = fontFileByUrl(r.request().url())
    if (!file) {
      return r.fulfill({ status: 404, body: '' })
    }
    return r.fulfill({
      contentType: 'font/woff2',
      body: readFileSync(join('tests/visual/assets', file)),
    })
  })
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    let key = `${req.method()} ${url.pathname}`
    if (url.pathname === '/api/view' && req.method() === 'POST') {
      const body = req.postDataJSON() as { action?: { type?: string } }
      key = `${key}#${body.action?.type ?? ''}`
    }
    const fixture = fixtures[key]
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(fixture ?? {}),
      status: 200,
    })
  })
}

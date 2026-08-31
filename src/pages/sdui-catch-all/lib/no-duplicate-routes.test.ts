import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Задача 9 SCRUM-290 / SCRUM-360 этап A: каждый путь, покрытый KIND_TO_LEGACY,
// обслуживается catch-all-фолбэком (200→SDUI / 422→легаси). Явный <Route> в
// App.tsx перехватил бы URL раньше catch-all — SDUI-экран стал бы недостижим.
//
// Путь через process.cwd(), а не new URL(..., import.meta.url): под Vite
// последний паттерн статически переписывается в asset-URL для браузера
// (http://localhost:3000/...) и ломает fileURLToPath в тестовом окружении.
const appTsx = readFileSync(
  path.resolve(process.cwd(), 'src/app/App.tsx'),
  'utf8'
)

// Точное совпадение с атрибутом path="..." — карточные и плоские пути тоже
// сюда попали (SCRUM-360 этап B, задача 4): бэк резолвит плоские роуты
// (PROBE-2 «да»), catch-all обслуживает и карточные kind (задачи 2/3).
const REMOVED_PATHS = [
  '/modules/:pageCode/document/:moduleCode',
  '/modules/:pageCode/document/:moduleCode/:entryId/movements',
  '/modules/:pageCode/dictionary/:moduleCode',
  '/modules/:pageCode/informationregister/:moduleCode',
  '/modules/:pageCode/accumulationregister/:moduleCode',
  '/modules/:pageCode/accountingregister/:moduleCode',
  '/modules/:pageCode/accountplan/:moduleCode',
  '/modules/:pageCode/accountingreport/:moduleCode',
  '/modules/:pageCode/report/:moduleCode',
  '/modules/:pageCode/reportalt/:moduleCode',
  '/modules/:pageCode/dataprocessor/:moduleCode',
  '/modules/:pageCode/calculationplan/:moduleCode',
  '/modules/:pageCode/document/:moduleCode/new',
  '/modules/:pageCode/document/:moduleCode/:entryId',
  '/modules/:pageCode/dictionary/:moduleCode/new',
  '/modules/:pageCode/dictionary/:moduleCode/:entryId',
  // PROBE-2 «да»: бэк резолвит плоские роуты напрямую.
  '/documents/:typeCode',
  '/documents/:typeCode/new',
  '/documents/:typeCode/:entryId',
  '/dictionaries/:typeCode',
  '/dictionaries/:typeCode/:entryId',
]

describe('App.tsx не дублирует KIND_TO_LEGACY явными Route (SCRUM-360 этапы A+B)', () => {
  it.each(REMOVED_PATHS)('нет явного Route path="%s"', (p) => {
    expect(appTsx.includes(`path="${p}"`)).toBe(false)
  })
})

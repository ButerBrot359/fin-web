import { expect, test } from '@playwright/test'
import { freezeTime } from './helpers/freeze'
import { mockApi } from './helpers/mock-api'

/**
 * /login на моках не рендерится стабильно (AUTH_ENABLED снят в проде,
 * маршрут живёт вне общего Layout и делает лишние побочные запросы) —
 * смоук проверяет только то, что должен: webServer поднимается, mockApi
 * перехватывает сеть, скриншот детерминирован. Для этого достаточно корня
 * '/' с заглушками — shell-обвязка (TopBar/Sidebar) их и запрашивает.
 * 'GET /api/tasks/active' обязателен: без массива счётчик фоновых задач
 * (useActiveTasksCount) падает на `(data ?? []).filter` ещё до ErrorBoundary
 * (та оборачивает только Routes, не TopBar/Sidebar) — без фикстуры страница
 * рендерится пустой.
 */
test('корень рендерится и совпадает с эталоном', async ({ page }) => {
  await freezeTime(page)
  await mockApi(page, {
    'POST /api/view#OPEN': {},
    'GET /api/settings/modules': { data: [], success: true },
    'GET /api/tasks/active': [],
  })
  await page.goto('/')
  await expect(page).toHaveScreenshot('root.png')
})

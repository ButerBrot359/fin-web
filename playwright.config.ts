import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/visual',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // Момент времени морозит freezeTime, но форматирование дат зависит и от
    // зоны рендера — пинуем, чтобы эталоны не зависели от TZ машины.
    timezoneId: 'Asia/Almaty',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    // false: забытый preview на 4173 со старым dist/ дал бы молча
    // провалидировать несвежий билд; strictPort превратит это в явную ошибку.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})

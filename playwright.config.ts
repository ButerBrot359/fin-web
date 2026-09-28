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
    // ratio 0.001 на полноэкранном 1440×900 — это ~1300px допуска: дрейф
    // мелкого элемента (иконка, чекбокс) пролезал молча. Абсолютная крышка
    // 400px оставляет запас на анти-алиасинг, но ловит смысловые диффы.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      maxDiffPixels: 400,
      animations: 'disabled',
    },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    // false: забытый preview на 4173 со старым dist/ дал бы молча
    // провалидировать несвежий билд; strictPort превратит это в явную ошибку.
    reuseExistingServer: false,
    timeout: 120_000,
    // Фикстуры сюиты сняты в анонимном контуре: JWT-гвард выключен на этапе
    // СБОРКИ (флаг читается import.meta.env). Локальный .env с
    // VITE_AUTH_ENABLED=true (нужен для живой отладки входа) иначе молча
    // уводил все экраны на /login — прогон обязан не зависеть от .env машины.
    env: { ...process.env, VITE_AUTH_ENABLED: 'false' },
  },
})

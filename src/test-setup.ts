// Глобальный setup vitest (vitest.config.ts → test.setupFiles).
//
// 1. Авто-cleanup после каждого теста: у нас globals: false, поэтому
//    @testing-library/react сам cleanup не вешает — без этого рендер-файлы
//    с двумя и более тестами делят DOM и падают недетерминированно.
//    Ручные cleanup() в старых тестах безвредны (идемпотентно).
// 2. jest-dom матчеры (toBeInTheDocument, toBeDisabled, …) для всех тестов.
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

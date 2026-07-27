# SCRUM-265 (остаток) — выбор папки при выгрузке в казначейство Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На странице `/treasury-export` при «Выгрузить» в Chromium открывать системный диалог выбора папки (File System Access API) и писать файл туда; в Firefox/Safari — оставить текущее браузерное скачивание.

**Architecture:** Только `features/treasury-export` (легаси-контур, НЕ SDUI). Новый `lib/save-to-directory.ts` (feature-detect + picker + запись, самодостаточные типы), api-функция `fetchTreasuryExportBlob` (blob через `getFileBlob`), оркестрация в `handleExport` страницы. Бэк/SDUI не трогаем, новых эндпоинтов нет.

**Tech Stack:** React 19, TypeScript, File System Access API (`showDirectoryPicker`), TanStack Query, Vitest + Testing Library.

## Global Constraints

- Правки только в `src/features/treasury-export`. Бэк/SDUI/легаси вне фичи не трогать.
- **Gesture-safety:** `showDirectoryPicker()` требует transient user activation → вызывается синхронно в обработчике клика ДО любого `await` (сначала синхронный pre-check, потом picker, потом fetch/запись). Повторный preview перед picker'ом НЕ гоняем.
- FS-Access типы — локальные в `save-to-directory.ts` (свои имена `Fs*`, каст `window` через `unknown`); НЕ добавлять ambient `.d.ts` и НЕ аугментировать глобальный `Window` (риск коллизии с lib.dom TS 5.9).
- Фолбэк-ветку (FF/Safari) — поведение как сейчас (`preview.mutate` → `window.location.assign(treasuryExportDownloadUrl)`), не менять.
- Тексты — `useTranslation` + ключи в `common.json` (ru+kz). `<Typography>` для текста.
- Мутации — `useMutation` (уже есть). Без `useMemo`/`useCallback` без перф-причины.
- Окружение тестов: нет `jest-dom` (`toBeTruthy`/spy-assert, не `toBeInTheDocument`); нет `@testing-library/user-event` (`fireEvent`); `afterEach(cleanup)`; i18n в компонент-тестах — `import '@/app/config/i18n'`.
- НЕ запускать `tsc`/`lint`/`build` — только точечные `npx vitest run`.
- Формат коммита: `feat|refactor: … (SCRUM-265)`.
- Алиас `@/*` → `src/*`.

---

## Task 1: lib/save-to-directory.ts — feature-detect, picker, запись

**Files:**
- Create: `src/features/treasury-export/lib/save-to-directory.ts`
- Test: `src/features/treasury-export/lib/save-to-directory.test.ts`

**Interfaces:**
- Produces:
  - `supportsDirectoryPicker(): boolean`
  - `pickDirectory(): Promise<FsDirectoryHandle | null>` — `null` при отмене (`AbortError`).
  - `writeBlobToDirectory(dir: FsDirectoryHandle, fileName: string, blob: Blob): Promise<void>`
  - `interface FsDirectoryHandle` (экспортируется для сигнатур page/тестов).

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/treasury-export/lib/save-to-directory.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  supportsDirectoryPicker,
  pickDirectory,
  writeBlobToDirectory,
} from './save-to-directory'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('supportsDirectoryPicker', () => {
  it('true когда window.showDirectoryPicker — функция', () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn())
    expect(supportsDirectoryPicker()).toBe(true)
  })
  it('false когда API отсутствует', () => {
    vi.stubGlobal('showDirectoryPicker', undefined)
    expect(supportsDirectoryPicker()).toBe(false)
  })
})

describe('pickDirectory', () => {
  it('возвращает handle из showDirectoryPicker', async () => {
    const dir = { getFileHandle: vi.fn() }
    vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(dir))
    await expect(pickDirectory()).resolves.toBe(dir)
  })
  it('AbortError (отмена) → null', async () => {
    vi.stubGlobal(
      'showDirectoryPicker',
      vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    )
    await expect(pickDirectory()).resolves.toBeNull()
  })
  it('нет API → null', async () => {
    vi.stubGlobal('showDirectoryPicker', undefined)
    await expect(pickDirectory()).resolves.toBeNull()
  })
})

describe('writeBlobToDirectory', () => {
  it('создаёт файл и пишет blob под именем', async () => {
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) }
    const fileHandle = { createWritable: vi.fn().mockResolvedValue(writable) }
    const dir = { getFileHandle: vi.fn().mockResolvedValue(fileHandle) }
    const blob = new Blob(['<xml/>'], { type: 'application/xml' })

    await writeBlobToDirectory(dir as never, 'ЗаявкаГПС.xml', blob)

    expect(dir.getFileHandle).toHaveBeenCalledWith('ЗаявкаГПС.xml', { create: true })
    expect(writable.write).toHaveBeenCalledWith(blob)
    expect(writable.close).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустить — RED**

Run: `npx vitest run src/features/treasury-export/lib/save-to-directory.test.ts`
Expected: FAIL — import `./save-to-directory` не резолвится.

- [ ] **Step 3: Реализовать lib**

```ts
// src/features/treasury-export/lib/save-to-directory.ts

// Минимальное подмножество File System Access API (в TS 5.9 стандартно не
// типизировано целиком; локальные типы + каст window через unknown — без
// глобальной аугментации, чтобы не конфликтовать с lib.dom).
interface FsWritable {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
interface FsFileHandle {
  createWritable(): Promise<FsWritable>
}
export interface FsDirectoryHandle {
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FsFileHandle>
}
type ShowDirectoryPicker = (options?: {
  mode?: 'read' | 'readwrite'
}) => Promise<FsDirectoryHandle>

const getPicker = (): ShowDirectoryPicker | undefined =>
  (window as unknown as { showDirectoryPicker?: ShowDirectoryPicker })
    .showDirectoryPicker

/** Chromium поддерживает File System Access (Chrome/Edge); FF/Safari — нет. */
export const supportsDirectoryPicker = (): boolean =>
  typeof getPicker() === 'function'

/**
 * Открывает системный диалог выбора папки (только Chromium). Возвращает handle
 * или null при отмене пользователем. ВЫЗЫВАТЬ синхронно в обработчике клика —
 * API требует transient user activation.
 */
export async function pickDirectory(): Promise<FsDirectoryHandle | null> {
  const show = getPicker()
  if (!show) return null
  try {
    return await show({ mode: 'readwrite' })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    throw e
  }
}

/** Пишет blob в выбранную папку под именем fileName (перезапись, если есть). */
export async function writeBlobToDirectory(
  dir: FsDirectoryHandle,
  fileName: string,
  blob: Blob
): Promise<void> {
  const fileHandle = await dir.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
}
```

- [ ] **Step 4: Запустить — GREEN**

Run: `npx vitest run src/features/treasury-export/lib/save-to-directory.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Коммит**

```bash
git add src/features/treasury-export/lib/save-to-directory.ts src/features/treasury-export/lib/save-to-directory.test.ts
git commit -m "add: save-to-directory — File System Access picker + запись blob (SCRUM-265)"
```

---

## Task 2: api fetchTreasuryExportBlob + i18n-ключи

**Files:**
- Modify: `src/features/treasury-export/api/treasury-export-api.ts` (добавить функцию)
- Modify: `src/app/config/i18n/locales/ru/common.json`, `src/app/config/i18n/locales/kz/common.json` (ключи `treasuryExport.savedToFolder`, `treasuryExport.saveFailed`)

**Interfaces:**
- Produces: `fetchTreasuryExportBlob(typeCode: string, id: number, signal?: AbortSignal)` → `Promise<AxiosResponse<Blob>>` (`.data` — Blob).

- [ ] **Step 1: Добавить api-функцию**

В `src/features/treasury-export/api/treasury-export-api.ts` добавить (импорты сверху не менять, `apiService` уже импортирован):

```ts
/**
 * Байты XML одиночного документа (для записи в выбранную папку, Chromium).
 * GET одиночного эндпоинта как blob; имя файла берём из preview (row.fileName).
 */
export const fetchTreasuryExportBlob = (
  typeCode: string,
  id: number,
  signal?: AbortSignal
) =>
  apiService.getFileBlob({
    url: `/api/document-entries/${typeCode}/${id}/treasury-export`,
    signal,
  })
```

- [ ] **Step 2: Добавить i18n-ключи (ru)**

В `src/app/config/i18n/locales/ru/common.json`, в объект `treasuryExport`, добавить два ключа (валидный JSON — запятые!):

```json
"savedToFolder": "Файл сохранён в выбранную папку",
"saveFailed": "Не удалось сохранить файл"
```

- [ ] **Step 3: Добавить i18n-ключи (kz)**

В `src/app/config/i18n/locales/kz/common.json`, в `treasuryExport`:

```json
"savedToFolder": "Файл таңдалған қалтаға сақталды",
"saveFailed": "Файлды сақтау мүмкін болмады"
```

- [ ] **Step 4: Проверить валидность JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/app/config/i18n/locales/ru/common.json','utf8'));JSON.parse(require('fs').readFileSync('src/app/config/i18n/locales/kz/common.json','utf8'));console.log('ok')"`
Expected: `ok`.

- [ ] **Step 5: Коммит**

```bash
git add src/features/treasury-export/api/treasury-export-api.ts src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "add: fetchTreasuryExportBlob + i18n-ключи сохранения в папку (SCRUM-265)"
```

---

## Task 3: оркестрация в treasury-export-page + тесты

**Files:**
- Modify: `src/features/treasury-export/ui/treasury-export-page.tsx` (`handleExport` + новая `exportToPickedFolder`)
- Create: `src/features/treasury-export/ui/treasury-export-page-picker.test.tsx`

**Interfaces:**
- Consumes: `supportsDirectoryPicker`/`pickDirectory`/`writeBlobToDirectory` (Task 1), `fetchTreasuryExportBlob` (Task 2), i18n `savedToFolder`/`saveFailed`.

Поведение: `handleExport` — если `!supportsDirectoryPicker()` → текущий фолбэк (re-preview + `location.assign`). Иначе → `exportToPickedFolder`: синхронный pre-check `hasErrors` из авто-preview → `pickDirectory()` (picker в клике) → `null`? стоп : fetch blob → `writeBlobToDirectory` → success-тост; ошибки → `saveFailed`-тост.

- [ ] **Step 1: Написать падающий тест (picker-оркестрация)**

```tsx
// src/features/treasury-export/ui/treasury-export-page-picker.test.tsx
import '@/app/config/i18n'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TreasuryExportPage } from './treasury-export-page'
import * as api from '../api/treasury-export-api'
import * as saveLib from '../lib/save-to-directory'
import { showToast } from '@/shared/ui/toast/show-toast'

vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/treasury-export?typeCode=T&id=42']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  )
  return render(<TreasuryExportPage />, { wrapper: Wrapper })
}

const mockPreview = (hasErrors: boolean) =>
  vi.spyOn(api, 'previewTreasuryExport').mockResolvedValue({
    data: {
      data: {
        rows: [
          { n: 1, documentId: 42, typeCode: 'T', presentation: 'Док', amount: 1, errors: [], fileName: 'ЗаявкаГПС.xml' },
        ],
        hasErrors,
      },
      success: true,
    },
  } as never)

beforeEach(() => vi.restoreAllMocks())
afterEach(cleanup)

describe('TreasuryExportPage — сохранение в папку (Chromium)', () => {
  it('picker → fetch → запись blob + success-тост', async () => {
    mockPreview(false)
    vi.spyOn(saveLib, 'supportsDirectoryPicker').mockReturnValue(true)
    const dir = {} as saveLib.FsDirectoryHandle
    vi.spyOn(saveLib, 'pickDirectory').mockResolvedValue(dir)
    const writeSpy = vi.spyOn(saveLib, 'writeBlobToDirectory').mockResolvedValue()
    const blob = new Blob(['x'])
    vi.spyOn(api, 'fetchTreasuryExportBlob').mockResolvedValue({ data: blob } as never)

    renderPage()
    await screen.findByText('Док') // авто-preview отрисован
    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))

    await waitFor(() =>
      expect(writeSpy).toHaveBeenCalledWith(dir, 'ЗаявкаГПС.xml', blob)
    )
    expect(showToast).toHaveBeenCalledWith('success', 'Файл сохранён в выбранную папку')
  })

  it('отмена диалога (null) → нет fetch, нет тоста ошибки', async () => {
    mockPreview(false)
    vi.spyOn(saveLib, 'supportsDirectoryPicker').mockReturnValue(true)
    vi.spyOn(saveLib, 'pickDirectory').mockResolvedValue(null)
    const fetchSpy = vi.spyOn(api, 'fetchTreasuryExportBlob')

    renderPage()
    await screen.findByText('Док')
    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))

    await waitFor(() => expect(saveLib.pickDirectory).toHaveBeenCalled())
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalledWith('error', expect.anything())
  })

  it('нет API → фолбэк на location.assign', async () => {
    mockPreview(false)
    vi.spyOn(saveLib, 'supportsDirectoryPicker').mockReturnValue(false)
    vi.stubGlobal('location', { assign: vi.fn() } as unknown as Location)

    renderPage()
    await screen.findByText('Док')
    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))

    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining('/api/document-entries/T/42/treasury-export')
      )
    )
  })
})
```

- [ ] **Step 2: Запустить — RED**

Run: `npx vitest run src/features/treasury-export/ui/treasury-export-page-picker.test.tsx`
Expected: FAIL — страница ещё не зовёт picker (первый тест: `writeBlobToDirectory` не вызван).

- [ ] **Step 3: Реализовать оркестрацию в странице**

В `src/features/treasury-export/ui/treasury-export-page.tsx`:

Добавить импорты (рядом с существующими из фичи):

```ts
import {
  supportsDirectoryPicker,
  pickDirectory,
  writeBlobToDirectory,
} from '../lib/save-to-directory'
import { fetchTreasuryExportBlob } from '../api/treasury-export-api'
```

Заменить `handleExport` (строки 54-69) на две функции (определить `exportToPickedFolder` ДО `handleExport`):

```ts
  // Chromium: picker вызывается синхронно в клике (transient activation),
  // сеть — уже после выбора папки. Валидацию берём из авто-preview (без
  // повторного preview, чтобы не потерять user activation до showDirectoryPicker).
  const exportToPickedFolder = async () => {
    if (preview.data?.hasErrors) {
      showToast('error', t('treasuryExport.hasErrorsToast'))
      return
    }
    const fileName =
      preview.data?.rows[0]?.fileName ?? `${typeCode}_${String(id)}.xml`
    try {
      const dir = await pickDirectory()
      if (!dir) return // пользователь отменил диалог
      const res = await fetchTreasuryExportBlob(typeCode, id)
      await writeBlobToDirectory(dir, fileName, res.data)
      showToast('success', t('treasuryExport.savedToFolder'))
    } catch {
      showToast('error', t('treasuryExport.saveFailed'))
    }
  }

  const handleExport = () => {
    if (!typeCode || Number.isNaN(id)) return

    // FF/Safari или нет File System Access: текущее поведение —
    // re-validate + браузерное скачивание (GET-навигация).
    if (!supportsDirectoryPicker()) {
      preview.mutate([item], {
        onSuccess: (data: TreasuryExportPreviewResponse) => {
          if (data.hasErrors) {
            showToast('error', t('treasuryExport.hasErrorsToast'))
            return
          }
          window.location.assign(treasuryExportDownloadUrl(typeCode, id))
        },
        onError: () => {
          showToast('error', t('treasuryExport.loadFailed'))
        },
      })
      return
    }

    void exportToPickedFolder()
  }
```

Подпись «Файлы будут скачаны браузером» (строки 100-102) оставить — верна для фолбэка; в Chromium диалог папки самоочевиден. (Опционально можно уточнить текст, но это вне scope — не трогаем.)

- [ ] **Step 4: Запустить — GREEN**

Run: `npx vitest run src/features/treasury-export/ui/treasury-export-page-picker.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 5: Регресс — весь слайс (в т.ч. старый page-тест = фолбэк)**

Run: `npx vitest run src/features/treasury-export`
Expected: PASS. Старый `treasury-export-page.test.tsx` зелёный: в jsdom `showDirectoryPicker` нет → `supportsDirectoryPicker()` false → фолбэк-ветка → `location.assign` как раньше.

- [ ] **Step 6: Коммит**

```bash
git add src/features/treasury-export/ui/treasury-export-page.tsx src/features/treasury-export/ui/treasury-export-page-picker.test.tsx
git commit -m "feat: выбор папки при выгрузке в казначейство (Chromium) + фолбэк (SCRUM-265)"
```

---

## Верификация (e2e, ручная)

1. Chrome/Edge: `/treasury-export?typeCode=…&id=<валидный>` → «Выгрузить» → системный диалог папки → выбрать → файл `ЗаявкаГПС<Номер>.xml` в папке; тост «Файл сохранён в выбранную папку».
2. Chrome: отмена диалога → ничего не скачивается, ошибок нет.
3. Firefox/Safari: «Выгрузить» → обычное скачивание (как раньше), диалога папки нет.
4. Документ с ошибками (Chrome): «Выгрузить» → тост ошибок, диалог не открывается.

---

## Self-Review (выполнено при написании плана)

**Покрытие дизайна:**
- lib feature-detect/pick/write → Task 1 (+ тесты RED/GREEN). ✓
- api blob + i18n → Task 2. ✓
- gesture-safe оркестрация (picker в клике, pre-check hasErrors из авто-preview, fetch+write, отмена тихо, ошибки тостом) → Task 3. ✓
- фолбэк FF/Safari без изменений → Task 3 (ветка `!supportsDirectoryPicker`). ✓
- отклонение от дизайна: ambient `.d.ts` заменён локальными типами в lib (обосновано — коллизия с lib.dom). ✓

**Плейсхолдеры:** нет TBD/TODO; код и тесты целиком.

**Согласованность:** `FsDirectoryHandle`/`supportsDirectoryPicker`/`pickDirectory`/`writeBlobToDirectory`/`fetchTreasuryExportBlob` — единые имена сквозь Task 1-3; ключи `savedToFolder`/`saveFailed` определены (Task 2) до использования (Task 3).

**Осознанные упущения:** пакет (N-файлов в папку) — фаза 2, не реализуем; кнопка «Выгрузить» не блокируется на время picker/fetch (picker модален — двойной клик неактуален).

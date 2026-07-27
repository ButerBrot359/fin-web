# SCRUM-265 фронт-дельта (FE-6 / Treasury / FE-5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть три оставшихся куска SCRUM-265: FE-6 (DATE-поля как `YYYY-MM-DD`), страница «Выгрузка документов в казначейство» (`/treasury-export`), FE-5 (адаптивный overflow командной панели SDUI-формы).

**Architecture:** Три независимых изменения. FE-6 — точечный фикс сериализации в `shared/ui/inputs`. Treasury — новая легаси-страница `pages/treasury-export` + `features/treasury-export` (образец `financing-plan-upload`), роут в `App.tsx`, SDUI лишь наводит `navigate`. FE-5 — чистая клиентская компоновка внутри `features/sdui` (pure-функция распределения + измерение ширины + рендер свёрнутых пунктов в меню «Ещё»).

**Tech Stack:** React 19, TypeScript, Vite, MUI, TanStack Query (`useMutation`), react-router-dom, date-fns, react-i18next, Zustand (уже в SDUI), Vitest + Testing Library.

## Global Constraints

- Тексты только через `useTranslation` (`react-i18next`) + ключи в `src/app/config/i18n/locales/{ru,kz}/common.json`. Не хардкодить строки в JSX.
- Текстовые элементы — `<Typography>` из `@mui/material`.
- Один файл — одна ответственность; цель ~200 строк, жёсткий предел 300 (легаси не рефакторим).
- Barrel-`index.ts` только на уровне слайса (`features/treasury-export/index.ts`); внутри сегментов импорт напрямую.
- Изоляция SDUI/легаси: прямые импорты между мирами запрещены. FE-6 — только `shared`. Treasury — легаси-контур, из SDUI только `navigate` на роут (никаких импортов SDUI↔treasury). FE-5 — только внутри `features/sdui`.
- НЕ запускать `tsc --noEmit`/`lint`/`build` после каждого шага — только точечные Vitest-команды из шагов. Полную проверку — по явной просьбе или в конце.
- Алиас `@/*` → `src/*`.
- Формат коммита: `feat|fix|add|refactor: описание (SCRUM-265)`. Каждый из трёх кусков — отдельный коммит.
- API-клиент: `import { apiService } from '@/shared/api/api'`; обёртка ответа — `ApiResponse<T>` (`{ data: T; success }`) из `@/shared/types/api.types`. `apiService.post` бросает `error.response?.data` (уже развёрнутое тело) при ошибке.
- Base URL для нативной GET-навигации — `import.meta.env.VITE_API_BASE_URL` (тот же, что baseURL axios).

---

## Feature 1 — FE-6: DATE-поля как `YYYY-MM-DD`

### Task 1: Чистая функция сериализации даты инпута

**Files:**
- Create: `src/shared/ui/inputs/serialize-date-input.ts`
- Test: `src/shared/ui/inputs/serialize-date-input.test.ts`

**Interfaces:**
- Produces: `serializeDateInput(value: Date | null, dateOnly?: boolean): string` — для `dateOnly` возвращает локальную календарную дату `yyyy-MM-dd`; иначе `Date.toISOString()`; для `null`/невалидной даты — `''`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/shared/ui/inputs/serialize-date-input.test.ts
import { describe, it, expect } from 'vitest'

import { serializeDateInput } from './serialize-date-input'

describe('serializeDateInput', () => {
  it('dateOnly: локальная полночь сериализуется в тот же календарный день (без сдвига UTC)', () => {
    // Локальная полночь 1 июля 2026 в зоне окружения теста.
    const localMidnight = new Date(2026, 6, 1, 0, 0, 0, 0)
    expect(serializeDateInput(localMidnight, true)).toBe('2026-07-01')
  })

  it('datetime: сериализуется как ISO Z-строка (политика UTC-на-проводе не тронута)', () => {
    const d = new Date(2026, 6, 1, 12, 30, 0, 0)
    expect(serializeDateInput(d, false)).toBe(d.toISOString())
  })

  it('null и невалидная дата → пустая строка', () => {
    expect(serializeDateInput(null, true)).toBe('')
    expect(serializeDateInput(new Date('nope'), true)).toBe('')
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/shared/ui/inputs/serialize-date-input.test.ts`
Expected: FAIL — `Failed to resolve import './serialize-date-input'`.

- [ ] **Step 3: Реализовать функцию**

```ts
// src/shared/ui/inputs/serialize-date-input.ts
import { format, isValid } from 'date-fns'

/**
 * Сериализация значения дата-инпута для отправки на сервер (SCRUM-265 FE-6).
 *
 * `dateOnly` (DATE-поля): голая календарная дата `yyyy-MM-dd` в ЛОКАЛЬНОЙ зоне.
 * `toISOString()` уводил локальную полночь в UTC — для зоны восточнее Гринвича
 * «01.07 00:00 (+05:00)» превращалось в «2026-06-30T19:00:00.000Z», а сервер
 * (политика «offset отрезаем, не конвертируем») сохранял 30 июня. `format`
 * работает в локальной зоне — сдвига нет по построению.
 *
 * datetime-поля: политика UTC-на-проводе сохраняется — `toISOString()` как было.
 */
export function serializeDateInput(
  value: Date | null,
  dateOnly?: boolean
): string {
  if (!value || !isValid(value)) return ''
  return dateOnly ? format(value, 'yyyy-MM-dd') : value.toISOString()
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/shared/ui/inputs/serialize-date-input.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/shared/ui/inputs/serialize-date-input.ts src/shared/ui/inputs/serialize-date-input.test.ts
git commit -m "add: чистая сериализация даты инпута serializeDateInput (SCRUM-265 FE-6)"
```

### Task 2: Подключить фикс в datetime-input и починить todayIso

**Files:**
- Modify: `src/shared/ui/inputs/datetime-input.tsx:42-48` (handleChange)
- Modify: `src/pages/financing-plan-upload/financing-plan-upload-list/ui/financing-plan-upload-page.tsx:47` (todayIso)

**Interfaces:**
- Consumes: `serializeDateInput` (Task 1).

- [ ] **Step 1: Заменить handleChange в datetime-input**

В `src/shared/ui/inputs/datetime-input.tsx` добавить импорт и переписать `handleChange`. `dateOnly` уже в scope компонента (проп).

Импорт (рядом с существующим `import { parseISO, isValid } from 'date-fns'`):

```ts
import { serializeDateInput } from './serialize-date-input'
```

Заменить текущий `handleChange`:

```ts
  const handleChange = (newValue: Date | null) => {
    if (newValue && isValid(newValue)) {
      onChange(newValue.toISOString())
    } else {
      onChange('')
    }
  }
```

на:

```ts
  const handleChange = (newValue: Date | null) => {
    // DATE-поля (dateOnly) уходят как локальный yyyy-MM-dd, datetime — как ISO Z.
    onChange(serializeDateInput(newValue, dateOnly))
  }
```

- [ ] **Step 2: Починить todayIso в financing-plan-upload**

В `src/pages/financing-plan-upload/financing-plan-upload-list/ui/financing-plan-upload-page.tsx` добавить импорт `format` из date-fns (проверить, нет ли уже) и заменить строку 47.

Импорт вверху файла (среди сторонних):

```ts
import { format } from 'date-fns'
```

Заменить:

```ts
const todayIso = () => new Date().toISOString().slice(0, 10)
```

на:

```ts
// SCRUM-265 FE-6: локальная календарная дата; toISOString().slice до 05:00 в КЗ
// возвращал вчерашний день.
const todayIso = () => format(new Date(), 'yyyy-MM-dd')
```

- [ ] **Step 3: Прогнать существующие тесты инпутов (регресс)**

Run: `npx vitest run src/shared/ui/inputs`
Expected: PASS (все существующие тесты инпутов + `serialize-date-input.test.ts` зелёные). Если у `datetime-input` тестов нет — прогон не упадёт на этом файле.

- [ ] **Step 4: Коммит**

```bash
git add src/shared/ui/inputs/datetime-input.tsx src/pages/financing-plan-upload/financing-plan-upload-list/ui/financing-plan-upload-page.tsx
git commit -m "fix: DATE-поля и todayIso сериализуются как локальный yyyy-MM-dd (SCRUM-265 FE-6)"
```

**Верификация (e2e, ручная, после деплоя бэка волны 4):** Табель → новая форма → Организация + период 01.07–31.07 из пикера → «Заполнить» → таблица заполняется (раньше — ошибка «период внутри одного месяца»). В devtools Network payload EVENT: дата уходит как `"2026-07-01"` без `T…Z`.

---

## Feature 2 — Treasury: страница «Выгрузка документов в казначейство»

### Task 3: Типы, API и хук preview

**Files:**
- Create: `src/features/treasury-export/types/treasury-export.ts`
- Create: `src/features/treasury-export/api/treasury-export-api.ts`
- Create: `src/features/treasury-export/lib/hooks/use-treasury-export-preview.ts`
- Create: `src/features/treasury-export/index.ts`
- Test: `src/features/treasury-export/lib/hooks/use-treasury-export-preview.test.ts`

**Interfaces:**
- Produces:
  - `interface TreasuryExportItem { typeCode: string; id: number }`
  - `interface TreasuryExportPreviewRow { n: number; documentId: number; typeCode: string; presentation: string; amount: number | null; errors: string[]; fileName: string | null }`
  - `interface TreasuryExportPreviewResponse { rows: TreasuryExportPreviewRow[]; hasErrors: boolean }`
  - `previewTreasuryExport(items: TreasuryExportItem[], signal?: AbortSignal): Promise<AxiosResponse<ApiResponse<TreasuryExportPreviewResponse>>>`
  - `useTreasuryExportPreview(): UseMutationResult<TreasuryExportPreviewResponse, unknown, TreasuryExportItem[]>`

- [ ] **Step 1: Создать типы**

```ts
// src/features/treasury-export/types/treasury-export.ts

/** Документ для выгрузки в казначейство. */
export interface TreasuryExportItem {
  typeCode: string
  id: number
}

/** Строка таблицы «Выгружаемые документы» (ответ preview). */
export interface TreasuryExportPreviewRow {
  n: number
  documentId: number
  typeCode: string
  presentation: string
  amount: number | null
  errors: string[]
  fileName: string | null
}

/** Ответ POST /api/treasury-export/preview (в `data` обёртки ApiResponse). */
export interface TreasuryExportPreviewResponse {
  rows: TreasuryExportPreviewRow[]
  hasErrors: boolean
}
```

- [ ] **Step 2: Создать API**

```ts
// src/features/treasury-export/api/treasury-export-api.ts
import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import type {
  TreasuryExportItem,
  TreasuryExportPreviewResponse,
} from '../types/treasury-export'

/**
 * Построчная проверка пакета документов (строит таблицу «Выгружаемые документы»).
 * POST /api/treasury-export/preview — 200 даже при ошибках строк.
 */
export const previewTreasuryExport = (
  items: TreasuryExportItem[],
  signal?: AbortSignal
) =>
  apiService.post<ApiResponse<TreasuryExportPreviewResponse>>({
    url: '/api/treasury-export/preview',
    data: { items },
    signal,
  })
```

- [ ] **Step 3: Написать падающий тест хука**

```tsx
// src/features/treasury-export/lib/hooks/use-treasury-export-preview.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useTreasuryExportPreview } from './use-treasury-export-preview'
import * as api from '../../api/treasury-export-api'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useTreasuryExportPreview', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('возвращает распакованный data из обёртки ApiResponse', async () => {
    vi.spyOn(api, 'previewTreasuryExport').mockResolvedValue({
      data: {
        data: {
          rows: [
            {
              n: 1,
              documentId: 42,
              typeCode: 'ZayavkaNaRegistratsiyuGPSdelki',
              presentation: 'Заявка AAC00-00007',
              amount: 5000,
              errors: ['Не указан номер счета банка контрагента!'],
              fileName: 'ЗаявкаГПСAAC00-00007.xml',
            },
          ],
          hasErrors: true,
        },
        success: true,
      },
    } as never)

    const { result } = renderHook(() => useTreasuryExportPreview(), { wrapper })
    result.current.mutate([{ typeCode: 'ZayavkaNaRegistratsiyuGPSdelki', id: 42 }])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.hasErrors).toBe(true)
    expect(result.current.data?.rows[0].fileName).toBe('ЗаявкаГПСAAC00-00007.xml')
  })
})
```

- [ ] **Step 4: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/treasury-export/lib/hooks/use-treasury-export-preview.test.ts`
Expected: FAIL — `Failed to resolve import './use-treasury-export-preview'`.

- [ ] **Step 5: Реализовать хук**

```ts
// src/features/treasury-export/lib/hooks/use-treasury-export-preview.ts
import { useMutation } from '@tanstack/react-query'

import { previewTreasuryExport } from '../../api/treasury-export-api'
import type {
  TreasuryExportItem,
  TreasuryExportPreviewResponse,
} from '../../types/treasury-export'

/** Мутация проверки документов — возвращает data из обёртки ApiResponse. */
export const useTreasuryExportPreview = () =>
  useMutation<TreasuryExportPreviewResponse, unknown, TreasuryExportItem[]>({
    mutationFn: async (items) => {
      const res = await previewTreasuryExport(items)
      return res.data.data
    },
  })
```

- [ ] **Step 6: Создать barrel слайса**

```ts
// src/features/treasury-export/index.ts
export { TreasuryExportPage } from './ui/treasury-export-page'
export type {
  TreasuryExportItem,
  TreasuryExportPreviewRow,
  TreasuryExportPreviewResponse,
} from './types/treasury-export'
```

> Примечание: `./ui/treasury-export-page` появится в Task 6 — barrel ссылается на него заранее (файл создаётся до первого прогона тестов Task 6; до тех пор `index.ts` не импортируется тестами Task 3–5).

- [ ] **Step 7: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/features/treasury-export/lib/hooks/use-treasury-export-preview.test.ts`
Expected: PASS (1 тест).

- [ ] **Step 8: Коммит**

```bash
git add src/features/treasury-export/types src/features/treasury-export/api src/features/treasury-export/lib
git commit -m "add: типы, api и хук preview для выгрузки в казначейство (SCRUM-265)"
```

### Task 4: Чистая функция URL одиночного скачивания

**Files:**
- Create: `src/features/treasury-export/lib/download-url.ts`
- Test: `src/features/treasury-export/lib/download-url.test.ts`

**Interfaces:**
- Produces: `treasuryExportDownloadUrl(typeCode: string, id: number): string` — абсолютный URL GET-эндпоинта одиночного документа.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/treasury-export/lib/download-url.test.ts
import { describe, it, expect } from 'vitest'

import { treasuryExportDownloadUrl } from './download-url'

describe('treasuryExportDownloadUrl', () => {
  it('строит абсолютный GET-URL одиночного документа', () => {
    const url = treasuryExportDownloadUrl('ZayavkaNaRegistratsiyuGPSdelki', 27855630)
    expect(url).toMatch(
      /\/api\/document-entries\/ZayavkaNaRegistratsiyuGPSdelki\/27855630\/treasury-export$/
    )
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/treasury-export/lib/download-url.test.ts`
Expected: FAIL — import не резолвится.

- [ ] **Step 3: Реализовать функцию**

```ts
// src/features/treasury-export/lib/download-url.ts

/**
 * URL GET-эндпоинта одиночного документа для нативной навигации браузера
 * (SCRUM-265 v7 §2.1). Имя файла берётся браузером из Content-Disposition —
 * JS его НЕ формирует, поэтому blob+<a download> UUID-бага нет по построению.
 */
export function treasuryExportDownloadUrl(typeCode: string, id: number): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  return `${base}/api/document-entries/${typeCode}/${id}/treasury-export`
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/features/treasury-export/lib/download-url.test.ts`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/treasury-export/lib/download-url.ts src/features/treasury-export/lib/download-url.test.ts
git commit -m "add: treasuryExportDownloadUrl для нативной GET-навигации (SCRUM-265)"
```

### Task 5: i18n-ключи и компонент таблицы превью

**Files:**
- Modify: `src/app/config/i18n/locales/ru/common.json`
- Modify: `src/app/config/i18n/locales/kz/common.json`
- Create: `src/features/treasury-export/ui/treasury-export-table.tsx`
- Test: `src/features/treasury-export/ui/treasury-export-table.test.tsx`

**Interfaces:**
- Consumes: `TreasuryExportPreviewRow` (Task 3).
- Produces: `TreasuryExportTable({ rows }: { rows: TreasuryExportPreviewRow[] })` — таблица N / Документ / Сумма / Ошибки (красным при непустых) / Имя файла.

- [ ] **Step 1: Добавить i18n-ключи (ru)**

В `src/app/config/i18n/locales/ru/common.json` добавить на верхнем уровне объекта (рядом с прочими секциями) ключ `treasuryExport`:

```json
"treasuryExport": {
  "title": "Выгрузка документов в казначейство",
  "colN": "N",
  "colDocument": "Документ",
  "colAmount": "Сумма документа",
  "colErrors": "Ошибки",
  "colFileName": "Имя файла",
  "export": "Выгрузить",
  "cancel": "Отмена",
  "includeMxFields": "Включать поля формата MX",
  "mxFieldsSoon": "МХ-формат — в разработке",
  "filesDownloadedByBrowser": "Файлы будут скачаны браузером",
  "errorDetailsTitle": "Подробный текст ошибок проверки",
  "noErrors": "Ошибок нет",
  "hasErrorsToast": "Обнаружены ошибки — выгрузка не выполнена",
  "loadFailed": "Не удалось проверить документы"
}
```

- [ ] **Step 2: Добавить i18n-ключи (kz)**

В `src/app/config/i18n/locales/kz/common.json` — тот же ключ `treasuryExport` (казахские значения; аналитик/переводчик уточнит при необходимости):

```json
"treasuryExport": {
  "title": "Құжаттарды қазынашылыққа жүктеу",
  "colN": "N",
  "colDocument": "Құжат",
  "colAmount": "Құжат сомасы",
  "colErrors": "Қателер",
  "colFileName": "Файл атауы",
  "export": "Жүктеу",
  "cancel": "Болдырмау",
  "includeMxFields": "MX форматының өрістерін қосу",
  "mxFieldsSoon": "MX форматы — әзірленуде",
  "filesDownloadedByBrowser": "Файлдар браузермен жүктеледі",
  "errorDetailsTitle": "Тексеру қателерінің толық мәтіні",
  "noErrors": "Қателер жоқ",
  "hasErrorsToast": "Қателер табылды — жүктеу орындалмады",
  "loadFailed": "Құжаттарды тексеру мүмкін болмады"
}
```

- [ ] **Step 3: Написать падающий тест таблицы**

```tsx
// src/features/treasury-export/ui/treasury-export-table.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TreasuryExportTable } from './treasury-export-table'
import type { TreasuryExportPreviewRow } from '../types/treasury-export'

const rows: TreasuryExportPreviewRow[] = [
  {
    n: 1,
    documentId: 42,
    typeCode: 'ZayavkaNaRegistratsiyuGPSdelki',
    presentation: 'Заявка AAC00-00007',
    amount: 5000,
    errors: ['Не указан номер счета банка контрагента!'],
    fileName: 'ЗаявкаГПСAAC00-00007.xml',
  },
]

describe('TreasuryExportTable', () => {
  it('рендерит презентацию, имя файла и построчные ошибки', () => {
    render(<TreasuryExportTable rows={rows} />)
    expect(screen.getByText('Заявка AAC00-00007')).toBeInTheDocument()
    expect(screen.getByText('ЗаявкаГПСAAC00-00007.xml')).toBeInTheDocument()
    expect(
      screen.getByText(/Не указан номер счета банка контрагента!/)
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/treasury-export/ui/treasury-export-table.test.tsx`
Expected: FAIL — import `./treasury-export-table` не резолвится.

- [ ] **Step 5: Реализовать таблицу**

```tsx
// src/features/treasury-export/ui/treasury-export-table.tsx
import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import type { TreasuryExportPreviewRow } from '../types/treasury-export'

interface Props {
  rows: TreasuryExportPreviewRow[]
}

/** Таблица «Выгружаемые документы» (паритет 1С). Готова к многострочности. */
export const TreasuryExportTable = ({ rows }: Props) => {
  const { t } = useTranslation()

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('treasuryExport.colN')}</TableCell>
          <TableCell>{t('treasuryExport.colDocument')}</TableCell>
          <TableCell align="right">{t('treasuryExport.colAmount')}</TableCell>
          <TableCell>{t('treasuryExport.colErrors')}</TableCell>
          <TableCell>{t('treasuryExport.colFileName')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.typeCode}-${row.documentId}`}>
            <TableCell>{row.n}</TableCell>
            <TableCell>
              <Typography variant="body2">{row.presentation}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2">{row.amount ?? ''}</Typography>
            </TableCell>
            <TableCell>
              {row.errors.length > 0 && (
                <Typography variant="body2" color="error">
                  {row.errors.join('; ')}
                </Typography>
              )}
            </TableCell>
            <TableCell>
              <Typography variant="body2">{row.fileName ?? ''}</Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 6: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/features/treasury-export/ui/treasury-export-table.test.tsx`
Expected: PASS.

- [ ] **Step 7: Коммит**

```bash
git add src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json src/features/treasury-export/ui/treasury-export-table.tsx src/features/treasury-export/ui/treasury-export-table.test.tsx
git commit -m "add: i18n-ключи и таблица превью выгрузки в казначейство (SCRUM-265)"
```

### Task 6: Страница treasury-export + роут + validate-before-download

**Files:**
- Create: `src/features/treasury-export/ui/treasury-export-page.tsx`
- Test: `src/features/treasury-export/ui/treasury-export-page.test.tsx`
- Modify: `src/app/App.tsx` (lazy-импорт + `<Route path="/treasury-export">`)

**Interfaces:**
- Consumes: `useTreasuryExportPreview` (Task 3), `treasuryExportDownloadUrl` (Task 4), `TreasuryExportTable` (Task 5), `TreasuryExportItem` (Task 3).
- Produces: `TreasuryExportPage()` — экспортируется из `features/treasury-export/index.ts` (Task 3).

Поведение: при маунте читает `?typeCode&id`, дёргает preview с одним item (авто-preview → таблица заполняется сразу). «Выгрузить»: повторный preview; если результат `hasErrors` — тост + блок ошибок, НЕ навигировать; иначе `window.location.assign(treasuryExportDownloadUrl(...))`. «Отмена» → `navigate(-1)`. Чекбокс «Включать поля формата MX» — disabled + tooltip. Блок «Подробный текст ошибок проверки» под таблицей = `rows.flatMap(r => r.errors)`.

- [ ] **Step 1: Написать падающий тест страницы**

```tsx
// src/features/treasury-export/ui/treasury-export-page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TreasuryExportPage } from './treasury-export-page'
import * as api from '../api/treasury-export-api'

const renderPage = (search: string) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/treasury-export${search}`]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  )
  return render(<TreasuryExportPage />, { wrapper: Wrapper })
}

const mockPreview = (hasErrors: boolean, errors: string[] = []) =>
  vi.spyOn(api, 'previewTreasuryExport').mockResolvedValue({
    data: {
      data: {
        rows: [
          {
            n: 1,
            documentId: 42,
            typeCode: 'ZayavkaNaRegistratsiyuGPSdelki',
            presentation: 'Заявка AAC00-00007',
            amount: 5000,
            errors,
            fileName: 'ЗаявкаГПСAAC00-00007.xml',
          },
        ],
        hasErrors,
      },
      success: true,
    },
  } as never)

describe('TreasuryExportPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('location', { assign: vi.fn() } as unknown as Location)
  })

  it('авто-preview при маунте заполняет таблицу', async () => {
    mockPreview(false)
    renderPage('?typeCode=ZayavkaNaRegistratsiyuGPSdelki&id=42')
    await waitFor(() =>
      expect(screen.getByText('Заявка AAC00-00007')).toBeInTheDocument()
    )
    expect(api.previewTreasuryExport).toHaveBeenCalledWith([
      { typeCode: 'ZayavkaNaRegistratsiyuGPSdelki', id: 42 },
    ])
  })

  it('чистый результат по «Выгрузить» → навигация на GET-URL', async () => {
    mockPreview(false)
    renderPage('?typeCode=ZayavkaNaRegistratsiyuGPSdelki&id=42')
    await screen.findByText('Заявка AAC00-00007')
    await userEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))
    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/document-entries/ZayavkaNaRegistratsiyuGPSdelki/42/treasury-export'
        )
      )
    )
  })

  it('hasErrors по «Выгрузить» → нет навигации, показан блок ошибок', async () => {
    mockPreview(true, ['Не указан номер счета банка контрагента!'])
    renderPage('?typeCode=ZayavkaNaRegistratsiyuGPSdelki&id=42')
    await screen.findByText('Заявка AAC00-00007')
    await userEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))
    await waitFor(() =>
      expect(
        screen.getAllByText(/Не указан номер счета банка контрагента!/).length
      ).toBeGreaterThan(0)
    )
    expect(window.location.assign).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/treasury-export/ui/treasury-export-page.test.tsx`
Expected: FAIL — import `./treasury-export-page` не резолвится.

- [ ] **Step 3: Реализовать страницу**

```tsx
// src/features/treasury-export/ui/treasury-export-page.tsx
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Typography,
} from '@mui/material'

import { showToast } from '@/shared/ui/toast/show-toast'

import { useTreasuryExportPreview } from '../lib/hooks/use-treasury-export-preview'
import { treasuryExportDownloadUrl } from '../lib/download-url'
import { TreasuryExportTable } from './treasury-export-table'
import type {
  TreasuryExportItem,
  TreasuryExportPreviewResponse,
} from '../types/treasury-export'

/**
 * Страница «Выгрузка документов в казначейство» (SCRUM-265 v6+v7).
 * Легаси-контур: SDUI-эффект navigate наводит на роут /treasury-export.
 * MVP — один документ (?typeCode&id); скачивание — нативная GET-навигация.
 */
export const TreasuryExportPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const typeCode = params.get('typeCode') ?? ''
  const idParam = params.get('id')
  const id = idParam != null ? Number(idParam) : NaN

  const preview = useTreasuryExportPreview()
  const previewMutate = preview.mutate

  // Авто-preview при маунте (в 1С колонки пусты до «Выгрузить» — осознанное
  // отличие ради UX, помечено аналитику). Один прогон на валидные параметры.
  const didAutoPreview = useRef(false)
  useEffect(() => {
    if (didAutoPreview.current) return
    if (!typeCode || Number.isNaN(id)) return
    didAutoPreview.current = true
    previewMutate([{ typeCode, id }])
  }, [typeCode, id, previewMutate])

  const item: TreasuryExportItem = { typeCode, id }

  const handleExport = () => {
    if (!typeCode || Number.isNaN(id)) return
    // Валидация перед скачиванием (v7 §2.1): при ошибках не навигируем.
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
  }

  const rows = preview.data?.rows ?? []
  const allErrors = rows.flatMap((r) => r.errors)

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <Typography variant="h6">{t('treasuryExport.title')}</Typography>

      <div className="flex items-center gap-3">
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={preview.isPending || !typeCode || Number.isNaN(id)}
        >
          {t('treasuryExport.export')}
        </Button>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          {t('treasuryExport.cancel')}
        </Button>
      </div>

      <Tooltip title={t('treasuryExport.mxFieldsSoon')}>
        <span style={{ width: 'fit-content' }}>
          <FormControlLabel
            control={<Checkbox size="small" disabled />}
            label={t('treasuryExport.includeMxFields')}
          />
        </span>
      </Tooltip>

      <Typography variant="caption" color="text.secondary">
        {t('treasuryExport.filesDownloadedByBrowser')}
      </Typography>

      <TreasuryExportTable rows={rows} />

      <div>
        <Typography variant="subtitle2">
          {t('treasuryExport.errorDetailsTitle')}
        </Typography>
        {allErrors.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('treasuryExport.noErrors')}
          </Typography>
        ) : (
          <ul className="mt-1 list-disc pl-5">
            {allErrors.map((err, i) => (
              <li key={i}>
                <Typography variant="body2" color="error">
                  {err}
                </Typography>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/features/treasury-export/ui/treasury-export-page.test.tsx`
Expected: PASS (3 теста). Если `userEvent.click` не находит кнопку по имени — проверить, что i18n в тестовой среде отдаёт русские строки (иначе искать по `t`-ключу; в проекте тесты обычно инициализируют i18n — свериться с существующим тестом, например `document-list-toolbar`).

- [ ] **Step 5: Зарегистрировать роут в App.tsx**

В `src/app/App.tsx` добавить lazy-импорт рядом с остальными (например после `FinancingPlanUploadPage`):

```ts
const TreasuryExportPage = lazy(() =>
  import('@/features/treasury-export').then((m) => ({
    default: m.TreasuryExportPage,
  }))
)
```

И внутри `<Routes>` (верхнеуровневый роут, рядом с `/`):

```tsx
<Route path="/treasury-export" element={<TreasuryExportPage />} />
```

- [ ] **Step 6: Прогнать все тесты слайса (регресс)**

Run: `npx vitest run src/features/treasury-export`
Expected: PASS (хук + download-url + таблица + страница).

- [ ] **Step 7: Коммит**

```bash
git add src/features/treasury-export/ui/treasury-export-page.tsx src/features/treasury-export/ui/treasury-export-page.test.tsx src/features/treasury-export/index.ts src/app/App.tsx
git commit -m "feat: страница /treasury-export — выгрузка документов в казначейство (SCRUM-265)"
```

**Верификация (e2e, ручная):** документ Заявка ГПС → «Выгрузить в казначейство» → SDUI-эффект navigate ведёт на `/treasury-export?typeCode=…&id=…` → таблица заполнена, ошибок нет → «Выгрузить» → файл `ЗаявкаГПС<Номер>.xml` (в Network — GET с `Content-Disposition`), страница не уходит. Документ с ошибками → блок «Подробный текст ошибок проверки» + тост, скачивания нет.

---

## Feature 3 — FE-5: адаптивный overflow командной панели

### Task 7: Чистая функция распределения overflow

**Files:**
- Create: `src/features/sdui/lib/overflow/compute-overflow.ts`
- Test: `src/features/sdui/lib/overflow/compute-overflow.test.ts`

**Interfaces:**
- Produces:
  - `interface OverflowItem { id: string; width: number; pinned: boolean }`
  - `computeOverflow(items: OverflowItem[], availableWidth: number, moreWidth: number): string[]` — возвращает id, которые надо СВЕРНУТЬ. Правило: сворачивать непиновые справа-налево, пока сумма ширин видимых (+ `moreWidth`, зарезервированной под «Ещё») не влезет в `availableWidth`. `pinned`-элементы (`btn.postClose`, `btn.more`, `spacer.more`) не сворачиваются никогда.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/sdui/lib/overflow/compute-overflow.test.ts
import { describe, it, expect } from 'vitest'

import { computeOverflow, type OverflowItem } from './compute-overflow'

const item = (id: string, width: number, pinned = false): OverflowItem => ({
  id,
  width,
  pinned,
})

describe('computeOverflow', () => {
  const items: OverflowItem[] = [
    item('btn.postClose', 100, true),
    item('btn.save', 80),
    item('btn.post', 80),
    item('btn.print', 80),
    item('btn.reports', 80),
    item('spacer.more', 0, true),
    item('btn.more', 60, true),
  ]

  it('всё влезает → ничего не сворачивается', () => {
    expect(computeOverflow(items, 1000, 60)).toEqual([])
  })

  it('сворачивает справа-налево пока не влезет', () => {
    // pinned: postClose(100)+more(60)=160 всегда. Доступно 300 → бюджет под
    // непиновые = 300-160 = 140 → влезают save(80). print/reports/post(80*3)
    // уходят: сворачиваются reports, print, post (справа-налево), останется save.
    expect(computeOverflow(items, 300, 60)).toEqual([
      'btn.reports',
      'btn.print',
      'btn.post',
    ])
  })

  it('pinned не сворачиваются даже при нулевой ширине', () => {
    const collapsed = computeOverflow(items, 10, 60)
    expect(collapsed).not.toContain('btn.postClose')
    expect(collapsed).not.toContain('btn.more')
    expect(collapsed).not.toContain('spacer.more')
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/lib/overflow/compute-overflow.test.ts`
Expected: FAIL — import не резолвится.

- [ ] **Step 3: Реализовать функцию**

```ts
// src/features/sdui/lib/overflow/compute-overflow.ts

export interface OverflowItem {
  id: string
  width: number
  /** Никогда не сворачивается (btn.postClose, btn.more, spacer.more). */
  pinned: boolean
}

/**
 * Распределение кнопок командной панели по ширине (SCRUM-265 FE-5).
 * Возвращает id непиновых элементов, которые надо свернуть в «Ещё».
 * Сворачивание справа-налево (первыми уходят ближние к «Ещё»); pinned остаются.
 * `moreWidth` резервируется под кнопку «Ещё» (она уже учтена в pinned-сумме,
 * если присутствует в items; параметр — на случай, когда «Ещё» появляется
 * только при непустом overflow).
 */
export function computeOverflow(
  items: OverflowItem[],
  availableWidth: number,
  moreWidth: number
): string[] {
  const pinnedWidth = items
    .filter((i) => i.pinned)
    .reduce((sum, i) => sum + i.width, 0)
  const hasMoreInItems = items.some((i) => i.id === 'btn.more' && i.pinned)
  const reserved = pinnedWidth + (hasMoreInItems ? 0 : moreWidth)

  const collapsible = items.filter((i) => !i.pinned)
  const totalCollapsible = collapsible.reduce((sum, i) => sum + i.width, 0)

  if (reserved + totalCollapsible <= availableWidth) return []

  const budget = availableWidth - reserved
  const collapsed: string[] = []
  let visibleWidth = totalCollapsible

  // Сворачиваем с конца (справа-налево), пока видимые непиновые не влезут.
  for (let i = collapsible.length - 1; i >= 0 && visibleWidth > budget; i--) {
    collapsed.push(collapsible[i].id)
    visibleWidth -= collapsible[i].width
  }
  return collapsed
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/features/sdui/lib/overflow/compute-overflow.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/lib/overflow/compute-overflow.ts src/features/sdui/lib/overflow/compute-overflow.test.ts
git commit -m "add: computeOverflow — распределение кнопок командной панели по ширине (SCRUM-265 FE-5)"
```

### Task 8: Контекст overflow + рендер свёрнутых пунктов в меню «Ещё»

**Files:**
- Create: `src/features/sdui/lib/overflow/overflow-context.ts`
- Modify: `src/features/sdui/ui/nodes/action/button-node.tsx` (меню «Ещё» читает контекст)
- Test: `src/features/sdui/ui/nodes/action/button-node.test.tsx` (добавить кейс к существующему файлу)

**Interfaces:**
- Produces: `OverflowContext` (React context) со значением `{ collapsedNodes: ViewNode[] }` (default `{ collapsedNodes: [] }`); хук `useOverflowCollapsed(): ViewNode[]`.
- Consumes: `computeOverflow` не нужен здесь; `ViewNode` из `../../../types/view`.

Логика button-node: если `node.id === 'btn.more'` и `collapsedNodes` непусты — в начале `<Menu>` отрендерить свёрнутые узлы отдельной секцией (через `NodeRenderer`) + `<Divider>` перед штатными `mi.more.*`. Свёрнутые узлы — обычные BUTTON-ноды; внутри Menu MUI они рендерятся как кнопки-строки (кликабельны, диспатчат ту же команду, `enabled`/`tooltip` сохраняются рендером button-node). Для не-`btn.more` кнопок контекст игнорируется (default пустой).

- [ ] **Step 1: Создать контекст**

```ts
// src/features/sdui/lib/overflow/overflow-context.ts
import { createContext, useContext } from 'react'

import type { ViewNode } from '../../types/view'

interface OverflowContextValue {
  /** Узлы командной панели, свёрнутые в меню «Ещё» (FE-5). */
  collapsedNodes: ViewNode[]
}

export const OverflowContext = createContext<OverflowContextValue>({
  collapsedNodes: [],
})

export const useOverflowCollapsed = (): ViewNode[] =>
  useContext(OverflowContext).collapsedNodes
```

> Проверить путь к типам: из `src/features/sdui/lib/overflow/` до `types/view` это `../../types/view` (lib → sdui → types). Свериться с существующим импортом `ViewNode` в соседних файлах `lib/`.

- [ ] **Step 2: Написать падающий тест button-node (свёрнутая секция)**

Добавить в `src/features/sdui/ui/nodes/action/button-node.test.tsx` новый тест (импорт `OverflowContext` и рендер `btn.more` внутри провайдера со свёрнутым узлом):

```tsx
import { OverflowContext } from '../../../lib/overflow/overflow-context'

it('btn.more показывает свёрнутые узлы отдельной секцией в меню (FE-5)', async () => {
  const moreNode = {
    id: 'btn.more',
    type: 'BUTTON',
    props: { label: 'Ещё' },
    children: [
      { id: 'mi.more.x', type: 'MENU_ITEM', props: { label: 'Штатный пункт', command: 'x' } },
    ],
  } as never
  const collapsed = [
    { id: 'btn.reports', type: 'BUTTON', props: { label: 'Отчеты', command: 'reports' } },
  ] as never

  render(
    <OverflowContext.Provider value={{ collapsedNodes: collapsed }}>
      <ButtonNode node={moreNode} />
    </OverflowContext.Provider>
  )

  await userEvent.click(screen.getByRole('button', { name: 'Ещё' }))
  expect(screen.getByText('Отчеты')).toBeInTheDocument()
  expect(screen.getByText('Штатный пункт')).toBeInTheDocument()
})
```

> Свериться с шапкой существующего `button-node.test.tsx` (импорты `render`, `screen`, `userEvent`, `ButtonNode`) — использовать те же, не дублировать импорты.

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-node.test.tsx`
Expected: FAIL — «Отчеты» не отрендерен (секция ещё не добавлена).

- [ ] **Step 4: Подключить контекст в button-node**

В `src/features/sdui/ui/nodes/action/button-node.tsx`:

Добавить импорты:

```ts
import { Divider } from '@mui/material'
import { useOverflowCollapsed } from '../../../lib/overflow/overflow-context'
```

Внутри компонента (рядом с прочими хуками):

```ts
  const collapsedNodes = useOverflowCollapsed()
  const isMoreButton = node.id === 'btn.more'
  const overflowNodes = isMoreButton ? collapsedNodes : []
```

Заменить рендер `<Menu>`:

```tsx
      {isDropdown && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => { setMenuAnchor(null); }}
        >
          {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
        </Menu>
      )}
```

на:

```tsx
      {isDropdown && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => { setMenuAnchor(null); }}
        >
          {/* FE-5: свёрнутые по ширине кнопки — верхней секцией перед штатными пунктами. */}
          {overflowNodes.map((c) => <NodeRenderer key={c.id} node={c} />)}
          {overflowNodes.length > 0 && <Divider />}
          {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
        </Menu>
      )}
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-node.test.tsx`
Expected: PASS (существующие + новый).

- [ ] **Step 6: Коммит**

```bash
git add src/features/sdui/lib/overflow/overflow-context.ts src/features/sdui/ui/nodes/action/button-node.tsx src/features/sdui/ui/nodes/action/button-node.test.tsx
git commit -m "add: overflow-контекст и секция свёрнутых кнопок в меню «Ещё» (SCRUM-265 FE-5)"
```

### Task 9: Измерение ширины в toolbar-node и провайдинг свёрнутых узлов

**Files:**
- Modify: `src/features/sdui/ui/nodes/layout/toolbar-node.tsx`

**Interfaces:**
- Consumes: `computeOverflow`, `OverflowItem` (Task 7), `OverflowContext` (Task 8).

Логика: toolbar-node измеряет доступную ширину контейнера (`ResizeObserver`) и ширины детей (refs по каждому ребёнку). Помечает `pinned` по id (`btn.postClose`, `btn.more`, `spacer.more`). Вызывает `computeOverflow` → `collapsedIds`. Видимые дети рендерятся в ряд; свёрнутые узлы кладутся в `OverflowContext` (их прочитает `btn.more`, Task 8). Гистерезис: пересчитывать только при изменении ширины контейнера > порога (например 4px), чтобы не мигать на границе.

- [ ] **Step 1: Реализовать измерение и провайдинг**

```tsx
// src/features/sdui/ui/nodes/layout/toolbar-node.tsx
import { useLayoutEffect, useRef, useState, type FC } from 'react'

import type { NodeProps, ViewNode } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'
import { OverflowContext } from '../../../lib/overflow/overflow-context'
import {
  computeOverflow,
  type OverflowItem,
} from '../../../lib/overflow/compute-overflow'

const PINNED_IDS = new Set(['btn.postClose', 'btn.more', 'spacer.more'])
const HYSTERESIS_PX = 4

export const ToolbarNode: FC<NodeProps> = ({ node }) => {
  const children = node.children ?? []
  const containerRef = useRef<HTMLDivElement>(null)
  const childRefs = useRef<Map<string, HTMLElement>>(new Map())
  const lastWidth = useRef(0)
  const [collapsedIds, setCollapsedIds] = useState<string[]>([])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const recompute = () => {
      const available = container.clientWidth
      if (Math.abs(available - lastWidth.current) < HYSTERESIS_PX) return
      lastWidth.current = available

      const items: OverflowItem[] = children.map((c) => ({
        id: c.id,
        width: childRefs.current.get(c.id)?.offsetWidth ?? 0,
        pinned: PINNED_IDS.has(c.id),
      }))
      const moreWidth = childRefs.current.get('btn.more')?.offsetWidth ?? 0
      setCollapsedIds(computeOverflow(items, available, moreWidth))
    }

    const observer = new ResizeObserver(recompute)
    observer.observe(container)
    recompute()
    return () => { observer.disconnect(); }
  }, [children])

  const collapsedSet = new Set(collapsedIds)
  const collapsedNodes: ViewNode[] = children.filter((c) =>
    collapsedSet.has(c.id)
  )

  return (
    <OverflowContext.Provider value={{ collapsedNodes }}>
      <div ref={containerRef} className="flex items-center gap-1">
        {children.map((c) => (
          <div
            key={c.id}
            ref={(el) => {
              if (el) childRefs.current.set(c.id, el)
              else childRefs.current.delete(c.id)
            }}
            style={{ display: collapsedSet.has(c.id) ? 'none' : 'inline-flex' }}
          >
            <NodeRenderer node={c} />
          </div>
        ))}
      </div>
    </OverflowContext.Provider>
  )
}
```

> Примечание по измерению: свёрнутые дети остаются в DOM с `display:none` — их `offsetWidth` станет 0, поэтому при расширении окна их ширину брать из последнего известного значения. Для MVP это приемлемо: при расширении контейнер станет шире доступного бюджета и `computeOverflow` вернёт `[]` (все видимы) на следующем тике. Если на стенде будет заметно «залипание» — заменить `display:none` на off-screen позиционирование (`position:absolute; visibility:hidden`), сохраняющее `offsetWidth`. Отметить при живой проверке.

- [ ] **Step 2: Прогнать тесты SDUI-узлов (регресс)**

Run: `npx vitest run src/features/sdui/ui/nodes`
Expected: PASS. В jsdom `offsetWidth` = 0 и `ResizeObserver` может отсутствовать — если существующие тесты toolbar/формы падают на `ResizeObserver is not defined`, добавить полифилл в тестовый сетап проекта (`vitest.setup`): проверить, есть ли он уже; если нет — заглушка:
```ts
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never
```
(добавлять только если прогон реально падает на отсутствии ResizeObserver).

- [ ] **Step 3: Коммит**

```bash
git add src/features/sdui/ui/nodes/layout/toolbar-node.tsx
git commit -m "feat: адаптивный overflow командной панели по ширине окна (SCRUM-265 FE-5)"
```

**Верификация (e2e, ручная):** форма Увольнения в широком окне — полный ряд кнопок; сузить окно — «Отчеты», затем «Печать» уходят в «Ещё» (верхняя секция меню), команды работают; расширить — возвращаются в исходном порядке. `btn.postClose` и «Ещё» видимы при любой ширине. Регресс: FE-1..FE-4 не задеты.

---

## Финальная проверка (по завершении всех трёх кусков)

- [ ] **Прогнать полный набор юнит-тестов**

Run: `npx vitest run`
Expected: все тесты зелёные (включая новые: serialize-date-input, treasury-export ×4, compute-overflow, button-node).

- [ ] **Типы и сборка (по явной готовности к передаче)**

Run: `npx tsc --noEmit && npm run build`
Expected: без ошибок.

- [ ] **Обновить статус в Jira и передать бэку/тестировщику** согласно workflow «Спеки в Jira» (CLAUDE.local.md): при необходимости сгенерировать фронт-спеку об исполнении, приложить и перевести таску в нужную колонку.

---

## Self-Review (выполнено при написании плана)

**Покрытие спеки:**
- FE-6 (spec §1) → Task 1–2 (serializeDateInput + wiring + todayIso). ✓
- Treasury страница/роут (spec §2.1) → Task 6 (роут в App.tsx). ✓
- Treasury API preview (spec §2.2) → Task 3. ✓
- Treasury download нативной GET-навигацией (spec §2.4, v7 §2.1) → Task 4 + Task 6 (validate-before-download). ✓
- Treasury UI: таблица (§2.3) → Task 5; авто-preview, чекбокс disabled, блок ошибок, «Каталог» не рисуем (§2.3) → Task 6. ✓
- Пакетный ZIP — сознательно отложен (design §2.4, фаза 2); в плане не реализуется. ✓
- FE-5 поведение (spec §3) → Task 7 (распределение), Task 8 (рендер в «Ещё»), Task 9 (измерение). ✓

**Плейсхолдеры:** нет TBD/TODO; весь код и тесты приведены целиком.

**Согласованность типов:** `TreasuryExportItem`/`TreasuryExportPreviewRow`/`TreasuryExportPreviewResponse` определены в Task 3 и используются одинаково в Task 4–6; `previewTreasuryExport`/`useTreasuryExportPreview`/`treasuryExportDownloadUrl` — единые сигнатуры сквозь задачи; `OverflowItem`/`computeOverflow` (Task 7) совпадают с использованием в Task 9; `OverflowContext`/`useOverflowCollapsed` (Task 8) — с button-node и toolbar-node.

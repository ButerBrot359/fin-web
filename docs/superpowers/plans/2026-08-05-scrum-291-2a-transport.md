# SCRUM-291 · 2a — транспорт SEARCH · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Научить SDUI-список ходить POST-транспортом (`SEARCH`) с видимой ошибкой загрузки и счётчиком без `total`, обратносовместимо с текущим `PAGED`.

**Architecture:** Расширяем `fetchListPage` второй веткой (POST + body), пробрасываем `method`/`body` из `source` через `queryKey` и `queryFn` в `ListNode`, добавляем видимую ветку `isError` и чистый хелпер выбора метки счётчика. Сам UI сортировки/фильтров/периода (2b/2c/2d) не трогаем — только транспорт, который их понесёт.

**Tech Stack:** React 19, TanStack Query (`useInfiniteQuery`), axios (`apiService`), i18next, vitest + @testing-library/react.

## Global Constraints

- Тексты — только через `useTranslation`/`common.json`, не хардкодить в JSX.
- Не запускать `tsc`/`lint`/`build` после каждого шага; vitest ограничивать `--dir src/features/sdui`.
- Правки только в SDUI-контуре (`src/features/sdui/`, i18n). Легаси не трогать.
- Обратная совместимость `PAGED` обязательна: без `method` поведение GET не меняется.
- Формат коммита: `feat|fix|add|refactor: описание`. В конце каждого коммита — трейлеры:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Ly3SAAXrGLMh2xG9DKDKhX
  ```
- Порядок деплоя (для описания PR, не код): фронт с 2a уходит в прод РАНЬШЕ флипа `transport:SEARCH` на бэке; обратный порядок → молчаливый 400.

## File Structure

- `src/features/sdui/api/reference-options.ts` — modify: `fetchListPage` += POST-ветка; `PagedListResponse.data.totalElements` → опционально.
- `src/features/sdui/api/reference-options.test.ts` — create: юнит транспорта.
- `src/features/sdui/ui/nodes/composite/list-node.tsx` — modify: `ListSource` += `method`/`body`; `queryKey`; проброс в `queryFn`; ветка `isError`; счётчик через хелпер.
- `src/features/sdui/ui/nodes/composite/list-node.test.tsx` — create: queryKey/queryFn проброс + ветка `isError`.
- `src/features/sdui/ui/nodes/composite/list-loaded-count.ts` — create: чистый хелпер метки счётчика.
- `src/features/sdui/ui/nodes/composite/list-loaded-count.test.ts` — create: юнит хелпера.
- `src/app/config/i18n/locales/ru/common.json` + `.../kz/common.json` — modify: `table.loadError`, `table.loadedCountNoTotal`.

---

### Task 1: `fetchListPage` — POST-ветка и опциональный `totalElements`

**Files:**

- Modify: `src/features/sdui/api/reference-options.ts`
- Test: `src/features/sdui/api/reference-options.test.ts` (create)

**Interfaces:**

- Produces: `fetchListPage(args: { url; params?: Record<string,string>; method?: string; body?: unknown; page: number; size: number; search?: string; signal?: AbortSignal }): Promise<PagedListResponse>` где `PagedListResponse.data.totalElements?: number`.

- [ ] **Step 1: Написать падающие тесты**

Create `src/features/sdui/api/reference-options.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn(), post: vi.fn() },
}))

import { apiService } from '@/shared/api/api'
import { fetchListPage } from './reference-options'

describe('fetchListPage — транспорт', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset()
    vi.mocked(apiService.post).mockReset()
  })

  it('method POST → apiService.post с data:body и page/size в params', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: { data: { content: [], last: true, number: 0 } },
    } as never)

    await fetchListPage({
      url: '/x/search',
      method: 'POST',
      params: { sortAttr: 'Data' },
      body: { filters: [], logic: 'AND' },
      page: 0,
      size: 25,
    })

    expect(apiService.post).toHaveBeenCalledWith({
      url: '/x/search',
      params: { sortAttr: 'Data', page: 0, size: 25 },
      data: { filters: [], logic: 'AND' },
      signal: undefined,
    })
    expect(apiService.get).not.toHaveBeenCalled()
  })

  it('без method → apiService.get, body не уходит (регресс PAGED)', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { data: { content: [], totalElements: 0, last: true, number: 0 } },
    } as never)

    await fetchListPage({
      url: '/x/paged',
      params: { sortAttr: 'Data' },
      page: 0,
      size: 25,
    })

    expect(apiService.get).toHaveBeenCalledWith({
      url: '/x/paged',
      params: { sortAttr: 'Data', page: 0, size: 25 },
      signal: undefined,
    })
    expect(apiService.post).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui src/features/sdui/api/reference-options.test.ts`
Expected: FAIL — POST-тест падает (`apiService.post` не вызывается; сегодня `fetchListPage` всегда GET).

- [ ] **Step 3: Реализовать POST-ветку**

В `src/features/sdui/api/reference-options.ts` сделать `totalElements` опциональным:

```ts
interface PagedListResponse {
  data: {
    content: ListRow[]
    totalElements?: number
    last: boolean
    number: number
  }
}
```

И заменить тело `fetchListPage`:

```ts
export async function fetchListPage(args: {
  url: string
  params?: Record<string, string>
  method?: string
  body?: unknown
  page: number
  size: number
  search?: string
  signal?: AbortSignal
}): Promise<PagedListResponse> {
  const params = {
    ...args.params,
    page: args.page,
    size: args.size,
    ...(args.search?.trim() && { search: args.search.trim() }),
  }
  if (args.method === 'POST') {
    const res = await apiService.post<PagedListResponse>({
      url: args.url,
      params,
      data: args.body ?? {},
      signal: args.signal,
    })
    return res.data
  }
  const res = await apiService.get<PagedListResponse>({
    url: args.url,
    params,
    signal: args.signal,
  })
  return res.data
}
```

- [ ] **Step 4: Прогнать — убедиться, что зелено**

Run: `npx vitest run --dir src/features/sdui src/features/sdui/api/reference-options.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/api/reference-options.ts src/features/sdui/api/reference-options.test.ts
git commit -m "feat: POST-транспорт SEARCH в fetchListPage (SCRUM-291 2a)

<трейлеры из Global Constraints>"
```

---

### Task 2: `ListNode` — проброс `method`/`body` через queryKey и queryFn

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx`
- Test: `src/features/sdui/ui/nodes/composite/list-node.test.tsx` (create)

**Interfaces:**

- Consumes: `fetchListPage` (Task 1) — теперь принимает `method`/`body`.
- Produces: `ListSource { url: string; params?: Record<string,string>; method?: string; body?: unknown }`.

- [ ] **Step 1: Написать падающий тест**

Create `src/features/sdui/ui/nodes/composite/list-node.test.tsx`:

```tsx
import { render, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/assets/icons/search.svg', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../../lib/stores/ref-picker-selection-store', () => ({
  useRefPickerSelectionStore: () => vi.fn(),
}))
vi.mock('../../../api/reference-options', () => ({ fetchListPage: vi.fn() }))

const useInfiniteQuery = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (cfg: unknown) => useInfiniteQuery(cfg),
}))

import { fetchListPage } from '../../../api/reference-options'
import { ListNode } from './list-node'
import type { ViewNode } from '../../../types/view'

const baseQueryResult = {
  data: undefined,
  isLoading: true,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
}

const searchNode = {
  id: 'lst',
  type: 'LIST',
  props: {
    source: {
      url: '/x/search',
      method: 'POST',
      params: { sortAttr: 'Data' },
      body: { filters: [], logic: 'AND' },
    },
  },
  children: [],
  actions: [],
} as unknown as ViewNode

describe('ListNode — транспорт', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    useInfiniteQuery.mockReset()
    useInfiniteQuery.mockReturnValue(baseQueryResult)
    vi.mocked(fetchListPage).mockReset()
    vi.mocked(fetchListPage).mockResolvedValue({
      data: { content: [], last: true, number: 0 },
    })
  })

  it('queryKey содержит method и body из source', () => {
    render(<ListNode node={searchNode} />)
    const cfg = useInfiniteQuery.mock.calls[0][0]
    expect(cfg.queryKey).toEqual([
      'sdui-list',
      '/x/search',
      { sortAttr: 'Data' },
      'POST',
      { filters: [], logic: 'AND' },
      '',
    ])
  })

  it('queryFn пробрасывает method и body в fetchListPage', async () => {
    render(<ListNode node={searchNode} />)
    const cfg = useInfiniteQuery.mock.calls[0][0]
    await cfg.queryFn({ pageParam: 0, signal: undefined })
    expect(fetchListPage).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/x/search',
        method: 'POST',
        body: { filters: [], logic: 'AND' },
      })
    )
  })
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui src/features/sdui/ui/nodes/composite/list-node.test.tsx`
Expected: FAIL — `queryKey` не содержит `method`/`body`; `fetchListPage` вызывается без них.

- [ ] **Step 3: Расширить `ListSource` и проброс**

В `list-node.tsx`:

```ts
interface ListSource {
  url: string
  params?: Record<string, string>
  method?: string
  body?: unknown
}
```

`queryKey` (в `useInfiniteQuery`):

```ts
queryKey: ['sdui-list', source?.url, source?.params, source?.method, source?.body, search],
```

`queryFn` — добавить проброс:

```ts
return fetchListPage({
  url: source.url,
  params: source.params,
  method: source.method,
  body: source.body,
  page: pageParam as number,
  size: PAGE_SIZE,
  search,
  signal,
})
```

- [ ] **Step 4: Прогнать — убедиться, что зелено**

Run: `npx vitest run --dir src/features/sdui src/features/sdui/ui/nodes/composite/list-node.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/list-node.tsx src/features/sdui/ui/nodes/composite/list-node.test.tsx
git commit -m "feat: проброс method/body source в queryKey/queryFn списка (SCRUM-291 2a)

<трейлеры>"
```

---

### Task 3: `ListNode` — видимая ветка ошибки загрузки

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx`
- Modify: `src/app/config/i18n/locales/ru/common.json`, `.../kz/common.json`
- Test: `src/features/sdui/ui/nodes/composite/list-node.test.tsx` (extend)

**Interfaces:**

- Consumes: `useInfiniteQuery().isError` (уже возвращается TanStack Query).

- [ ] **Step 1: Написать падающий тест** (добавить в `list-node.test.tsx`)

```tsx
import { screen } from '@testing-library/react'

it('isError → показывает table.loadError, а не «нет данных»', () => {
  useInfiniteQuery.mockReturnValue({
    ...baseQueryResult,
    isLoading: false,
    isError: true,
  })
  render(<ListNode node={searchNode} />)
  expect(screen.getByText('table.loadError')).toBeTruthy()
  expect(screen.queryByText('dictSidebar.noData')).toBeNull()
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui src/features/sdui/ui/nodes/composite/list-node.test.tsx`
Expected: FAIL — сейчас ветки `isError` нет, рендерится «нет данных» (`dictSidebar.noData`).

- [ ] **Step 3: Добавить ветку `isError` и ключ i18n**

В `list-node.tsx` достать `isError` из `useInfiniteQuery`:

```ts
const {
  data: pagedData,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
} = useInfiniteQuery({
  /* ... */
})
```

В рендере добавить ветку между `isLoading` и `rows.length === 0`:

```tsx
{isLoading ? (
  <div className="flex items-center justify-center py-20">
    <Typography className="text-ui-05">{t('inputs.loading')}</Typography>
  </div>
) : isError ? (
  <div className="flex items-center justify-center py-20">
    <Typography className="text-ui-05">{t('table.loadError')}</Typography>
  </div>
) : rows.length === 0 ? (
  /* ... как было ... */
```

В `src/app/config/i18n/locales/ru/common.json`, объект `table`:

```json
"loadError": "Не удалось загрузить данные",
```

В `src/app/config/i18n/locales/kz/common.json`, объект `table`:

```json
"loadError": "Деректерді жүктеу мүмкін болмады",
```

- [ ] **Step 4: Прогнать — убедиться, что зелено**

Run: `npx vitest run --dir src/features/sdui src/features/sdui/ui/nodes/composite/list-node.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/list-node.tsx src/features/sdui/ui/nodes/composite/list-node.test.tsx src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: видимая ошибка загрузки списка вместо пустого экрана (SCRUM-291 2a)

<трейлеры>"
```

---

### Task 4: счётчик без `total` — чистый хелпер

**Files:**

- Create: `src/features/sdui/ui/nodes/composite/list-loaded-count.ts`
- Create: `src/features/sdui/ui/nodes/composite/list-loaded-count.test.ts`
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx`
- Modify: `src/app/config/i18n/locales/ru/common.json`, `.../kz/common.json`

**Interfaces:**

- Produces: `resolveLoadedCountLabel(t: (key: string, opts?: Record<string, unknown>) => string, loaded: number, totalElements: number | undefined): string`.

- [ ] **Step 1: Написать падающий тест**

Create `src/features/sdui/ui/nodes/composite/list-loaded-count.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveLoadedCountLabel } from './list-loaded-count'

const t = (key: string, opts?: Record<string, unknown>) =>
  `${key}:${JSON.stringify(opts ?? {})}`

describe('resolveLoadedCountLabel', () => {
  it('с totalElements → loadedCount с total', () => {
    expect(resolveLoadedCountLabel(t, 25, 100)).toBe(
      'table.loadedCount:{"loaded":25,"total":100}'
    )
  })

  it('без totalElements (Slice) → loadedCountNoTotal без total', () => {
    expect(resolveLoadedCountLabel(t, 25, undefined)).toBe(
      'table.loadedCountNoTotal:{"loaded":25}'
    )
  })
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run --dir src/features/sdui src/features/sdui/ui/nodes/composite/list-loaded-count.test.ts`
Expected: FAIL — модуль `./list-loaded-count` не существует.

- [ ] **Step 3: Реализовать хелпер + ключ i18n**

Create `src/features/sdui/ui/nodes/composite/list-loaded-count.ts`:

```ts
type TranslateFn = (key: string, opts?: Record<string, unknown>) => string

/**
 * Метка счётчика строк. SEARCH-тракт возвращает Slice без totalElements —
 * тогда показываем «Загружено N» без «из M», иначе — с общим количеством.
 */
export function resolveLoadedCountLabel(
  t: TranslateFn,
  loaded: number,
  totalElements: number | undefined
): string {
  return typeof totalElements === 'number'
    ? t('table.loadedCount', { loaded, total: totalElements })
    : t('table.loadedCountNoTotal', { loaded })
}
```

В `src/app/config/i18n/locales/ru/common.json`, объект `table`:

```json
"loadedCountNoTotal": "Загружено {{loaded}}",
```

В `src/app/config/i18n/locales/kz/common.json`, объект `table`:

```json
"loadedCountNoTotal": "{{loaded}} жүктелді",
```

- [ ] **Step 4: Прогнать — убедиться, что зелено**

Run: `npx vitest run --dir src/features/sdui src/features/sdui/ui/nodes/composite/list-loaded-count.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Подключить хелпер в `list-node.tsx`**

Импорт:

```ts
import { resolveLoadedCountLabel } from './list-loaded-count'
```

Заменить строку счётчика:

```tsx
<Typography variant="body2" className="text-ui-05">
  {resolveLoadedCountLabel(
    t,
    rows.length,
    pagedData?.pages[0]?.data.totalElements
  )}
</Typography>
```

- [ ] **Step 6: Прогнать весь SDUI — регресс**

Run: `npx vitest run --dir src/features/sdui`
Expected: PASS (все файлы, включая новые).

- [ ] **Step 7: Коммит**

```bash
git add src/features/sdui/ui/nodes/composite/list-loaded-count.ts src/features/sdui/ui/nodes/composite/list-loaded-count.test.ts src/features/sdui/ui/nodes/composite/list-node.tsx src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: счётчик «Загружено N» без total для SEARCH-тракта (SCRUM-291 2a)

<трейлеры>"
```

---

## Self-Review

**Spec coverage (против §5 спеки):**

- §5 п.1 POST-ветка `fetchListPage` → Task 1. ✅
- §5 п.2 `queryKey` += method/body → Task 2. ✅
- §5 п.3 видимый `isError` → Task 3. ✅
- §5 п.4 счётчик без total → Task 4. ✅
- Опциональный `totalElements` (Slice) → Task 1 (тип) + Task 4 (потребление). ✅
- Порядок деплоя → Global Constraints (описание PR, не код). ✅

**Placeholder scan:** плейсхолдеров нет; весь код приведён дословно, `<трейлеры>` — явная ссылка на Global Constraints (значение там дословно). ✅

**Type consistency:** `fetchListPage` args (`method?`/`body?`) совпадают в Task 1 (определение), Task 2 (вызов). `PagedListResponse.data.totalElements?` — Task 1 (тип), Task 4 (`pagedData?.pages[0]?.data.totalElements` → `number|undefined`). `resolveLoadedCountLabel` сигнатура одна в Task 4 (определение и подключение). `ListSource` поля совпадают Task 2 (определение) ↔ данные теста. ✅

**Границы:** UI сортировки/фильтров/периода не вводится; `PAGED` GET-путь сохранён (регресс-тест в Task 1). ✅

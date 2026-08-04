# SCRUM-290 — Единый роутинг (Phase 2, фронт) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести SDUI-фронт на route-based OPEN (перестать конструировать серверные `layoutCode`) и добавить универсальный catch-all маршрут с фолбэком на легаси, ничего не ломая.

**Architecture:** Аддитивные, независимо откатываемые слои. Бэк держит приоритет `layoutCode > route`, поэтому переход постраничный. Транспорт парсит машиночитаемые ошибки (`SCREEN_NOT_SDUI`/`ROUTE_UNKNOWN`/`NOT_FOUND`), `dispatch` разводит их по колбэкам, catch-all живёт в композиционном слое и монтирует легаси без нового gateway (SDUI-код легаси не импортирует).

**Tech Stack:** React 19, TypeScript 5.9, React Router v6, Zustand, TanStack Query, Vitest, i18next.

## Global Constraints

- Тексты — только через `useTranslation` (`react-i18next`) + ключи `common.json`; текст в JSX — через `<Typography>` из `@mui/material`. Не хардкодить строки.
- Прямые импорты между SDUI (`src/features/sdui/`) и легаси **запрещены в обе стороны**. Мост — только композиционный слой (`src/pages/`, `src/app/`). Новый gateway не заводить.
- Один файл — одна ответственность; цель ~200 строк, >300 обязателен сплит. Легаси-файлы под лимит не рефакторим.
- Barrel-экспорты (`index.ts`) — только на уровне FSD-слайса; внутри сегмента импортировать напрямую.
- `@/*` → `src/*`.
- Для нового кода не вводить `useMemo`/`useCallback` без явной перф-причины; следовать существующим паттернам в изменяемых файлах.
- НЕ запускать `tsc --noEmit` / `npm run lint` / `npm run build`, пока пользователь явно не попросит. Проверка — через `vitest` по конкретным файлам.
- Формат коммитов: `feat|fix|add|refactor: описание`.
- Ловушки бэк-спеки (§5): не удалять `<Route>` списков, `DocumentRedirect`/`DictionaryRedirect`; не снимать 404-фолбэк; копирование/домены/`tab=null` — учитывать.

---

## Файловая карта

**Изменяем:**

- `src/features/sdui/api/view-transport.ts` — парсинг тела ошибки, поля в `ViewHttpError`.
- `src/features/sdui/lib/dispatch.ts` — route-only OPEN, гейт ошибок на 3 ветки.
- `src/features/sdui/types/view.ts` — поле `tab` в `ViewResponse`.
- `src/features/sdui/ui/sdui-screen.tsx` — новые пропы `onRouteUnknown` / `onOpenFailed(info)` / `onTab`.
- `src/pages/documents/documents-entry/ui/sdui-document-page.tsx` — снять конвенцию, авторство вкладки.
- `src/pages/dictionaries/dictionary-entry/ui/sdui-dictionary-entry-page.tsx` — снять конвенцию, авторство вкладки.
- `src/app/App.tsx` — catch-all `<Route path="*">`.
- `src/features/workspace-tabs/lib/utils/resolve-page-type.ts` — снять 3 SDUI-регекса.
- `src/features/sdui/lib/dispatch.test.ts`, `src/features/sdui/lib/language-reopen.test.ts` — убрать `X.ФормаОбъекта`.
- `src/features/sdui/index.ts`, `src/features/workspace-tabs/index.ts` — экспорты новых утилит.
- `public/locales/*/common.json` (или актуальный путь common.json) — ключи «не найдено».

**Создаём:**

- `src/features/sdui/api/parse-view-error.ts` — чистый парсер тела ошибки.
- `src/features/sdui/lib/tab-kind.ts` — маппинг `tab.kind → TabPageType`.
- `src/shared/ui/not-found/not-found.tsx` — экран «страница не найдена».
- `src/pages/sdui-catch-all/index.ts` — barrel слайса.
- `src/pages/sdui-catch-all/ui/sdui-catch-all-page.tsx` — оркестратор.
- `src/pages/sdui-catch-all/ui/legacy-fallback.tsx` — монтаж легаси по `kind`.
- `src/pages/sdui-catch-all/lib/kind-to-legacy.tsx` — таблица `kind → {path, element}`.
- Тесты рядом с каждым модулем (`*.test.ts[x]`).

---

## Task 1: Транспорт — парсинг тела ошибки

**Files:**

- Create: `src/features/sdui/api/parse-view-error.ts`
- Test: `src/features/sdui/api/parse-view-error.test.ts`
- Modify: `src/features/sdui/api/view-transport.ts`

**Interfaces:**

- Produces: `parseViewError(data: unknown): { message?: string; code?: string; kind?: string }` — читает поле `error` (SDUI-ошибки) ИЛИ `code` (унаследованный `NOT_FOUND`) в `code`, поле `kind` в `kind`, `message` в `message`.
- Produces: `class ViewHttpError extends Error` с новыми публичными полями `code?: string`, `kind?: string` (в дополнение к `status`).

- [ ] **Step 1: Написать падающий тест парсера**

```ts
// src/features/sdui/api/parse-view-error.test.ts
import { describe, expect, it } from 'vitest'
import { parseViewError } from './parse-view-error'

describe('parseViewError', () => {
  it('SDUI 422: error=SCREEN_NOT_SDUI + kind', () => {
    expect(
      parseViewError({
        error: 'SCREEN_NOT_SDUI',
        kind: 'DOCUMENT_LIST',
        route: '/x',
      })
    ).toEqual({ code: 'SCREEN_NOT_SDUI', kind: 'DOCUMENT_LIST' })
  })

  it('SDUI 404: error=ROUTE_UNKNOWN', () => {
    expect(parseViewError({ error: 'ROUTE_UNKNOWN', route: '/foo' })).toEqual({
      code: 'ROUTE_UNKNOWN',
    })
  })

  it('унаследованный 404: code=NOT_FOUND', () => {
    expect(parseViewError({ code: 'NOT_FOUND', message: 'нет типа' })).toEqual({
      code: 'NOT_FOUND',
      message: 'нет типа',
    })
  })

  it('пустое/неизвестное тело — пустой объект', () => {
    expect(parseViewError(null)).toEqual({})
    expect(parseViewError('boom')).toEqual({})
  })
})
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npx vitest run src/features/sdui/api/parse-view-error.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать парсер**

```ts
// src/features/sdui/api/parse-view-error.ts

// Тело ошибок SDUI несёт код в поле `error` (единообразно с 409), кроме
// унаследованного 404, где `code` (§2 бэк-спеки SCRUM-290). Нормализуем оба.
export function parseViewError(data: unknown): {
  message?: string
  code?: string
  kind?: string
} {
  if (!data || typeof data !== 'object') return {}
  const b = data as Record<string, unknown>
  const code =
    (typeof b.error === 'string' && b.error) ||
    (typeof b.code === 'string' && b.code) ||
    undefined
  const kind = typeof b.kind === 'string' ? b.kind : undefined
  const message = typeof b.message === 'string' ? b.message : undefined
  const out: { message?: string; code?: string; kind?: string } = {}
  if (code) out.code = code
  if (kind) out.kind = kind
  if (message) out.message = message
  return out
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `npx vitest run src/features/sdui/api/parse-view-error.test.ts`
Expected: PASS.

- [ ] **Step 5: Прошить в транспорт**

В `view-transport.ts` заменить `extractMessage` на `parseViewError` и расширить `ViewHttpError`:

```ts
import { parseViewError } from './parse-view-error'
// ...убрать локальную extractMessage...

export class ViewHttpError extends Error {
  constructor(
    message: string,
    public status: number | undefined,
    public code?: string,
    public kind?: string
  ) {
    super(message)
  }
}
```

В `catch` (ветка `axios.isAxiosError`, НЕ 409) заменить конструирование ошибки:

```ts
if (axios.isAxiosError(error)) {
  const meta = parseViewError(error.response?.data)
  throw new ViewHttpError(
    meta.message ?? error.message,
    error.response?.status,
    meta.code,
    meta.kind
  )
}
```

- [ ] **Step 6: Прогнать транспорт-зависимые тесты**

Run: `npx vitest run src/features/sdui/api src/features/sdui/lib/dispatch.test.ts`
Expected: PASS (существующие тесты не опираются на `extractMessage`).

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/api/parse-view-error.ts src/features/sdui/api/parse-view-error.test.ts src/features/sdui/api/view-transport.ts
git commit -m "feat: транспорт SDUI парсит тело ошибки (code/kind) — SCRUM-290"
```

---

## Task 2: dispatch — route-only OPEN

**Files:**

- Modify: `src/features/sdui/lib/dispatch.ts`
- Test: `src/features/sdui/lib/dispatch.test.ts`

**Interfaces:**

- Consumes: `ViewRequest.layoutCode?: string | null` (уже опционально в типах).
- Produces: OPEN-запрос НЕ содержит ключ `layoutCode`, когда `action.layoutCode` пуст (`undefined`/`''`/`null`).

- [ ] **Step 1: Падающий тест — layoutCode не шлётся, когда пуст**

Добавить в `dispatch.test.ts` (рядом с блоком «wire-route OPEN-запроса»):

```ts
it('OPEN без layoutCode: ключ layoutCode отсутствует в запросе', async () => {
  router.search = ''
  const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

  const { result } = renderHook(() => useSduiDispatch(), { wrapper })
  await result.current({ type: 'OPEN' })

  const arg = post.mock.calls[0][0]
  expect('layoutCode' in arg).toBe(false)
  expect(arg).toEqual(
    expect.objectContaining({ route: '/documents/SchetKOplate/new' })
  )
})

it('OPEN c layoutCode: ключ передаётся как есть', async () => {
  const post = vi.spyOn(viewTransport, 'post').mockResolvedValue(openResponse)

  const { result } = renderHook(() => useSduiDispatch(), { wrapper })
  await result.current({ type: 'OPEN', layoutCode: 'X.ФормаОбъекта' })

  expect(post.mock.calls[0][0]).toEqual(
    expect.objectContaining({ layoutCode: 'X.ФормаОбъекта' })
  )
})
```

- [ ] **Step 2: Запустить — первый тест падает**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts -t "layoutCode отсутствует"`
Expected: FAIL — сейчас шлётся `layoutCode: null`.

- [ ] **Step 3: Условно включать поле в запрос**

В `dispatch.ts`, в `viewTransport.post({...})` заменить безусловное `layoutCode` на спред:

```ts
const res = await viewTransport.post({
  formSessionId: action.type === 'OPEN' ? null : formSessionId,
  revision: action.type === 'OPEN' ? null : revision,
  ...(action.type === 'OPEN' && action.layoutCode
    ? { layoutCode: action.layoutCode }
    : {}),
  route: location.pathname + location.search,
  action,
})
```

И строку `session.setLayoutCode?.(action.layoutCode ?? null)` в ветке OPEN оставить как есть (в стор кладём `null` при отсутствии — reopen это учитывает).

- [ ] **Step 4: Запустить — зелёный**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts`
Expected: PASS.

- [ ] **Step 5: Тест reopen route-only**

Добавить тест: при `SESSION_NOT_FOUND` reopen со `getLayoutCode()===null` шлёт OPEN без `layoutCode`. В `sessionMock` добавить `getLayoutCode: () => null` и `setLayoutCode: vi.fn()`, замокать `viewTransport.post` так, чтобы первый вызов (исходный) кинул `ViewConflictError({ code: 'SESSION_NOT_FOUND', ... })`, второй (reopen) — `openResponse`. Проверить, что во втором вызове `'layoutCode' in arg === false`.

```ts
it('reopen после SESSION_NOT_FOUND без layoutCode шлёт route-only OPEN', async () => {
  sessionMock.getLayoutCode = () => null
  sessionMock.setLayoutCode = vi.fn()
  const post = vi
    .spyOn(viewTransport, 'post')
    .mockRejectedValueOnce(new ViewConflictError({ code: 'SESSION_NOT_FOUND' }))
    .mockResolvedValue(openResponse)

  const { result } = renderHook(() => useSduiDispatch(), { wrapper })
  await result.current({ type: 'EVENT', nodeId: 'n', event: 'blur' } as never)

  const reopenArg = post.mock.calls.at(-1)?.[0]
  expect('layoutCode' in (reopenArg ?? {})).toBe(false)
})
```

Импортировать `ViewConflictError` из `../api/view-transport` в тест-файле (добавить к существующему импорту). Если `EVENT`-форма экшена в проекте иная — взять реальную из `types/view.ts` (`ViewAction`).

- [ ] **Step 6: Запустить — зелёный**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/lib/dispatch.ts src/features/sdui/lib/dispatch.test.ts
git commit -m "feat: OPEN не шлёт пустой layoutCode, reopen route-only — SCRUM-290"
```

---

## Task 3: dispatch — гейт ошибок OPEN на 3 ветки

**Files:**

- Modify: `src/features/sdui/lib/dispatch.ts`
- Test: `src/features/sdui/lib/dispatch.test.ts`

**Interfaces:**

- Produces: `opts?: { onOpenNotFound?: (info?: { kind?: string }) => void; onRouteUnknown?: () => void }` в сигнатуре `dispatch`.
- Поведение: `404 code=NOT_FOUND` → `onOpenNotFound()`; `422 code=SCREEN_NOT_SDUI` → `onOpenNotFound({ kind })`; `404 code=ROUTE_UNKNOWN` → `onRouteUnknown()`; без подходящего колбэка — тост как раньше.

- [ ] **Step 1: Падающие тесты гейта**

```ts
it('OPEN 422 SCREEN_NOT_SDUI → onOpenNotFound({kind}), без тоста', async () => {
  vi.spyOn(viewTransport, 'post').mockRejectedValue(
    new ViewHttpError('nope', 422, 'SCREEN_NOT_SDUI', 'DOCUMENT_LIST')
  )
  const onOpenNotFound = vi.fn()
  const { result } = renderHook(() => useSduiDispatch(), { wrapper })
  const ok = await result.current({ type: 'OPEN' }, null, false, {
    onOpenNotFound,
  })

  expect(ok).toBe(false)
  expect(onOpenNotFound).toHaveBeenCalledWith({ kind: 'DOCUMENT_LIST' })
  expect(showToast).not.toHaveBeenCalled()
})

it('OPEN 404 ROUTE_UNKNOWN → onRouteUnknown, без тоста', async () => {
  vi.spyOn(viewTransport, 'post').mockRejectedValue(
    new ViewHttpError('nope', 404, 'ROUTE_UNKNOWN')
  )
  const onRouteUnknown = vi.fn()
  const { result } = renderHook(() => useSduiDispatch(), { wrapper })
  const ok = await result.current({ type: 'OPEN' }, null, false, {
    onRouteUnknown,
  })

  expect(ok).toBe(false)
  expect(onRouteUnknown).toHaveBeenCalledTimes(1)
  expect(showToast).not.toHaveBeenCalled()
})

it('OPEN 404 NOT_FOUND → onOpenNotFound() без kind (унаследованный тракт)', async () => {
  vi.spyOn(viewTransport, 'post').mockRejectedValue(
    new ViewHttpError('nope', 404, 'NOT_FOUND')
  )
  const onOpenNotFound = vi.fn()
  const { result } = renderHook(() => useSduiDispatch(), { wrapper })
  await result.current({ type: 'OPEN' }, null, false, { onOpenNotFound })

  expect(onOpenNotFound).toHaveBeenCalledWith(undefined)
})
```

Импортировать `ViewHttpError` (уже импортирован в файле) и `showToast` mock (уже есть).

- [ ] **Step 2: Запустить — падают**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts -t "SCREEN_NOT_SDUI"`
Expected: FAIL — сейчас гейт ловит только 404 и вызывает `onOpenNotFound()` без аргумента; 422 уходит в тост.

- [ ] **Step 3: Расширить сигнатуру и гейт**

В `dispatch.ts` изменить тип `opts`:

```ts
opts?: {
  onOpenNotFound?: (info?: { kind?: string }) => void
  onRouteUnknown?: () => void
},
```

Заменить блок обработки 404 (ветка `else if (error instanceof ViewHttpError && ... 404 ...)`) на:

```ts
} else if (error instanceof ViewHttpError && action.type === 'OPEN') {
  // Единый гейт раскатки под catch-all (§2 бэк-спеки SCRUM-290):
  // ROUTE_UNKNOWN → «не найдено»; SCREEN_NOT_SDUI / унаследованный
  // 404 → легаси-фолбэк. Без подходящего колбэка — общий тост, как раньше.
  if (error.status === 404 && error.code === 'ROUTE_UNKNOWN' && opts?.onRouteUnknown) {
    opts.onRouteUnknown()
  } else if (
    (error.status === 422 && error.code === 'SCREEN_NOT_SDUI') && opts?.onOpenNotFound
  ) {
    opts.onOpenNotFound({ kind: error.kind })
  } else if (error.status === 404 && opts?.onOpenNotFound) {
    opts.onOpenNotFound(undefined)
  } else {
    showToast('error', error.message || i18n.t('sdui.requestError'))
  }
}
```

Убедиться, что финальный `else` (общий тост для не-`ViewHttpError`/не-OPEN) сохранён отдельной веткой выше/ниже — не потерять существующий тост для EVENT/COMMAND ошибок и сетевых сбоев.

- [ ] **Step 4: Запустить — зелёный (весь файл)**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts`
Expected: PASS (включая существующие тесты про тост при обычных ошибках).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/dispatch.ts src/features/sdui/lib/dispatch.test.ts
git commit -m "feat: гейт ошибок OPEN — SCREEN_NOT_SDUI/ROUTE_UNKNOWN/NOT_FOUND (SCRUM-290)"
```

---

## Task 4: Убрать конструирование layoutCode на страницах-хостах

**Files:**

- Modify: `src/pages/documents/documents-entry/ui/sdui-document-page.tsx:125`
- Modify: `src/pages/dictionaries/dictionary-entry/ui/sdui-dictionary-entry-page.tsx:104`
- Modify: `src/features/sdui/lib/dispatch.test.ts`, `src/features/sdui/lib/language-reopen.test.ts`

**Interfaces:**

- Consumes: `SduiScreen` без пропа `layoutCode` (проп уже опционален).
- После: `grep -rn "ФормаОбъекта\|OBJECT_FORM" src/` пуст.

- [ ] **Step 1: Обновить тесты, чтобы не использовали конвенцию**

В `dispatch.test.ts` и `language-reopen.test.ts` заменить `{ type: 'OPEN', layoutCode: 'X.ФормаОбъекta' }` на route-only `{ type: 'OPEN' }` там, где смысл теста не про layoutCode (в блоке «wire-route OPEN-запроса» тесты про route — убрать layoutCode). Для `language-reopen.test.ts` — если тест проверяет переоткрытие, оставить осмысленный layoutCode ИЛИ заменить на route-only согласно тому, что проверяется; если layoutCode там не суть — убрать. Ключевое: строка `ФормаОбъекта` не должна остаться в `src/`.

- [ ] **Step 2: Запустить тесты — зелёные после правок**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts src/features/sdui/lib/language-reopen.test.ts`
Expected: PASS.

- [ ] **Step 3: Снять проп в документной странице**

`sdui-document-page.tsx:125`:

```tsx
<SduiScreen {...tabsApi} onTitleChange={setTabTitle} />
```

(убрать `layoutCode={`${moduleCode}.ФормаОбъekta`}`).

- [ ] **Step 4: Снять проп в странице справочника**

`sdui-dictionary-entry-page.tsx:104`:

```tsx
<SduiScreen {...screenApi} onTitleChange={setTabTitle} />
```

(убрать `layoutCode={`dict.${moduleCode}.OBJECT_FORM`}`). Его `onOpenFailed` теперь срабатывает и на 422 благодаря Task 3 — кода менять не нужно, `moduleCode` остаётся в пропсах для `listPath`.

- [ ] **Step 5: Приёмка grep**

Run: `grep -rn "ФормаОбъекта\|OBJECT_FORM\|фОрмаОбъекта" src/`
Expected: пусто (exit code 1).

- [ ] **Step 6: Прогнать затронутые тесты**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/documents/documents-entry/ui/sdui-document-page.tsx src/pages/dictionaries/dictionary-entry/ui/sdui-dictionary-entry-page.tsx src/features/sdui/lib/dispatch.test.ts src/features/sdui/lib/language-reopen.test.ts
git commit -m "refactor: фронт не конструирует layoutCode — route-only OPEN (SCRUM-290)"
```

---

## Task 5: Тип `tab` в ViewResponse

**Files:**

- Modify: `src/features/sdui/types/view.ts`

**Interfaces:**

- Produces: `interface ViewTabMeta { kind: string; icon?: string; closable?: boolean }` и поле `tab?: ViewTabMeta | null` в `ViewResponse`.

- [ ] **Step 1: Добавить тип**

В `view.ts`, рядом с `ViewResponse`:

```ts
// Метаданные вкладки — приходят ТОЛЬКО на OPEN, могут быть null
// (оболочка `/` и все EVENT/COMMAND). §4.4/§5.6 бэк-спеки SCRUM-290.
export interface ViewTabMeta {
  kind: string
  icon?: string
  closable?: boolean
}
```

И в `ViewResponse` добавить поле:

```ts
  tab?: ViewTabMeta | null
```

- [ ] **Step 2: Быстрая проверка типов на изменённом файле**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts`
Expected: PASS (тип аддитивный, ничего не ломает).

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/types/view.ts
git commit -m "add: тип ViewTabMeta и поле tab в ViewResponse (SCRUM-290)"
```

---

## Task 6: Маппинг `tab.kind → TabPageType`

**Files:**

- Create: `src/features/sdui/lib/tab-kind.ts`
- Test: `src/features/sdui/lib/tab-kind.test.ts`
- Modify: `src/features/sdui/index.ts` (экспорт)

**Interfaces:**

- Consumes: `TabPageType` из `@/features/workspace-tabs`.
- Produces: `mapKindToPageType(kind: string): TabPageType | null` — MODULE→'module', DOCUMENT/DOCUMENT_NEW→'document-entry', DICTIONARY/DICTIONARY_NEW→'dictionary-entry', иначе `null`.

- [ ] **Step 1: Падающий тест**

```ts
// src/features/sdui/lib/tab-kind.test.ts
import { describe, expect, it } from 'vitest'
import { mapKindToPageType } from './tab-kind'

describe('mapKindToPageType', () => {
  it('MODULE → module', () =>
    expect(mapKindToPageType('MODULE')).toBe('module'))
  it('DOCUMENT → document-entry', () =>
    expect(mapKindToPageType('DOCUMENT')).toBe('document-entry'))
  it('DOCUMENT_NEW → document-entry', () =>
    expect(mapKindToPageType('DOCUMENT_NEW')).toBe('document-entry'))
  it('DICTIONARY → dictionary-entry', () =>
    expect(mapKindToPageType('DICTIONARY')).toBe('dictionary-entry'))
  it('DICTIONARY_NEW → dictionary-entry', () =>
    expect(mapKindToPageType('DICTIONARY_NEW')).toBe('dictionary-entry'))
  it('немигрированный вид → null', () =>
    expect(mapKindToPageType('DOCUMENT_LIST')).toBeNull())
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/lib/tab-kind.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать**

```ts
// src/features/sdui/lib/tab-kind.ts
import type { TabPageType } from '@/features/workspace-tabs'

// Только SDUI-поддержанные виды экрана дают tab на 200 (§3 бэк-спеки).
const KIND_TO_PAGE_TYPE: Record<string, TabPageType> = {
  MODULE: 'module',
  DOCUMENT: 'document-entry',
  DOCUMENT_NEW: 'document-entry',
  DICTIONARY: 'dictionary-entry',
  DICTIONARY_NEW: 'dictionary-entry',
}

export function mapKindToPageType(kind: string): TabPageType | null {
  return KIND_TO_PAGE_TYPE[kind] ?? null
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `npx vitest run src/features/sdui/lib/tab-kind.test.ts`
Expected: PASS.

- [ ] **Step 5: Экспорт из слайса**

В `src/features/sdui/index.ts` добавить:

```ts
export { mapKindToPageType } from './lib/tab-kind'
```

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/lib/tab-kind.ts src/features/sdui/lib/tab-kind.test.ts src/features/sdui/index.ts
git commit -m "add: маппинг tab.kind → TabPageType (SCRUM-290)"
```

---

## Task 7: SduiScreen — пропы для catch-all и авторства вкладки

**Files:**

- Modify: `src/features/sdui/ui/sdui-screen.tsx`

**Interfaces:**

- Produces (новые пропы `SduiScreenProps`):
  - `onOpenFailed?: (info?: { kind?: string }) => void` (расширение сигнатуры существующего пропа).
  - `onRouteUnknown?: () => void`.
  - `onTab?: (tab: ViewTabMeta | null) => void` — вызывается после OPEN с `response.tab`.
- Внутри: OPEN-`dispatch` получает `opts` с `onOpenNotFound: onOpenFailed`, `onRouteUnknown`; после успешного OPEN — `onTab?.(res.tab ?? null)`.

Примечание: `onTab` требует, чтобы `dispatch` в ветке OPEN отдавал `res.tab` наружу. Проще всего — прокинуть колбэк в `opts` `dispatch` ИЛИ читать `res.tab` там же, где ставится `setOnDirtyClose`. Выбран вариант: `dispatch` вызывает переданный в `opts.onOpenTab?.(res.tab)`. Добавить в `opts` `dispatch` (Task 3) поле `onOpenTab?: (tab: ViewTabMeta | null) => void` и вызвать его в ветке OPEN после `setOnDirtyClose`.

- [ ] **Step 1: Дописать opts.onOpenTab в dispatch**

В `dispatch.ts` расширить `opts`:

```ts
opts?: {
  onOpenNotFound?: (info?: { kind?: string }) => void
  onRouteUnknown?: () => void
  onOpenTab?: (tab: ViewTabMeta | null) => void
},
```

Импортировать `ViewTabMeta` из `../types/view`. В ветке `if (action.type === 'OPEN') { ... }` после `setOnDirtyClose?.(res.onDirtyClose ?? null)` добавить:

```ts
opts?.onOpenTab?.(res.tab ?? null)
```

- [ ] **Step 2: Тест — onOpenTab получает res.tab**

В `dispatch.test.ts`:

```ts
it('OPEN прокидывает res.tab в onOpenTab', async () => {
  vi.spyOn(viewTransport, 'post').mockResolvedValue({
    ...openResponse,
    tab: { kind: 'MODULE' },
  } as never)
  const onOpenTab = vi.fn()
  const { result } = renderHook(() => useSduiDispatch(), { wrapper })
  await result.current({ type: 'OPEN' }, null, false, { onOpenTab })
  expect(onOpenTab).toHaveBeenCalledWith({ kind: 'MODULE' })
})
```

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts -t "onOpenTab"`
Expected: FAIL → после Step 1 PASS. Прогнать: `npx vitest run src/features/sdui/lib/dispatch.test.ts` → PASS.

- [ ] **Step 3: Расширить пропы SduiScreen и прокинуть в dispatch**

В `sdui-screen.tsx`:

- Импортировать `ViewTabMeta` из `../types/view`.
- В интерфейсе `SduiScreenProps` изменить `onOpenFailed?: () => void` → `onOpenFailed?: (info?: { kind?: string }) => void` и добавить `onRouteUnknown?: () => void`, `onTab?: (tab: ViewTabMeta | null) => void`.
- Деструктуризация — добавить `onRouteUnknown`, `onTab`.
- В главном эффекте, в вызове `dispatch({ type: 'OPEN' }, null, false, {...})` заменить объект opts:

```ts
void dispatch({ type: 'OPEN' }, null, false, {
  onOpenNotFound: onOpenFailed,
  onRouteUnknown,
  onOpenTab: (tab) => onTab?.(tab),
})
```

(убрать конструирование `layoutCode` из OPEN — экран теперь всегда route-only; проп `layoutCode` в SduiScreen больше не используется страницами, но оставить в типе допустимо. Для чистоты: удалить проп `layoutCode` из `SduiScreenProps` и все его использования в файле — строки восстановления кэша `setLayoutCode(layoutCode ?? null)` заменить на `setLayoutCode(null)`, т.к. route-only; в подписке на смену языка передавать `layoutCode: undefined` или переключить `reopenFormForLanguageChange` на route-only.)

Замечание для реализатора: удаление пропа `layoutCode` из `SduiScreen` затрагивает `language-reopen.ts`/`reopenFormForLanguageChange`. Если у него сигнатура требует `layoutCode` — передать `undefined`; переоткрытие пойдёт route-only (инвариант §4.1). Проверить его тест `language-reopen.test.ts`.

- [ ] **Step 4: Прогнать SDUI-тесты**

Run: `npx vitest run src/features/sdui`
Expected: PASS (поправить `language-reopen.test.ts`, если сломался из-за снятия layoutCode).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/sdui-screen.tsx src/features/sdui/lib/dispatch.ts src/features/sdui/lib/dispatch.test.ts src/features/sdui/lib/language-reopen.ts src/features/sdui/lib/language-reopen.test.ts
git commit -m "feat: SduiScreen route-only + пропы onRouteUnknown/onTab (SCRUM-290)"
```

---

## Task 8: Экран «страница не найдена»

**Files:**

- Create: `src/shared/ui/not-found/not-found.tsx`
- Test: `src/shared/ui/not-found/not-found.test.tsx`
- Modify: `public/locales/ru/common.json` (и другие локали, если есть) — ключи.

**Interfaces:**

- Produces: `export const NotFound: FC` — рендерит заголовок/описание через `<Typography>` + `useTranslation`.

- [ ] **Step 1: Найти путь common.json и добавить ключи**

Run: `find src public -name common.json`
Добавить в каждый `common.json` ключи (пример для `ru`):

```json
"sdui": {
  "notFound": {
    "title": "Страница не найдена",
    "description": "Проверьте адрес или вернитесь на главную."
  }
}
```

(вставить внутрь существующего объекта `sdui`, не дублируя ключ).

- [ ] **Step 2: Падающий тест**

```tsx
// src/shared/ui/not-found/not-found.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NotFound } from './not-found'

describe('NotFound', () => {
  it('показывает заголовок по i18n-ключу', () => {
    render(<NotFound />)
    // i18n в тестах обычно возвращает ключ — проверяем наличие узла
    expect(
      screen.getByText(/sdui\.notFound\.title|Страница не найдена/)
    ).toBeTruthy()
  })
})
```

- [ ] **Step 3: Запустить — падает**

Run: `npx vitest run src/shared/ui/not-found/not-found.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Реализовать**

```tsx
// src/shared/ui/not-found/not-found.tsx
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

export const NotFound: FC = () => {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <Typography variant="h5">{t('sdui.notFound.title')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('sdui.notFound.description')}
      </Typography>
    </div>
  )
}
```

- [ ] **Step 5: Запустить — зелёный**

Run: `npx vitest run src/shared/ui/not-found/not-found.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/ui/not-found/not-found.tsx src/shared/ui/not-found/not-found.test.tsx public/locales
git commit -m "add: экран NotFound + i18n-ключи (SCRUM-290)"
```

---

## Task 9: Таблица `kind → легаси-страница`

**Files:**

- Create: `src/pages/sdui-catch-all/lib/kind-to-legacy.tsx`
- Test: `src/pages/sdui-catch-all/lib/kind-to-legacy.test.tsx`

**Interfaces:**

- Produces: `KIND_TO_LEGACY: Record<string, { path: string; element: ReactElement } | undefined>` — для 422-видов экрана: путь-паттерн (для вложенного `<Route>`) + ленивый элемент легаси-страницы.
- Produces: `resolveLegacyEntry(kind: string): { path: string; element: ReactElement } | null`.

- [ ] **Step 1: Падающий тест**

```tsx
// src/pages/sdui-catch-all/lib/kind-to-legacy.test.tsx
import { describe, expect, it } from 'vitest'
import { resolveLegacyEntry } from './kind-to-legacy'

describe('resolveLegacyEntry', () => {
  it('DOCUMENT_LIST → паттерн списка документов', () => {
    const e = resolveLegacyEntry('DOCUMENT_LIST')
    expect(e?.path).toBe('/modules/:pageCode/document/:moduleCode')
    expect(e?.element).toBeTruthy()
  })
  it('DOCUMENT_MOVEMENTS → паттерн движений', () => {
    expect(resolveLegacyEntry('DOCUMENT_MOVEMENTS')?.path).toBe(
      '/modules/:pageCode/document/:moduleCode/:entryId/movements'
    )
  })
  it('неизвестный kind → null', () => {
    expect(resolveLegacyEntry('WAT')).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/pages/sdui-catch-all/lib/kind-to-legacy.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать таблицу**

Использовать те же `lazy`-страницы, что в `App.tsx`. Паттерны — из существующих `<Route>`.

```tsx
// src/pages/sdui-catch-all/lib/kind-to-legacy.tsx
import { lazy, type ReactElement } from 'react'

// Ленивые легаси-страницы (композиционный слой знает оба мира).
const DocumentPage = lazy(() =>
  import('@/pages/documents/document-list').then((m) => ({
    default: m.DocumentPage,
  }))
)
const DocumentMovementsPage = lazy(() =>
  import('@/pages/documents/document-movements').then((m) => ({
    default: m.DocumentMovementsPage,
  }))
)
const DictionaryPage = lazy(() =>
  import('@/pages/dictionaries/dictionary-list').then((m) => ({
    default: m.DictionaryPage,
  }))
)
const InformationRegisterPage = lazy(() =>
  import('@/pages/information-register/information-register-list').then(
    (m) => ({
      default: m.InformationRegisterPage,
    })
  )
)
const AccumulationRegisterPage = lazy(() =>
  import('@/pages/accumulation-register/accumulation-register-list').then(
    (m) => ({
      default: m.AccumulationRegisterPage,
    })
  )
)
const AccountingRegisterPage = lazy(() =>
  import('@/pages/accounting-register/accounting-register-list').then((m) => ({
    default: m.AccountingRegisterPage,
  }))
)
const AccountPlanPage = lazy(() =>
  import('@/pages/account-plan/account-plan-list').then((m) => ({
    default: m.AccountPlanPage,
  }))
)
const OsvReportPage = lazy(() =>
  import('@/pages/osv-report/osv-report-list').then((m) => ({
    default: m.OsvReportPage,
  }))
)
const ReportPage = lazy(() =>
  import('@/pages/reports/report-list').then((m) => ({ default: m.ReportPage }))
)
const ReportAltPage = lazy(() =>
  import('@/pages/reportalt').then((m) => ({ default: m.ReportAltPage }))
)
const FinancingPlanUploadPage = lazy(() =>
  import('@/pages/financing-plan-upload').then((m) => ({
    default: m.FinancingPlanUploadPage,
  }))
)
const UniversalDomainPage = lazy(() =>
  import('@/pages/universal-domain/universal-domain-list').then((m) => ({
    default: m.UniversalDomainPage,
  }))
)

interface LegacyEntry {
  path: string
  element: ReactElement
}

// Виды экрана, для которых бэк отдаёт 422 SCREEN_NOT_SDUI (§3 бэк-спеки).
// Инфраструктура под task 9: в Phase 2 явные <Route> перехватывают эти
// маршруты раньше catch-all, поэтому таблица дремлет, но обязана быть полной.
const KIND_TO_LEGACY: Record<string, LegacyEntry> = {
  DOCUMENT_LIST: {
    path: '/modules/:pageCode/document/:moduleCode',
    element: <DocumentPage />,
  },
  DOCUMENT_MOVEMENTS: {
    path: '/modules/:pageCode/document/:moduleCode/:entryId/movements',
    element: <DocumentMovementsPage />,
  },
  DICTIONARY_LIST: {
    path: '/modules/:pageCode/dictionary/:moduleCode',
    element: <DictionaryPage />,
  },
  REGISTER: {
    path: '/modules/:pageCode/informationregister/:moduleCode',
    element: <InformationRegisterPage />,
  },
  ACCUMULATION_REGISTER: {
    path: '/modules/:pageCode/accumulationregister/:moduleCode',
    element: <AccumulationRegisterPage />,
  },
  ACCOUNTING_REGISTER: {
    path: '/modules/:pageCode/accountingregister/:moduleCode',
    element: <AccountingRegisterPage />,
  },
  ACCOUNT_PLAN: {
    path: '/modules/:pageCode/accountplan/:moduleCode',
    element: <AccountPlanPage />,
  },
  ACCOUNTING_REPORT: {
    path: '/modules/:pageCode/accountingreport/:moduleCode',
    element: <OsvReportPage />,
  },
  REPORT: {
    path: '/modules/:pageCode/report/:moduleCode',
    element: <ReportPage />,
  },
  REPORT_ALT: {
    path: '/modules/:pageCode/reportalt/:moduleCode',
    element: <ReportAltPage />,
  },
  DATA_PROCESSOR: {
    path: '/modules/:pageCode/dataprocessor/:moduleCode',
    element: <FinancingPlanUploadPage />,
  },
  CALCULATION_PLAN: {
    path: '/modules/:pageCode/calculationplan/:moduleCode',
    element: <UniversalDomainPage />,
  },
}

export function resolveLegacyEntry(kind: string): LegacyEntry | null {
  return KIND_TO_LEGACY[kind] ?? null
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `npx vitest run src/pages/sdui-catch-all/lib/kind-to-legacy.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/sdui-catch-all/lib/kind-to-legacy.tsx src/pages/sdui-catch-all/lib/kind-to-legacy.test.tsx
git commit -m "add: таблица kind → легаси-страница для catch-all фолбэка (SCRUM-290)"
```

---

## Task 10: LegacyFallback

**Files:**

- Create: `src/pages/sdui-catch-all/ui/legacy-fallback.tsx`
- Test: `src/pages/sdui-catch-all/ui/legacy-fallback.test.tsx`

**Interfaces:**

- Consumes: `resolveLegacyEntry` (Task 9), `NotFound` (Task 8).
- Produces: `export const LegacyFallback: FC<{ kind: string | null }>` — рендерит легаси-страницу через вложенный `<Routes><Route path={entry.path} element={entry.element}/></Routes>`, чтобы легаси получил `useParams`; при неизвестном `kind` — `<NotFound/>`.

- [ ] **Step 1: Падающий тест**

```tsx
// src/pages/sdui-catch-all/ui/legacy-fallback.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Suspense } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LegacyFallback } from './legacy-fallback'

// Легаси-страницы ленивые/тяжёлые — мокаем таблицу
vi.mock('../lib/kind-to-legacy', () => ({
  resolveLegacyEntry: (kind: string) =>
    kind === 'DOCUMENT_LIST'
      ? {
          path: '/modules/:pageCode/document/:moduleCode',
          element: <div>ЛЕГАСИ-СПИСОК</div>,
        }
      : null,
}))

describe('LegacyFallback', () => {
  it('монтирует легаси-страницу по kind на совпадающем URL', () => {
    render(
      <MemoryRouter initialEntries={['/modules/kazna/document/RKO']}>
        <Suspense fallback={null}>
          <LegacyFallback kind="DOCUMENT_LIST" />
        </Suspense>
      </MemoryRouter>
    )
    expect(screen.getByText('ЛЕГАСИ-СПИСОК')).toBeTruthy()
  })

  it('неизвестный kind → NotFound', () => {
    render(
      <MemoryRouter initialEntries={['/whatever']}>
        <LegacyFallback kind={null} />
      </MemoryRouter>
    )
    // NotFound рендерит i18n-ключ или перевод
    expect(screen.getByText(/notFound|не найдена/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/pages/sdui-catch-all/ui/legacy-fallback.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать**

```tsx
// src/pages/sdui-catch-all/ui/legacy-fallback.tsx
import type { FC } from 'react'
import { Routes, Route } from 'react-router-dom'

import { NotFound } from '@/shared/ui/not-found/not-found'

import { resolveLegacyEntry } from '../lib/kind-to-legacy'

// 422 SCREEN_NOT_SDUI: монтируем легаси-страницу. Вложенный <Routes> нужен,
// чтобы легаси получил свой useParams (мы не рефакторим легаси под пропы).
export const LegacyFallback: FC<{ kind: string | null }> = ({ kind }) => {
  const entry = kind ? resolveLegacyEntry(kind) : null
  if (!entry) return <NotFound />
  return (
    <Routes>
      <Route path={entry.path} element={entry.element} />
    </Routes>
  )
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `npx vitest run src/pages/sdui-catch-all/ui/legacy-fallback.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/sdui-catch-all/ui/legacy-fallback.tsx src/pages/sdui-catch-all/ui/legacy-fallback.test.tsx
git commit -m "add: LegacyFallback — монтаж легаси по kind (SCRUM-290)"
```

---

## Task 11: SduiCatchAllPage + маршрут в App.tsx

**Files:**

- Create: `src/pages/sdui-catch-all/ui/sdui-catch-all-page.tsx`
- Create: `src/pages/sdui-catch-all/index.ts`
- Test: `src/pages/sdui-catch-all/ui/sdui-catch-all-page.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**

- Consumes: `SduiScreen` (пропы `onOpenFailed(info)`, `onRouteUnknown`, `onTab` — Task 7), `LegacyFallback` (Task 10), `NotFound` (Task 8), `mapKindToPageType` (Task 6), `useWorkspaceTabsStore` (`activateOrCreate`).
- Produces: `export const SduiCatchAllPage: FC`.
- Поведение: состояние `mode: 'sdui' | { legacy: kind } | 'not-found'`. 200 → SDUI + авторство вкладки из `tab`; 422 → LegacyFallback(kind); 404 ROUTE_UNKNOWN → NotFound.

- [ ] **Step 1: Падающий тест поведения**

```tsx
// src/pages/sdui-catch-all/ui/sdui-catch-all-page.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SduiCatchAllPage } from './sdui-catch-all-page'

// Управляем исходом OPEN через мок SduiScreen
vi.mock('@/features/sdui', async (orig) => {
  const actual = await orig<typeof import('@/features/sdui')>()
  return {
    ...actual,
    SduiScreen: (props: {
      onRouteUnknown?: () => void
      onOpenFailed?: (i?: { kind?: string }) => void
    }) => {
      // тест переопределяет window.__catchAllCase
      const c = (window as unknown as { __catchAllCase?: string })
        .__catchAllCase
      if (c === 'route-unknown') props.onRouteUnknown?.()
      if (c === '422') props.onOpenFailed?.({ kind: 'DOCUMENT_LIST' })
      return <div>SDUI-ДЕРЕВО</div>
    },
  }
})

vi.mock('./legacy-fallback', () => ({
  LegacyFallback: ({ kind }: { kind: string | null }) => (
    <div>ЛЕГАСИ:{kind}</div>
  ),
}))

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SduiCatchAllPage />
    </MemoryRouter>
  )

describe('SduiCatchAllPage', () => {
  it('200 → рендерит SDUI-дерево', () => {
    ;(window as never as { __catchAllCase?: string }).__catchAllCase = 'ok'
    renderAt('/some/sdui/route')
    expect(screen.getByText('SDUI-ДЕРЕВО')).toBeTruthy()
  })

  it('422 → LegacyFallback с kind', () => {
    ;(window as never as { __catchAllCase?: string }).__catchAllCase = '422'
    renderAt('/modules/kazna/document/RKO')
    expect(screen.getByText('ЛЕГАСИ:DOCUMENT_LIST')).toBeTruthy()
  })

  it('404 ROUTE_UNKNOWN → NotFound', () => {
    ;(window as never as { __catchAllCase?: string }).__catchAllCase =
      'route-unknown'
    renderAt('/foo/bar')
    expect(screen.getByText(/notFound|не найдена/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/pages/sdui-catch-all/ui/sdui-catch-all-page.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать страницу**

```tsx
// src/pages/sdui-catch-all/ui/sdui-catch-all-page.tsx
import { useState, type FC } from 'react'
import { useLocation } from 'react-router-dom'

import { SduiScreen, mapKindToPageType } from '@/features/sdui'
import type { ViewTabMeta } from '@/features/sdui'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { NotFound } from '@/shared/ui/not-found/not-found'

import { LegacyFallback } from './legacy-fallback'

type Mode =
  | { kind: 'sdui' }
  | { kind: 'legacy'; screenKind: string | null }
  | { kind: 'not-found' }

export const SduiCatchAllPage: FC = () => {
  const location = useLocation()
  const [mode, setMode] = useState<Mode>({ kind: 'sdui' })

  const authorTab = (tab: ViewTabMeta | null) => {
    if (!tab) return
    const pageType = mapKindToPageType(tab.kind)
    if (!pageType) return
    useWorkspaceTabsStore
      .getState()
      .activateOrCreate(location.pathname, location.search, pageType)
  }

  if (mode.kind === 'not-found') return <NotFound />
  if (mode.kind === 'legacy') return <LegacyFallback kind={mode.screenKind} />

  return (
    <SduiScreen
      onTab={authorTab}
      onOpenFailed={(info) =>
        setMode({ kind: 'legacy', screenKind: info?.kind ?? null })
      }
      onRouteUnknown={() => setMode({ kind: 'not-found' })}
    />
  )
}
```

Замечание: `ViewTabMeta` должен быть реэкспортирован из `@/features/sdui` (добавить `export type { ViewTabMeta } from './types/view'` в `src/features/sdui/index.ts`, если ещё нет).

- [ ] **Step 4: Barrel слайса**

```ts
// src/pages/sdui-catch-all/index.ts
export { SduiCatchAllPage } from './ui/sdui-catch-all-page'
```

- [ ] **Step 5: Запустить — зелёный**

Run: `npx vitest run src/pages/sdui-catch-all`
Expected: PASS.

- [ ] **Step 6: Подключить catch-all в App.tsx**

В `App.tsx` добавить lazy-импорт рядом с прочими:

```tsx
const SduiCatchAllPage = lazy(() =>
  import('@/pages/sdui-catch-all').then((m) => ({
    default: m.SduiCatchAllPage,
  }))
)
```

И **последним** в `<Routes>` (после `reportalt`):

```tsx
<Route path="*" element={<SduiCatchAllPage />} />
```

Существующие `<Route>` не трогать.

- [ ] **Step 7: Прогнать быстрый smoke на App (если есть тест) или пропустить**

Run: `npx vitest run src/pages/sdui-catch-all src/features/sdui`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/sdui-catch-all src/app/App.tsx src/features/sdui/index.ts
git commit -m "feat: catch-all маршрут SduiCatchAllPage (SDUI/422→легаси/404→NotFound) — SCRUM-290"
```

---

## Task 12: §4.5 — ОТЛОЖЕН (снятие регексов ломает легаси-вкладки) + регресс-гард

**Обоснование отсрочки.** Снятие регексов `document-entry`/`dictionary-entry`/`module`
из `resolve-page-type.ts` в текущем состоянии фронта **ломает легаси-вкладки**:

- `ModulePage` (`/modules/:pageCode`) — не SDUI, `/api/view` не дёргает вовсе →
  `tab.kind==='MODULE'` фронту не приходит. Снять регекс `module` нечем заменить.
  Разблокируется shell-миграцией (задача 7 «shell», отдельный тикет).
- Регексы `document-entry`/`dictionary-entry` — path-based, обслуживают **и SDUI, и
  легаси** вариант одного URL (развилка по `newView`, которого regex не знает). По §3
  бэк-спеки `newView=true` — меньшинство из ~93 типов, т.е. большинство карточек —
  легаси без view-ответа; вкладку им создаёт именно этот регекс. Снять → сломать
  вкладки большинства.

Вывод: в Phase 2 ни один из трёх регексов не SDUI-эксклюзивен → **регексы остаются**.
Инфраструктура `tab.kind` (поле в `ViewResponse` — Task 5; `mapKindToPageType` —
Task 6; `onTab` — Task 7) заведена и используется **только catch-all** (Task 11), где
конфликта с регексами нет (catch-all ловит маршруты, которые регекс не матчит).
Авторство вкладок SDUI-страницами (`sdui-document-page`/`sdui-dictionary-entry-page`)
**не добавляем** — при живых регексах оно избыточно и задвоило бы `activateOrCreate`.

Критерий §7.7 (MODULE из `tab.kind`) — помечаем как заблокированный shell-миграцией,
не Phase 2. Отписать бэкендеру (§8 бэк-спеки).

**Files:**

- Test: `src/features/workspace-tabs/lib/utils/resolve-page-type.test.ts` (регресс-гард)
- Modify: `src/features/workspace-tabs/lib/utils/resolve-page-type.ts` (комментарий-маркер)

- [ ] **Step 1: Регресс-тест — текущее поведение резолвера залочено**

Создать/дополнить `resolve-page-type.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolvePageType } from './resolve-page-type'

// SCRUM-290 §4.5 отложен: регексы обслуживают легаси-вкладки, снятие ломает их.
// Гард фиксирует, что все текущие паттерны продолжают резолвиться.
describe('resolvePageType — регресс-гард (SCRUM-290, §4.5 отложен)', () => {
  it('SDUI/клиентские виды пока резолвятся регексом (до shell-миграции)', () => {
    expect(resolvePageType('/modules/kazna')).toBe('module')
    expect(resolvePageType('/modules/kazna/document/RKO/42')).toBe(
      'document-entry'
    )
    expect(resolvePageType('/modules/kazna/document/RKO/new')).toBe(
      'document-entry'
    )
    expect(resolvePageType('/modules/kazna/dictionary/Kontragent/7')).toBe(
      'dictionary-entry'
    )
  })

  it('легаси-виды резолвятся', () => {
    expect(resolvePageType('/modules/kazna/document/RKO')).toBe('document-list')
    expect(resolvePageType('/modules/kazna/dictionary/Kontragent')).toBe(
      'dictionary-list'
    )
    expect(resolvePageType('/modules/kazna/document/RKO/42/movements')).toBe(
      'document-movements'
    )
    expect(resolvePageType('/modules/kazna/informationregister/Reg')).toBe(
      'information-register-list'
    )
    expect(resolvePageType('/modules/kazna/account-card')).toBe('account-card')
  })

  it('несуществующий вид → null', () => {
    expect(resolvePageType('/foo/bar')).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить — зелёный (поведение не меняли)**

Run: `npx vitest run src/features/workspace-tabs/lib/utils/resolve-page-type.test.ts`
Expected: PASS.

- [ ] **Step 3: Маркер отсрочки в коде**

В `resolve-page-type.ts` над массивом `patterns` добавить комментарий:

```ts
// SCRUM-290 §4.5: снятие регексов document-entry/dictionary-entry/module
// отложено — они обслуживают легаси-вкладки (newView-меньшинство мигрировано,
// ModulePage не SDUI). Переезд типа SDUI-вкладок на response.tab.kind — после
// shell-миграции (задача 7). Инфраструктура (mapKindToPageType/onTab) готова.
```

- [ ] **Step 4: Прогнать затронутые тесты**

Run: `npx vitest run src/features/workspace-tabs src/features/sdui src/pages/sdui-catch-all`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workspace-tabs/lib/utils/resolve-page-type.ts src/features/workspace-tabs/lib/utils/resolve-page-type.test.ts
git commit -m "docs: §4.5 отложен до shell-миграции + регресс-гард resolve-page-type (SCRUM-290)"
```

---

## Финальная приёмка (после всех задач)

Пройти критерии §7 бэк-спеки вручную на дев-сервере + прогнать весь SDUI/tabs контур:

```bash
npx vitest run src/features/sdui src/features/workspace-tabs src/pages/sdui-catch-all src/shared/ui/not-found
grep -rn "ФормаОбъекta\|OBJECT_FORM" src/   # пусто
```

Чек-лист §7:

1. OPEN без `layoutCode` открывает карточку документа и справочника — идентично.
2. grep пуст.
3. Прямой URL / F5 / расшаренная ссылка на карточку — без redirect-компонентов.
4. Немигрированный экран через catch-all → легаси (проверяемо в Phase 3; в Phase 2 механизм покрыт unit-тестами Task 10/11).
5. Несуществующий URL → NotFound.
   5-bis. Fallback по 404 (страница с layoutCode) и по 422 (route-only).
6. `SESSION_NOT_FOUND` без `layoutCode` → reopen по route.
7. Вкладка `/modules/:pageCode` = тип из `tab.kind === 'MODULE'` — **отложено**
   (ModulePage не SDUI; разблокируется shell-миграцией, задача 7). В Phase 2
   вкладка модуля продолжает работать через регекс (регресс-гард Task 12).
8. Регресса нет у страниц с `layoutCode` (если такие остались — их поведение прежнее).

Если всё зелёное — таска готова к передаче/ревью. Отписать бэкендеру: §4.5
(снятие регексов) отложено — премиса «SDUI-эксклюзивных маршрутов» не выполняется
на текущем фронте (см. §8 бэк-спеки, вопрос про shell).

---

## Self-Review (заполнено автором плана)

**Покрытие спеки:**

- §4.1 (layoutCode опционален, reopen route-only) → Task 2.
- §4.2 (убрать конвенции) → Task 4.
- §4.3 (catch-all `<Route>`) → Task 11.
- §4.4 (SduiCatchAllPage: 200/422/404) → Task 6–11.
- §4.5 (понижение resolve-page-type, tab.kind) → Task 5 (тип tab), 6/7 (инфра
  `mapKindToPageType`/`onTab`, потребитель — catch-all). Снятие регексов и §7.7
  **отложены** (Task 12) — ломают легаси-вкладки, разблокируются shell-миграцией.
- Контракт ошибок §2 (422/404, ключ `error` vs `code`) → Task 1, 3.
- Ловушки §5: 404-фолбэк сохранён (Task 3, ветка NOT_FOUND); `tab=null` (Task 6/7/11 — `if (!tab) return`); списки/redirect не трогаем (в границах плана); copy/domain уже гейтятся на легаси.

**Плейсхолдеры:** нет TODO/TBD; весь код приведён.

**Согласованность типов:** `ViewHttpError(code, kind)` (Task 1) ↔ гейт (Task 3); `ViewTabMeta` (Task 5) ↔ `onTab`/`onOpenTab` (Task 7) ↔ авторство (Task 11/12); `mapKindToPageType` (Task 6) ↔ Task 11/12; `resolveLegacyEntry` (Task 9) ↔ `LegacyFallback` (Task 10); `onOpenNotFound(info?)`/`onRouteUnknown` единообразны Task 3↔7↔11.

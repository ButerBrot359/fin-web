# SDUI Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Исправить все находки ревью `docs/superpowers/specs/2026-07-02-sdui-code-review.md` (CRIT C1–C4, границы B1/B2/B5, MAJOR M1–M11, MINOR m1–m9) и завести тестовую инфраструктуру vitest.

**Architecture:** SDUI-движок в `src/features/sdui`: `view-transport` (POST /api/view) → `dispatch` (EVENT/COMMAND, патчи, эффекты) → zustand-сторы (tree/view-state) → `node-renderer` + registry. Легаси-путь (FormRenderer) не трогаем, кроме развязки границы (C3, B1, B2).

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Zustand, TanStack Query, MUI, react-i18next, zod 4, vitest (добавляется в Task 0).

## Global Constraints

Из CLAUDE.md и памяти проекта — действуют для КАЖДОЙ задачи:

- Тексты только через `useTranslation` и ключи из `common.json` (ru и kz: `src/app/config/i18n/locales/{ru,kz}/common.json`). В не-React-коде — `i18n.t(...)` через `import i18n from 'i18next'`.
- Текстовые элементы — `<Typography>` из `@mui/material`.
- НЕ добавлять `useMemo`/`useCallback` без явной перф-причины; если причина есть — комментарий рядом (пример: `syncRef` в `editable-table.tsx`).
- API-запросы — в сегменте `api/` слайса; мутации через `useMutation`.
- Barrel-экспорты (`index.ts`) только на уровне слайса. Внутри сегментов — прямые импорты.
- Формат коммита: `feat|fix|add|refactor: описание` (описание по-русски, как в истории).
- НЕ запускать `tsc --noEmit`, `npm run lint`, `npm run build`. Верификация — только `npm run test` (появится в Task 0).
- Легаси-код (`form-renderer`, `document-entry` хуки, `dict-sidebar` изнутри) не менять, кроме мест, прямо указанных в задачах.
- Алиас `@/*` → `src/*`.

**Порядок фаз:** Task 0 (инфра) → Фаза 1 CRIT (1–4) → Фаза 2 граница (5–6) → Фаза 3 MAJOR (7–14) → Фаза 4 MINOR (15–18). Внутри фазы задачи независимы, но выполнять по номерам — поздние опираются на ранние (см. Interfaces).

---

### Task 0: Тестовая инфраструктура vitest

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Create: `vitest.config.ts`
- Create: `src/features/sdui/lib/patch-applier.test.ts`

**Interfaces:**
- Produces: команда `npm run test` (vitest run, jsdom, алиас `@`); все последующие задачи используют её для верификации.

- [ ] **Step 1: Установить зависимости**

```bash
npm i -D vitest jsdom @testing-library/react @testing-library/dom
```

- [ ] **Step 2: Добавить script в package.json**

В `"scripts"` добавить:

```json
"test": "vitest run"
```

- [ ] **Step 3: Создать vitest.config.ts**

```ts
import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 4: Написать smoke-тест patch-applier**

`src/features/sdui/lib/patch-applier.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { ViewNode, ViewPatch } from '../types/view'
import { applyPatches, applyValuePatches, clearErrors } from './patch-applier'

const tree: ViewNode = {
  id: 'root',
  type: 'PAGE',
  children: [
    { id: 'f1', type: 'TEXT_FIELD', props: { label: 'A', error: 'bad' } },
    { id: 'f2', type: 'TEXT_FIELD', props: { label: 'B' } },
  ],
} as ViewNode

describe('applyPatches', () => {
  it('setProp обновляет prop узла, не мутируя исходное дерево', () => {
    const patch: ViewPatch = { op: 'setProp', nodeId: 'f2', key: 'label', value: 'C' } as ViewPatch
    const next = applyPatches(tree, [patch])
    expect(next.children![1].props!.label).toBe('C')
    expect(tree.children![1].props!.label).toBe('B')
  })

  it('removeNode удаляет узел', () => {
    const next = applyPatches(tree, [{ op: 'removeNode', nodeId: 'f1' } as ViewPatch])
    expect(next.children).toHaveLength(1)
  })
})

describe('clearErrors', () => {
  it('обнуляет props.error по всему дереву', () => {
    const next = clearErrors(tree)
    expect(next.children![0].props!.error).toBeNull()
  })
})

describe('applyValuePatches', () => {
  it('вызывает setter только для setValue-патчей с binding', () => {
    const calls: Array<[string, unknown]> = []
    applyValuePatches(
      [
        { op: 'setValue', binding: 'x', value: 1 } as ViewPatch,
        { op: 'setProp', nodeId: 'f1', key: 'label', value: 'Z' } as ViewPatch,
      ],
      (b, v) => calls.push([b, v]),
    )
    expect(calls).toEqual([['x', 1]])
  })
})
```

- [ ] **Step 5: Запустить тесты**

Run: `npm run test`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/features/sdui/lib/patch-applier.test.ts
git commit -m "add: тестовая инфраструктура vitest + smoke-тесты patch-applier"
```

---

### Task 1: C1 — render loop в use-table-sync при пустом canon

**Проблема:** `src/features/sdui/lib/hooks/use-table-sync.ts:67` — `(getValue(...) as TableRow[] | undefined) ?? []` создаёт НОВЫЙ массив на каждый рендер; `useEffect([canonRows])` (строка 141) срабатывает каждый рендер и вызывает `setLocalRows` → бесконечный цикл рендеров у таблицы без значения в сторе.

**Files:**
- Modify: `src/features/sdui/lib/hooks/use-table-sync.ts:67`
- Create: `src/features/sdui/lib/hooks/use-table-sync.test.tsx`

**Interfaces:**
- Consumes: vitest из Task 0.
- Produces: стабильную ссылку `EMPTY_ROWS`; тест-файл, который Task 2 дополнит.

- [ ] **Step 1: Написать падающий тест**

`src/features/sdui/lib/hooks/use-table-sync.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useTableSync } from './use-table-sync'

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

const sessionState: Record<string, unknown> = {}
vi.mock('../sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
  }),
}))

const node = { id: 'tbl', type: 'TABLE', binding: 'rows' } as ViewNode

describe('useTableSync', () => {
  it('не зацикливается, когда canon-значение отсутствует в сторе', () => {
    delete sessionState.rows
    // При баге C1 renderHook падает с "Maximum update depth exceeded"
    const { result, rerender } = renderHook(() => useTableSync(node, []))
    rerender()
    expect(result.current.rows).toEqual([])
  })
})
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `npm run test -- use-table-sync`
Expected: FAIL — `Maximum update depth exceeded` (или таймаут рендера).

- [ ] **Step 3: Исправление — стабильный пустой массив**

В `use-table-sync.ts` над `useTableSync` добавить модульную константу и заменить строку 67:

```ts
const EMPTY_ROWS: TableRow[] = []
```

```ts
// было:
const canonRows = (getValue(node.binding) as TableRow[] | undefined) ?? []
// стало:
const canonRows = (getValue(node.binding) as TableRow[] | undefined) ?? EMPTY_ROWS
```

- [ ] **Step 4: Запустить тесты**

Run: `npm run test -- use-table-sync`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/hooks/use-table-sync.ts src/features/sdui/lib/hooks/use-table-sync.test.tsx
git commit -m "fix: C1 render loop в use-table-sync при отсутствующем canon-значении"
```

---

### Task 2: C2 — deadlock inFlight при ошибке dispatch + save-and-close при неудачном save

**Проблема:** `dispatch` возвращает `Promise<void>` и глотает ошибки (catch → toast). `use-table-sync.sendEvent` ставит `inFlightRef=true` и снимает его ТОЛЬКО при приходе canon; при ошибке сети canon не приходит → таблица навсегда «in flight», `flushPending` не резолвится, save зависает. Плюс `sdui-screen.tsx:86-96`: save-and-close закрывает вкладку даже если save упал.

**Files:**
- Modify: `src/features/sdui/lib/dispatch.ts` (сигнатура dispatch → `Promise<boolean>`)
- Modify: `src/features/sdui/lib/hooks/use-table-sync.ts` (sendEvent, flushReject)
- Modify: `src/features/sdui/ui/sdui-screen.tsx:86-96`
- Modify: `src/app/config/i18n/locales/ru/common.json`, `src/app/config/i18n/locales/kz/common.json`
- Test: `src/features/sdui/lib/hooks/use-table-sync.test.tsx`, `src/features/sdui/lib/pending-table-commits.test.ts` (create)

**Interfaces:**
- Produces: `useSduiDispatch(): (action: ViewAction) => Promise<boolean>` — `true` = успех, `false` = ошибка/конфликт. Task 4 расширит сигнатуру вторым параметром `isRetry`.

- [ ] **Step 1: Падающий тест — flush отклоняется при ошибке dispatch**

Добавить в `use-table-sync.test.tsx`:

```tsx
it('flushPending отклоняется, если dispatch вернул false (ошибка сети)', async () => {
  delete sessionState.rows
  mockDispatch.mockResolvedValueOnce(false)
  const { result } = renderHook(() => useTableSync(node, []))
  act(() => {
    result.current.updateCell('tmp-x', 'a', 1) // локальное изменение
  })
  await expect(result.current.flushPending()).rejects.toThrow()
})
```

(добавить `act` в импорт из `@testing-library/react`)

И создать `src/features/sdui/lib/pending-table-commits.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'

import {
  flushAllPendingTableCommits,
  registerPendingFlush,
  unregisterPendingFlush,
} from './pending-table-commits'

describe('flushAllPendingTableCommits', () => {
  afterEach(() => unregisterPendingFlush('t'))

  it('отклоняется, если хоть один flush отклонился', async () => {
    registerPendingFlush('t', () => Promise.reject(new Error('boom')))
    await expect(flushAllPendingTableCommits()).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Запустить — тест flushPending падает**

Run: `npm run test -- use-table-sync pending-table-commits`
Expected: тест `flushPending отклоняется…` FAIL (промис висит/резолвится); тест pending-table-commits PASS (Promise.all уже отклоняется — фиксируем контракт).

- [ ] **Step 3: dispatch → Promise<boolean>**

В `src/features/sdui/lib/dispatch.ts` изменить `useCallback`-колбэк (строки 79–217):

```ts
const dispatch = useCallback(
  async (action: ViewAction): Promise<boolean> => {
    ...
    try {
      ...
      // в конце блока try (после if/else-цепочки):
      return true
    } catch (error) {
      if (error instanceof ViewConflictError) {
        handleConflict(error.data, action, reopen)
      } else {
        const message = error instanceof Error ? error.message : i18n.t('sdui.requestError')
        showToast('error', message)
      }
      return false
    }
  },
  [location.pathname, location.search, navigate, session],
)
```

Плюс в начале try заменить flush-блок:

```ts
if (action.type === 'COMMAND' && SAVE_COMMANDS.includes(action.command ?? '')) {
  try {
    await flushAllPendingTableCommits()
  } catch {
    showToast('error', i18n.t('sdui.tableFlushFailed'))
    return false
  }
}
```

Импорт: `import i18n from 'i18next'`. Ключи (Step 5).

- [ ] **Step 4: use-table-sync — сброс inFlight и reject flush при неудаче**

В `use-table-sync.ts`:

1. Рядом с `flushResolveRef` добавить:

```ts
const flushRejectRef = useRef<((err: Error) => void) | null>(null)
```

2. Заменить `sendEvent`:

```ts
const sendEvent = (rows: TableRow[]) => {
  inFlightRef.current = true
  void dispatch({
    type: 'EVENT',
    sourceNodeId: node.id,
    trigger: 'change',
    value: rows,
  }).then((ok) => {
    if (ok) return
    // Ошибка сети/сервера: canon не придёт — снимаем in-flight и роняем flush,
    // иначе таблица зависает «в полёте» и save молча теряет строки.
    inFlightRef.current = false
    dirtyRef.current = new Map()
    needsCoalescedCommitRef.current = false
    flushRejectRef.current?.(new Error('table commit failed'))
    flushResolveRef.current = null
    flushRejectRef.current = null
  })
}
```

3. Во всех трёх `new Promise<void>((resolve) => {...})` внутри `flushPending` сохранять и reject:

```ts
return new Promise<void>((resolve, reject) => {
  flushResolveRef.current = resolve
  flushRejectRef.current = reject
  ...
})
```

4. В useEffect([canonRows]) — там, где `flushResolveRef.current?.()` и обнуление, также обнулять `flushRejectRef.current = null`.

- [ ] **Step 5: i18n-ключи**

В `ru/common.json` в объект `sdui` добавить:

```json
"requestError": "Ошибка запроса",
"tableFlushFailed": "Не удалось сохранить изменения таблицы"
```

В `kz/common.json` — те же ключи (казахский перевод по аналогии с соседними ключами; если соседние ключи в kz дублируют русский текст — сделать так же).

- [ ] **Step 6: sdui-screen — закрывать вкладку только при успехе**

`src/features/sdui/ui/sdui-screen.tsx:86` заменить `.then(() => {` на:

```ts
void dispatch({ type: 'COMMAND', command: 'save' }).then((ok) => {
  if (!ok) return
  useFormCacheStore.getState().removeTab(route)
  ...
})
```

- [ ] **Step 7: Прогнать все тесты**

Run: `npm run test`
Expected: PASS (включая тесты Task 0/1).

- [ ] **Step 8: Commit**

```bash
git add src/features/sdui/lib/dispatch.ts src/features/sdui/lib/hooks/use-table-sync.ts src/features/sdui/lib/hooks/use-table-sync.test.tsx src/features/sdui/lib/pending-table-commits.test.ts src/features/sdui/ui/sdui-screen.tsx src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "fix: C2 deadlock таблиц при ошибке dispatch, save-and-close не закрывает вкладку при неудаче"
```

---

### Task 3: C3/B3 — условный вызов хуков в точке ветвления легаси/SDUI

**Проблема:** `src/pages/documents/documents-entry/ui/document-entry-page.tsx:44-46` — `if (newView) return <SduiDocumentPage/>` стоит ДО ~10 вызовов хуков. Если `newView` изменится между рендерами (инвалидация кэша document-type), React упадёт с «Rendered fewer hooks than expected».

**Files:**
- Create: `src/pages/documents/documents-entry/ui/legacy-document-entry-page.tsx`
- Modify: `src/pages/documents/documents-entry/ui/document-entry-page.tsx`

**Interfaces:**
- Produces: `LegacyDocumentEntryPage` (без пропсов, читает useParams сам); `DocumentEntryPage` — тонкий свитч.

- [ ] **Step 1: Создать legacy-document-entry-page.tsx**

Перенести ТЕЛО текущего `document-entry-page.tsx` целиком (строки 1–226) в новый файл `legacy-document-entry-page.tsx` со следующими правками:

1. Переименовать компонент: `export const LegacyDocumentEntryPage = () => {`.
2. Строка 42: убрать `newView` из деструктуризации — `const { title, attributes } = useDocumentType(moduleCode)`.
3. Удалить строки 44–46 (ветку `if (newView) …`).
4. Удалить импорт `SduiDocumentPage` (строка 23).

Остальное — байт-в-байт как было (включая все импорты и хуки).

- [ ] **Step 2: Переписать document-entry-page.tsx как тонкий свитч**

Полное новое содержимое файла:

```tsx
import { useParams } from 'react-router-dom'

import { useDocumentType } from '@/entities/document-type'

import { SduiDocumentPage } from './sdui-document-page'
import { LegacyDocumentEntryPage } from './legacy-document-entry-page'

export const DocumentEntryPage = () => {
  const { moduleCode = '' } = useParams()
  const { newView } = useDocumentType(moduleCode)

  if (newView) {
    return <SduiDocumentPage moduleCode={moduleCode} />
  }
  return <LegacyDocumentEntryPage />
}
```

Хуки здесь вызываются безусловно; смена `newView` теперь меняет только поддерево — это легально.

- [ ] **Step 3: Ручная проверка**

Открыть в dev-режиме (`npm run dev`) любую легаси-форму документа и любую SDUI-форму (`newView=true`) — обе рендерятся как раньше. (Если dev-сервер недоступен — пропустить, изменение механическое.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/documents/documents-entry/ui/document-entry-page.tsx src/pages/documents/documents-entry/ui/legacy-document-entry-page.tsx
git commit -m "fix: C3 вынести легаси-форму документа в отдельный компонент (условные хуки)"
```

---

### Task 4: C4 — конфликт-хендлер пишет в глобальные сторы и теряет действие

**Проблема:** `src/features/sdui/lib/conflict-handler.ts` при STALE_REVISION всегда пишет в глобальные `useTreeStore`/`useViewStateStore`, даже если конфликт случился в панели (DialogHost) со своей сессией — данные панели затираются данными рута. `_originalAction` игнорируется — действие пользователя молча теряется.

**Files:**
- Modify: `src/features/sdui/lib/conflict-handler.ts` (новая сигнатура)
- Modify: `src/features/sdui/lib/dispatch.ts` (передать session и retry)
- Create: `src/features/sdui/lib/conflict-handler.test.ts`

**Interfaces:**
- Consumes: `dispatch(action): Promise<boolean>` из Task 2.
- Produces:

```ts
export interface ConflictSession {
  setSession: (id: string, revision: number) => void
  replaceAll: (state: Record<string, unknown>) => void
}
export function handleConflict(
  err: ConflictError,
  session: ConflictSession,
  retry: (() => Promise<boolean>) | null,
  reopen: () => Promise<void>,
): void
```

`dispatch` получает второй параметр `isRetry = false` (защита от бесконечного ретрая).

- [ ] **Step 1: Падающий тест**

`src/features/sdui/lib/conflict-handler.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import type { ConflictError } from '../types/view'
import { handleConflict } from './conflict-handler'

vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const staleErr: ConflictError = {
  code: 'STALE_REVISION',
  formSessionId: 'fs-1',
  currentRevision: 7,
  snapshot: { state: { a: 1 } },
} as ConflictError

describe('handleConflict', () => {
  it('STALE_REVISION: обновляет ПЕРЕДАННУЮ сессию и ретраит действие', () => {
    const session = { setSession: vi.fn(), replaceAll: vi.fn() }
    const retry = vi.fn(() => Promise.resolve(true))
    handleConflict(staleErr, session, retry, () => Promise.resolve())
    expect(session.setSession).toHaveBeenCalledWith('fs-1', 7)
    expect(session.replaceAll).toHaveBeenCalledWith({ a: 1 })
    expect(retry).toHaveBeenCalledOnce()
  })

  it('SESSION_NOT_FOUND: вызывает reopen, не трогая сессию', () => {
    const session = { setSession: vi.fn(), replaceAll: vi.fn() }
    const reopen = vi.fn(() => Promise.resolve())
    handleConflict({ code: 'SESSION_NOT_FOUND' } as ConflictError, session, null, reopen)
    expect(reopen).toHaveBeenCalledOnce()
    expect(session.setSession).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустить — падает** (сигнатура другая, компиляция теста упадёт)

Run: `npm run test -- conflict-handler`
Expected: FAIL.

- [ ] **Step 3: Переписать conflict-handler.ts**

Полное новое содержимое:

```ts
import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ConflictError } from '../types/view'

export interface ConflictSession {
  setSession: (id: string, revision: number) => void
  replaceAll: (state: Record<string, unknown>) => void
}

export function handleConflict(
  err: ConflictError,
  session: ConflictSession,
  retry: (() => Promise<boolean>) | null,
  reopen: () => Promise<void>,
): void {
  if (err.code === 'STALE_REVISION') {
    showToast('info', i18n.t('sdui.conflict.staleRevision'))
    if (err.formSessionId && err.currentRevision != null) {
      session.setSession(err.formSessionId, err.currentRevision)
    }
    if (err.snapshot?.state) {
      session.replaceAll(err.snapshot.state)
    }
    if (retry) void retry()
  } else if (err.code === 'SESSION_NOT_FOUND') {
    showToast('warning', i18n.t('sdui.conflict.sessionNotFound'))
    void reopen()
  }
}
```

Ключи `sdui.conflict.staleRevision` / `sdui.conflict.sessionNotFound` УЖЕ существуют в `ru/common.json` (тексты «Синхронизирую...», «Сессия истекла, переоткрываю...») — проверить наличие в `kz/common.json`, при отсутствии добавить.

Убрать импорты `useTreeStore`/`useViewStateStore` и тип `ViewAction`.

- [ ] **Step 4: dispatch.ts — передать сессию и retry**

Изменить сигнатуру колбэка: `async (action: ViewAction, isRetry = false): Promise<boolean>`.

В catch-ветке (после Task 2 она возвращает false):

```ts
if (error instanceof ViewConflictError) {
  const retry =
    !isRetry && action.type !== 'OPEN' ? () => dispatch(action, true) : null
  handleConflict(
    error.data,
    { setSession, replaceAll },
    retry,
    reopen,
  )
}
```

`setSession`/`replaceAll` уже деструктурированы из `session` в начале колбэка — конфликт теперь применяется к ТОЙ сессии (рут или панель), из которой пришло действие.

- [ ] **Step 5: Запустить тесты**

Run: `npm run test`
Expected: PASS (все).

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/lib/conflict-handler.ts src/features/sdui/lib/conflict-handler.test.ts src/features/sdui/lib/dispatch.ts
git commit -m "fix: C4 конфликт-хендлер работает с сессией источника и ретраит действие"
```

---

### Task 5: B1/M5 — развязать reference-field-node от features/dict-sidebar (gateway)

**Проблема:** `src/features/sdui/ui/nodes/fields/reference-field-node.tsx:11` импортирует `useDictSidebarStore` из `@/features/dict-sidebar` — фича импортирует фичу (нарушение FSD), SDUI жёстко связан с легаси-слайсом.

**Files:**
- Create: `src/features/sdui/lib/reference-picker-gateway.ts`
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`
- Modify: `src/app/App.tsx` (регистрация gateway на уровне app)
- Test: `src/features/sdui/lib/reference-picker-gateway.test.ts` (create)

**Interfaces:**
- Produces:

```ts
export interface ReferencePickerRequest {
  mode: 'list' | 'create' | 'edit'
  domain: string
  typeCode: string
  entryId?: number | string
  searchParams?: Record<string, string>
  onSelect: (option: SelectOption | null) => void
}
export function setReferencePickerGateway(g: ((req: ReferencePickerRequest) => void) | null): void
export function openReferencePicker(req: ReferencePickerRequest): void
```

- [ ] **Step 1: Падающий тест**

`src/features/sdui/lib/reference-picker-gateway.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  openReferencePicker,
  setReferencePickerGateway,
  type ReferencePickerRequest,
} from './reference-picker-gateway'

describe('reference-picker-gateway', () => {
  afterEach(() => setReferencePickerGateway(null))

  it('передаёт запрос зарегистрированному gateway', () => {
    const g = vi.fn()
    setReferencePickerGateway(g)
    const req: ReferencePickerRequest = {
      mode: 'list',
      domain: 'DICTIONARY',
      typeCode: 'X',
      onSelect: () => {},
    }
    openReferencePicker(req)
    expect(g).toHaveBeenCalledWith(req)
  })

  it('молча игнорирует вызов без gateway (не бросает)', () => {
    expect(() =>
      openReferencePicker({ mode: 'list', domain: 'D', typeCode: 'X', onSelect: () => {} }),
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Запустить — FAIL** (модуля нет)

Run: `npm run test -- reference-picker-gateway`

- [ ] **Step 3: Создать gateway**

`src/features/sdui/lib/reference-picker-gateway.ts`:

```ts
import type { SelectOption } from '@/shared/types/select-option'

export interface ReferencePickerRequest {
  mode: 'list' | 'create' | 'edit'
  domain: string
  typeCode: string
  entryId?: number | string
  searchParams?: Record<string, string>
  onSelect: (option: SelectOption | null) => void
}

type Gateway = (req: ReferencePickerRequest) => void

let gateway: Gateway | null = null

// SDUI не знает про реализацию пикера справочников (легаси dict-sidebar).
// Хост-приложение регистрирует реализацию на своём уровне (app/).
export function setReferencePickerGateway(g: Gateway | null): void {
  gateway = g
}

export function openReferencePicker(req: ReferencePickerRequest): void {
  gateway?.(req)
}
```

- [ ] **Step 4: reference-field-node — заменить прямые вызовы стора**

В `reference-field-node.tsx`:

1. Удалить строку 11: `import { useDictSidebarStore } from '@/features/dict-sidebar'`.
2. Добавить: `import { openReferencePicker } from '../../../lib/reference-picker-gateway'`.
3. Заменить `openDictList` (строки 134–142):

```ts
const openDictList = () => {
  openReferencePicker({
    mode: 'list',
    domain,
    typeCode: targetTypeCode!,
    onSelect: applySelected,
    searchParams: filterSearchParams,
  })
}
```

4. Аналогично `openDictCreate` (строки 144–152) — `mode: 'create'`, остальные поля те же.
5. В `endAction` (строки 216–222) заменить `useDictSidebarStore.getState().push({...})` на:

```ts
openReferencePicker({
  mode: 'edit',
  domain,
  typeCode: targetTypeCode!,
  entryId: selectedOption.id,
  onSelect: applySelected,
})
```

- [ ] **Step 5: Регистрация в App.tsx**

Прочитать `src/app/App.tsx`. Добавить рядом с другими top-level эффектами/провайдерами:

```tsx
import { useEffect } from 'react'

import { useDictSidebarStore } from '@/features/dict-sidebar'
import { setReferencePickerGateway } from '@/features/sdui'
```

(экспортировать `setReferencePickerGateway` и тип `ReferencePickerRequest` из `src/features/sdui/index.ts` — barrel слайса)

```tsx
useEffect(() => {
  setReferencePickerGateway((req) => {
    useDictSidebarStore.getState().push({
      mode: req.mode,
      domain: req.domain,
      typeCode: req.typeCode,
      entryId: req.entryId,
      onSelect: req.onSelect,
      searchParams: req.searchParams,
    })
  })
  return () => setReferencePickerGateway(null)
}, [])
```

Примечание: сигнатуру `push` сверить с `src/features/dict-sidebar` (поля `mode/domain/typeCode/entryId/onSelect/searchParams` — ровно те, что использовались в reference-field-node до правки; если `entryId` в типе push обязателен только для edit — передавать условно, как было).

- [ ] **Step 6: Запустить тесты + ручная проверка**

Run: `npm run test` → PASS.
Вручную (если dev доступен): на SDUI-форме открыть реф-поле → «Показать все» открывает сайдбар, выбор применяется.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/lib/reference-picker-gateway.ts src/features/sdui/lib/reference-picker-gateway.test.ts src/features/sdui/ui/nodes/fields/reference-field-node.tsx src/features/sdui/index.ts src/app/App.tsx
git commit -m "refactor: B1 развязать reference-field от dict-sidebar через gateway"
```

---

### Task 6: B2/M5 — развязать SduiScreen от features/workspace-tabs

**Проблема:** `src/features/sdui/ui/sdui-screen.tsx:5` импортирует `useTabMeta`, `useWorkspaceTabsStore`, `useFormCacheStore` из `@/features/workspace-tabs` — фича↔фича. Логика вкладок (title, dirty-синк, save-and-close, кэш по вкладке) — забота хоста, а не SDUI-движка.

**Files:**
- Modify: `src/features/sdui/ui/sdui-screen.tsx`
- Modify: `src/pages/documents/documents-entry/ui/sdui-document-page.tsx` (уже импортирует и sdui, и workspace-tabs — легальная точка склейки на уровне pages)

**Interfaces:**
- Produces: новые пропсы `SduiScreen`:

```ts
interface SduiScreenProps {
  layoutCode?: string
  // Хост решает, сохранять ли сессию в кэш при размонтировании (вкладка ещё открыта)
  shouldPersistSession?: (route: string) => boolean
  // Колбэки для интеграции с вкладками; SDUI сам их не реализует
  onTitleChange?: (title: string) => void
  onDirtyChange?: (route: string, dirty: boolean) => void
  // Возвращает pending-действие ('save-and-close' | null) и потребляет его
  consumePendingAction?: (route: string) => string | null
  // Вызывается после успешного save-and-close: хост закрывает вкладку и навигирует
  onSavedAndClosed?: (route: string) => void
}
```

- [ ] **Step 1: Вырезать зависимости из sdui-screen.tsx**

1. Удалить импорт из `@/features/workspace-tabs` (строка 5).
2. `useTabMeta(...)` (строка 29) заменить на:

```ts
const title = (tree?.props?.title as string | undefined) ?? ''
useEffect(() => {
  onTitleChange?.(title)
}, [title, onTitleChange])
```

3. Dirty-синк (строки 31–33):

```ts
useEffect(() => {
  onDirtyChange?.(location.pathname, dirty)
}, [location.pathname, dirty, onDirtyChange])
```

4. В cleanup-эффекте (строки 51–70) заменить `tabStillExists`-проверку:

```ts
const persist = shouldPersistSession?.(route) ?? false
if (persist && treeState.root) { ... save в sdui-cache ... } else { ... CLOSE + remove ... }
```

и заменить `useFormCacheStore.getState().setDirty(route, false)` на `onDirtyChange?.(route, false)`.

5. save-and-close эффект (строки 82–98):

```ts
useEffect(() => {
  const route = location.pathname
  const pending = consumePendingAction?.(route)
  if (pending === 'save-and-close') {
    void dispatch({ type: 'COMMAND', command: 'save' }).then((ok) => {
      if (!ok) return
      onSavedAndClosed?.(route)
    })
  }
}, [location.pathname, dispatch, consumePendingAction, onSavedAndClosed])
```

Импорт `useNavigate` и навигация уезжают в хост.

- [ ] **Step 2: Подключить в sdui-document-page.tsx**

Прочитать текущий `sdui-document-page.tsx`. Там, где рендерится `<SduiScreen …>`, передать реализацию через workspace-tabs (файл УЖЕ импортирует этот слайс):

```tsx
const navigate = useNavigate()
const tabsApi = useMemo(
  () => ({
    // Стабильные колбэки: SduiScreen подписан на них эффектами,
    // пересоздание на каждый рендер вызвало бы лишние срабатывания.
    shouldPersistSession: (route: string) =>
      useWorkspaceTabsStore.getState().tabs.some((tab) => tab.id === route),
    onDirtyChange: (route: string, dirty: boolean) =>
      useFormCacheStore.getState().setDirty(route, dirty),
    consumePendingAction: (route: string) =>
      useFormCacheStore.getState().consumePendingAction(route),
    onSavedAndClosed: (route: string) => {
      useFormCacheStore.getState().removeTab(route)
      useWorkspaceTabsStore.getState().closeTab(route)
      const { tabs } = useWorkspaceTabsStore.getState()
      if (tabs.length > 0) {
        const next = tabs[0]
        void navigate(next.path + next.search)
      } else {
        void navigate('/')
      }
    },
  }),
  [navigate],
)
```

`onTitleChange` — через существующий `useTabMeta`: в sdui-document-page держать `const [tabTitle, setTabTitle] = useState('')`, вызвать `useTabMeta(tabTitle)`, передать `onTitleChange: setTabTitle` (добавить в объект выше; setState стабилен). Затем:

```tsx
<SduiScreen layoutCode={...} {...tabsApi} onTitleChange={setTabTitle} />
```

Если `SduiScreen` рендерится ещё где-то (проверить: `grep -r "SduiScreen" src/ --include="*.tsx"`) — там пропсы опциональны, поведение прежнее без вкладочной логики.

- [ ] **Step 3: Проверка**

Run: `npm run test` → PASS.
Вручную: открыть SDUI-документ во вкладке, уйти на другую вкладку и вернуться (состояние восстановилось), закрыть вкладку с несохранёнными изменениями через «сохранить и закрыть».

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/ui/sdui-screen.tsx src/pages/documents/documents-entry/ui/sdui-document-page.tsx
git commit -m "refactor: B2 развязать SduiScreen от workspace-tabs через пропсы-колбэки"
```

---

### Task 7: M6 — дедупликация field-нод через useFieldNode + фикс datetime disabled

**Проблема:** 8 field-нод (`text-field-node`, `text-area-node`, `number-field-node`, `date-field-node`, `datetime-field-node`, `checkbox-field-node`, `enum-field-node`, `reference-field-node`) дублируют один и тот же блок: ~10 строк извлечения props через `as`-касты + `fireServerEvent`. В `datetime-field-node` при этом потерян `disabled={!enabled}`.

**Files:**
- Create: `src/features/sdui/lib/hooks/use-field-node.ts`
- Modify: все 8 файлов в `src/features/sdui/ui/nodes/fields/`
- Test: `src/features/sdui/lib/hooks/use-field-node.test.tsx` (create)

**Interfaces:**
- Produces:

```ts
export interface FieldNodeCommon {
  label?: string
  required?: boolean
  readonly?: boolean
  visible: boolean   // default true
  enabled: boolean   // default true
  error?: string
  flex?: number | string
  value: unknown
  setValue: (v: unknown) => void
  fireServerEvent: (trigger: string, newValue: unknown) => void
}
export function useFieldNode(node: ViewNode): FieldNodeCommon
```

- [ ] **Step 1: Падающий тест**

`src/features/sdui/lib/hooks/use-field-node.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useFieldNode } from './use-field-node'

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../dispatch', () => ({ useSduiDispatch: () => mockDispatch }))

const state: Record<string, unknown> = { name: 'Иван' }
vi.mock('../sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
}))

describe('useFieldNode', () => {
  it('извлекает props с дефолтами и значение по binding', () => {
    const node = {
      id: 'f1',
      type: 'TEXT_FIELD',
      binding: 'name',
      props: { label: 'Имя', required: true },
    } as ViewNode
    const { result } = renderHook(() => useFieldNode(node))
    expect(result.current.label).toBe('Имя')
    expect(result.current.required).toBe(true)
    expect(result.current.visible).toBe(true)
    expect(result.current.enabled).toBe(true)
    expect(result.current.value).toBe('Иван')
  })

  it('fireServerEvent диспатчит только при подходящем action', () => {
    const node = {
      id: 'f1',
      type: 'TEXT_FIELD',
      binding: 'name',
      actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
    } as ViewNode
    const { result } = renderHook(() => useFieldNode(node))
    result.current.fireServerEvent('change', 'x')
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'EVENT',
      sourceNodeId: 'f1',
      trigger: 'change',
      value: 'x',
    })
    mockDispatch.mockClear()
    result.current.fireServerEvent('blur', 'x')
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустить — FAIL** (`npm run test -- use-field-node`)

- [ ] **Step 3: Реализовать хук**

`src/features/sdui/lib/hooks/use-field-node.ts`:

```ts
import type { ViewNode } from '../../types/view'
import { useSduiDispatch } from '../dispatch'
import { useSduiSession } from '../sdui-session-context'

export interface FieldNodeCommon {
  label?: string
  required?: boolean
  readonly?: boolean
  visible: boolean
  enabled: boolean
  error?: string
  flex?: number | string
  value: unknown
  setValue: (v: unknown) => void
  fireServerEvent: (trigger: string, newValue: unknown) => void
}

export function useFieldNode(node: ViewNode): FieldNodeCommon {
  const { getValue, setValue } = useSduiSession()
  const dispatch = useSduiDispatch()

  return {
    label: node.props?.label as string | undefined,
    required: node.props?.required as boolean | undefined,
    readonly: node.props?.readonly as boolean | undefined,
    visible: (node.props?.visible as boolean | undefined) ?? true,
    enabled: (node.props?.enabled as boolean | undefined) ?? true,
    error: node.props?.error as string | undefined,
    flex: node.props?.flex as number | string | undefined,
    value: getValue(node.binding),
    setValue: (v) => {
      if (node.binding) setValue(node.binding, v)
    },
    fireServerEvent: (trigger, newValue) => {
      if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
        void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
      }
    },
  }
}
```

- [ ] **Step 4: Перевести 8 field-нод на хук**

Образец на `text-field-node.tsx` (полное новое содержимое):

```tsx
import type { FC } from 'react'
import { TextField } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'

export const TextFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const placeholder = node.props?.placeholder as string | undefined
  const maxLength = node.props?.maxLength as number | undefined
  const value = (f.value as string | undefined) ?? ''

  if (!f.visible) return null

  return (
    <TextField
      label={f.label}
      value={value}
      placeholder={placeholder}
      required={f.required}
      error={!!f.error}
      helperText={f.error}
      disabled={!f.enabled}
      onChange={(e) => f.setValue(e.target.value)}
      onBlur={() => f.fireServerEvent('change', value)}
      sx={{ flex: f.flex !== undefined ? f.flex : undefined }}
      slotProps={{
        input: { readOnly: f.readonly },
        htmlInput: maxLength !== undefined ? { maxLength } : undefined,
      }}
    />
  )
}
```

Остальные 7 файлов — та же механика: общий блок `node.props?.X as Y` + `getValue`/`setValue`/`fireServerEvent` заменяется на `useFieldNode`; специфичные props (placeholder, maxLength, format, options, domain и т.п.) остаются локальным извлечением. Поведение НЕ менять (какие триггеры и когда стреляют — как было).

**Отдельно в `datetime-field-node.tsx`:** добавить недостающий `disabled={!f.enabled}` на инпут (единственное поведенческое изменение задачи).

В `reference-field-node.tsx` заменить только общий блок (label/required/readonly/visible/enabled/error/flex + fireServerEvent + get/setValue) — остальную логику (options, gateway из Task 5) не трогать. Важно: `useFieldNode` вызывать ДО `if (!visible) return null` (правила хуков уже соблюдаются, т.к. `useState`/`useEffect` стоят выше).

- [ ] **Step 5: Тесты + ручная проверка**

Run: `npm run test` → PASS.
Вручную: SDUI-форма — ввод в text/number/date поля, чекбокс, enum-селект, реф-поле; ошибки валидации отображаются.

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/lib/hooks/use-field-node.ts src/features/sdui/lib/hooks/use-field-node.test.tsx src/features/sdui/ui/nodes/fields/
git commit -m "refactor: M6 общий useFieldNode для field-нод, фикс disabled у datetime"
```

---

### Task 8: M1+M2 — точечная реактивность (useBindingValue) и актуальная сессия (getSession)

**Проблема:** (M1) `sdui-screen.tsx` подписан на ВЕСЬ `s.state`; `sessionValue` в `useMemo` пересоздаётся при любом вводе символа → все ноды дерева ре-рендерятся. (M2) `formSessionId`/`revision` снимаются `getState()` в момент построения `sessionValue` → узлы могут отправить действие с устаревшей ревизией.

**Files:**
- Modify: `src/features/sdui/lib/sdui-session-context.tsx` (расширить контракт)
- Modify: `src/features/sdui/ui/sdui-screen.tsx`
- Modify: `src/features/sdui/ui/dialog-host.tsx` (PanelFormProvider — тот же контракт)
- Modify: `src/features/sdui/lib/dispatch.ts` (читать `getSession()`)
- Modify: `src/features/sdui/ui/node-renderer.tsx` (`memo`)
- Modify: все места, читающие `session.formSessionId`/`session.revision` (grep: `session.formSessionId`, `session.revision`)

**Interfaces:**
- Produces: в `SduiSessionValue`:

```ts
kind: 'root' | 'panel'
getSession: () => { formSessionId: string | null; revision: number | null }
// useBindingValue — точечная подписка на одно значение
export function useBindingValue(binding: string | undefined): unknown
```

Поля `formSessionId`/`revision` из интерфейса УДАЛЯЮТСЯ (все читатели переводятся на `getSession()`).

- [ ] **Step 1: Расширить SduiSessionValue**

В `sdui-session-context.tsx`: добавить `kind` и `getSession`, удалить `formSessionId`/`revision`. Добавить хук:

```ts
export function useBindingValue(binding: string | undefined): unknown {
  const session = useSduiSession()
  // Рут: точечная подписка на один ключ zustand-стора — нода ре-рендерится
  // только при изменении СВОЕГО значения, а не всего state (перф, M1).
  const rootValue = useViewStateStore((s) =>
    session.kind === 'root' && binding ? s.state[binding] : undefined,
  )
  if (session.kind === 'root') return rootValue
  // Панель: локальный useState в PanelFormProvider, читаем через getValue.
  return session.getValue(binding)
}
```

(zustand-хук вызывается безусловно — правила хуков соблюдены).

- [ ] **Step 2: sdui-screen.tsx — стабильный sessionValue**

1. Удалить `const viewStateValues = useViewStateStore((s) => s.state)`.
2. `sessionValue`:

```ts
const sessionValue = useMemo<SduiSessionValue>(
  // Стабильность контекста — суть фикса M1: пересоздание только при смене tree/dirty,
  // не при каждом вводе символа.
  () => ({
    kind: 'root',
    getSession: () => {
      const s = useTreeStore.getState()
      return { formSessionId: s.formSessionId, revision: s.revision }
    },
    getValue: (binding) =>
      binding ? useViewStateStore.getState().state[binding] : undefined,
    ...остальные поля как были (setValue, setFromServer, getAll, replaceAll, merge, isDirty: dirty, resetDirty, tree, setRoot, setSession, bumpRevision, applyTreePatches, clearAllErrors)...
  }),
  [tree, dirty],
)
```

3. Field-ноды переводить на `useBindingValue` не нужно массово — достаточно заменить в `use-field-node.ts` (Task 7): `value: getValue(node.binding)` → `value: useBindingValue(node.binding)` (вызов хука поднять в тело `useFieldNode`). Прочие читатели `getValue` (таблицы) получают актуальное значение через `getState()` — уже корректно.

- [ ] **Step 3: dialog-host.tsx — PanelFormProvider**

В `sessionValue` панели добавить:

```ts
kind: 'panel',
getSession: () => ({
  formSessionId: panel.session?.formSessionId ?? null,
  revision:
    getPanelStack().find((p) => p.panelId === panel.panelId)?.session?.revision ??
    panel.session?.revision ??
    null,
}),
```

(ревизия читается из АКТУАЛЬНОГО стека — фикс M2 для панелей) и удалить поля `formSessionId`/`revision`.

- [ ] **Step 4: dispatch.ts — читать getSession()**

В начале колбэка dispatch:

```ts
const { formSessionId, revision } = session.getSession()
```

вместо `session.formSessionId` / `session.revision`. `parentSessionId` в `openDialog` — тоже через `session.getSession().formSessionId`.

- [ ] **Step 5: memo для NodeRenderer**

`node-renderer.tsx`:

```tsx
import { memo } from 'react'
...
export const NodeRenderer = memo(({ node }: NodeProps) => {
  const Component = getComponent(node.type) ?? UnknownNode
  return <Component node={node} />
})
NodeRenderer.displayName = 'NodeRenderer'
```

Дерево иммутабельно (patch-applier возвращает новые узлы только по изменённым путям) — memo по ссылке `node` корректен.

- [ ] **Step 6: Обновить остальных читателей**

`grep -rn "session\.formSessionId\|session\.revision\|\.formSessionId ??" src/features/sdui` — перевести всех на `getSession()`. Обновить моки в тестах (`use-table-sync.test.tsx`, `use-field-node.test.tsx`): добавить `kind: 'root'` нельзя — моки подменяют весь модуль; в мок `useSduiSession` добавить `kind: 'panel'` (чтобы `useBindingValue` шёл через `getValue`) и `getSession: () => ({ formSessionId: null, revision: null })`. Для `useBindingValue` в моке `sdui-session-context` добавить экспорт:

```ts
useBindingValue: (b?: string) => (b ? state[b] : undefined),
```

- [ ] **Step 7: Тесты + ручная проверка**

Run: `npm run test` → PASS.
Вручную: ввод в поле SDUI-формы не лагает; React DevTools Profiler — при вводе ре-рендерится только затронутая нода.

- [ ] **Step 8: Commit**

```bash
git add src/features/sdui
git commit -m "refactor: M1/M2 точечная подписка useBindingValue и getSession вместо снапшота сессии"
```

---

### Task 9: M3+m1+m8 — panelStack в zustand-стор, вынос relay-логики, чистка алиасов

**Проблема:** (M3) `dispatch.ts:33-72` — модульные `let panelStack` + самодельные листенеры: состояние живёт вне React/zustand, не сбрасывается между экранами, сложно тестировать. (m1, часть) мёртвые алиасы `getDialogStack`/`subscribeDialogs`/`popDialog`. (m8) 40-строчный relay-в-родителя живёт в замыкании `closeDialog` внутри dispatch.

**Files:**
- Create: `src/features/sdui/lib/stores/panel-store.ts`
- Create: `src/features/sdui/lib/relay-selection.ts`
- Modify: `src/features/sdui/lib/dispatch.ts` (убрать panel-код, использовать стор)
- Modify: `src/features/sdui/ui/dialog-host.tsx`
- Modify: `src/features/sdui/ui/sdui-screen.tsx` (reset панелей при размонтировании)
- Test: `src/features/sdui/lib/stores/panel-store.test.ts` (create)

**Interfaces:**
- Produces:

```ts
interface PanelStore {
  panels: PanelEntry[]
  push: (p: PanelEntry) => void
  pop: () => void
  remove: (panelId: string) => void
  updateSession: (panelId: string, revision: number) => void
  findBySessionId: (sessionId: string) => PanelEntry | undefined
  reset: () => void
}
export const usePanelStore: UseBoundStore<StoreApi<PanelStore>>
```

Тип `PanelEntry` переезжает из `dispatch.ts` в `panel-store.ts`.

- [ ] **Step 1: Падающий тест**

`src/features/sdui/lib/stores/panel-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { usePanelStore, type PanelEntry } from './panel-store'

const entry = (id: string, sessionId?: string): PanelEntry => ({
  panelId: id,
  node: { id, type: 'PAGE' } as ViewNode,
  presentation: 'modal',
  viewState: {},
  session: sessionId
    ? { formSessionId: sessionId, revision: 1 }
    : undefined,
})

describe('panel-store', () => {
  beforeEach(() => usePanelStore.getState().reset())

  it('push/pop/remove управляют стеком', () => {
    const s = usePanelStore.getState()
    s.push(entry('a'))
    s.push(entry('b'))
    usePanelStore.getState().pop()
    expect(usePanelStore.getState().panels.map((p) => p.panelId)).toEqual(['a'])
    usePanelStore.getState().remove('a')
    expect(usePanelStore.getState().panels).toEqual([])
  })

  it('updateSession обновляет ревизию нужной панели', () => {
    usePanelStore.getState().push(entry('a', 'fs-1'))
    usePanelStore.getState().updateSession('a', 5)
    expect(usePanelStore.getState().findBySessionId('fs-1')?.session?.revision).toBe(5)
  })
})
```

- [ ] **Step 2: Запустить — FAIL** (`npm run test -- panel-store`)

- [ ] **Step 3: Реализовать стор**

`src/features/sdui/lib/stores/panel-store.ts`:

```ts
import { create } from 'zustand'

import type { ViewNode } from '../../types/view'

export interface PanelEntry {
  panelId: string
  node: ViewNode
  presentation: 'drawer' | 'modal' | 'page'
  session?: {
    formSessionId: string
    revision: number
    parentSessionId?: string
    targetNodeId?: string
  }
  viewState: Record<string, unknown>
}

interface PanelStore {
  panels: PanelEntry[]
  push: (p: PanelEntry) => void
  pop: () => void
  remove: (panelId: string) => void
  updateSession: (panelId: string, revision: number) => void
  findBySessionId: (sessionId: string) => PanelEntry | undefined
  reset: () => void
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  panels: [],
  push: (p) => set((s) => ({ panels: [...s.panels, p] })),
  pop: () => set((s) => ({ panels: s.panels.slice(0, -1) })),
  remove: (panelId) =>
    set((s) => ({ panels: s.panels.filter((p) => p.panelId !== panelId) })),
  updateSession: (panelId, revision) =>
    set((s) => ({
      panels: s.panels.map((p) =>
        p.panelId === panelId && p.session
          ? { ...p, session: { ...p.session, revision } }
          : p,
      ),
    })),
  findBySessionId: (sessionId) =>
    get().panels.find((p) => p.session?.formSessionId === sessionId),
  reset: () => set({ panels: [] }),
}))
```

- [ ] **Step 4: Переключить dispatch.ts и dialog-host.tsx**

`dispatch.ts`:
- Удалить строки 18–72 (panelStack, listeners, getPanelStack, subscribePanels, notifyPanelListeners, popPanel, updatePanelSession, findPanelBySessionId, алиасы getDialogStack/subscribeDialogs/popDialog, интерфейс PanelEntry).
- Импортировать `usePanelStore, type PanelEntry` из `./stores/panel-store`.
- `openDialog`: `panelStack = [...panelStack, entry]; notifyPanelListeners()` → `usePanelStore.getState().push(entry)`.
- `closeDialog`: filter+notify → `usePanelStore.getState().remove(effect.id)`; `findPanelBySessionId(...)` → `usePanelStore.getState().findBySessionId(...)`; `updatePanelSession(...)` → `usePanelStore.getState().updateSession(...)`.

`dialog-host.tsx`:
- `useSyncExternalStore(subscribePanels, getPanelStack)` → `const stack = usePanelStore((s) => s.panels)`.
- `popPanel` → `usePanelStore.getState().pop` (в onClose передавать `() => usePanelStore.getState().pop()`).
- `updatePanelSession(panel.panelId, rev)` → `usePanelStore.getState().updateSession(panel.panelId, rev)`.
- `getPanelStack().find(...)` (из Task 8 getSession) → `usePanelStore.getState().panels.find(...)`.
- Импорт `PanelEntry` — из `../lib/stores/panel-store`.

`grep -rn "getDialogStack\|subscribeDialogs\|popDialog\|from '../lib/dispatch'" src/` — обновить/удалить всех потребителей алиасов (по ревью они мёртвые — просто удалить).

- [ ] **Step 5: m8 — вынести relay-в-родителя из замыкания dispatch**

Создать `src/features/sdui/lib/relay-selection.ts` и перенести туда блок из `closeDialog` (`dispatch.ts:127-163` до правок — ветка `if (effect.applyToParentSessionId && ...)`):

```ts
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect } from '../types/view'
import { ViewConflictError, viewTransport } from '../api/view-transport'
import { applyValuePatches } from './patch-applier'
import { usePanelStore } from './stores/panel-store'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'

// Выбор в дочерней панели (реф-пикер) ретранслируется в родительскую сессию
// командой ref.select. Родитель — либо панель в стеке, либо корневая форма.
export function relaySelectionToParent(
  effect: ViewEffect,
  playEffects: (effects: ViewEffect[]) => void,
): void {
  if (!effect.applyToParentSessionId || !effect.applyToParentTargetNodeId || !effect.applyToParentValue) {
    return
  }
  const panels = usePanelStore.getState()
  const parentPanel = panels.findBySessionId(effect.applyToParentSessionId)
  const tree = useTreeStore.getState()
  const parentRevision = parentPanel?.session?.revision ?? tree.revision

  void viewTransport
    .post({
      formSessionId: effect.applyToParentSessionId,
      revision: parentRevision,
      action: {
        type: 'COMMAND',
        command: `ref.select:${effect.applyToParentTargetNodeId}`,
        value: effect.applyToParentValue,
      },
    })
    .then((res) => {
      if (parentPanel) {
        usePanelStore.getState().updateSession(parentPanel.panelId, res.revision)
      } else {
        const vs = useViewStateStore.getState()
        tree.bumpRevision(res.revision)
        tree.clearAllErrors()
        tree.applyPatches(res.patches ?? [])
        applyValuePatches(res.patches ?? [], vs.setFromServer)
        vs.merge(res.statePatch ?? {})
      }
      playEffects(res.effects ?? [])
    })
    .catch((error) => {
      if (error instanceof ViewConflictError && error.data.code === 'SESSION_NOT_FOUND') {
        showToast('warning', 'Форма устарела, выбор не применён')
      } else {
        showToast('error', error instanceof Error ? error.message : 'Ошибка')
      }
    })
}
```

(строки-тосты переносятся как есть — их заменит на i18n-ключи Task 14; `res.patches ?? []` заменит на `validatePatches` Task 10)

В `dispatch.ts` `closeDialog` сжимается до:

```ts
closeDialog: (effect) => {
  usePanelStore.getState().remove(effect.id)
  relaySelectionToParent(effect, (effects) => effectHandler.playAll(effects))
},
```

- [ ] **Step 6: Сброс панелей при размонтировании экрана**

В cleanup-эффекте `sdui-screen.tsx` (рядом с `reset()`) добавить:

```ts
usePanelStore.getState().reset()
```

- [ ] **Step 7: Тесты** — `npm run test` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/sdui
git commit -m "refactor: M3/m8 стек панелей в zustand-стор, relay-логика в отдельном модуле"
```

---

### Task 10: M8 — zod-валидация ответа /api/view и устойчивый patch-applier

**Проблема:** типы SDUI-схемы (`ViewPatch` со сплошными optional + `!`-касты в `patch-applier.ts`) означают: малформленный патч от бэка = runtime-краш (`patch.nodeId!` = undefined). Zod 4 уже в зависимостях, но не используется.

**Files:**
- Create: `src/features/sdui/lib/validation.ts`
- Modify: `src/features/sdui/lib/dispatch.ts` (фильтровать патчи перед применением)
- Modify: `src/features/sdui/lib/relay-selection.ts` (то же)
- Modify: `src/features/sdui/lib/patch-applier.ts` (default-ветка → console.warn)
- Test: `src/features/sdui/lib/validation.test.ts` (create)

**Interfaces:**
- Produces: `export function validatePatches(patches: unknown[] | undefined): ViewPatch[]` — возвращает только валидные патчи, по невалидным `console.warn('[sdui] malformed patch', issues)`.

- [ ] **Step 1: Падающий тест**

`src/features/sdui/lib/validation.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { validatePatches } from './validation'

describe('validatePatches', () => {
  it('пропускает валидные патчи всех op', () => {
    const patches = [
      { op: 'setProp', nodeId: 'a', key: 'label', value: 'X' },
      { op: 'setValue', binding: 'b', value: 1 },
      { op: 'removeNode', nodeId: 'a' },
      { op: 'replaceNode', nodeId: 'a', node: { id: 'a', type: 'PAGE' } },
      { op: 'insertNode', parentId: 'a', index: 0, node: { id: 'c', type: 'TEXT' } },
      { op: 'moveNode', nodeId: 'a', parentId: 'r', index: 1 },
      { op: 'setOptions', nodeId: 'a', options: [] },
    ]
    expect(validatePatches(patches)).toHaveLength(7)
  })

  it('отбрасывает малформленные патчи с warn, не бросая', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = validatePatches([
      { op: 'setProp' }, // нет nodeId/key
      { op: 'unknown-op' },
      { op: 'setValue', binding: 'b', value: 2 },
    ])
    expect(result).toEqual([{ op: 'setValue', binding: 'b', value: 2 }])
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})
```

- [ ] **Step 2: Запустить — FAIL** (`npm run test -- validation`)

- [ ] **Step 3: Реализовать validation.ts**

```ts
import { z } from 'zod'

import type { ViewNode, ViewPatch } from '../types/view'

const viewNodeSchema: z.ZodType<ViewNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    binding: z.string().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    actions: z.array(z.record(z.string(), z.unknown())).optional(),
    children: z.array(viewNodeSchema).optional(),
  }),
) as z.ZodType<ViewNode>

const viewPatchSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('setProp'), nodeId: z.string(), key: z.string(), value: z.unknown() }),
  z.object({ op: z.literal('setValue'), binding: z.string(), value: z.unknown() }),
  z.object({ op: z.literal('replaceNode'), nodeId: z.string(), node: viewNodeSchema }),
  z.object({ op: z.literal('insertNode'), parentId: z.string(), index: z.number(), node: viewNodeSchema }),
  z.object({ op: z.literal('removeNode'), nodeId: z.string() }),
  z.object({ op: z.literal('moveNode'), nodeId: z.string(), parentId: z.string(), index: z.number() }),
  z.object({ op: z.literal('setOptions'), nodeId: z.string(), options: z.array(z.unknown()) }),
])

export function validatePatches(patches: unknown[] | undefined): ViewPatch[] {
  if (!patches) return []
  const valid: ViewPatch[] = []
  for (const p of patches) {
    const res = viewPatchSchema.safeParse(p)
    if (res.success) {
      valid.push(p as ViewPatch)
    } else {
      console.warn('[sdui] malformed patch', p, res.error.issues)
    }
  }
  return valid
}
```

Примечание: сверить поля `ViewNode` в `src/features/sdui/types/view.ts` — если там есть доп. обязательные поля, отразить в схеме. `.loose()`/passthrough не нужен: `as ViewPatch` сохраняет исходный объект, схема только проверяет.

- [ ] **Step 4: Применить в dispatch.ts и relay-selection.ts**

Во ВСЕХ местах, где используются `res.patches ?? []` (OPEN-ветка и EVENT/COMMAND-ветка в `dispatch.ts`, relay в `relay-selection.ts`), заменить на:

```ts
const patches = validatePatches(res.patches)
applyTreePatches(patches)
applyValuePatches(patches, setFromServer)
```

- [ ] **Step 5: patch-applier.ts — default-ветка**

```ts
default:
  console.warn('[sdui] unknown patch op', patch)
  return root
```

`!`-касты внутри applyOne оставить — после validatePatches поля гарантированы (отметить комментарием над applyOne: `// Патчи проверены validatePatches — поля по op гарантированы`).

- [ ] **Step 6: Тесты** — `npm run test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/lib/validation.ts src/features/sdui/lib/validation.test.ts src/features/sdui/lib/dispatch.ts src/features/sdui/lib/relay-selection.ts src/features/sdui/lib/patch-applier.ts
git commit -m "add: M8 zod-валидация патчей /api/view с отбрасыванием малформленных"
```

---

### Task 11: M7 — единый контракт binding колонок таблиц

**Проблема:** `src/features/sdui/lib/utils/build-column-defs.ts` (`nodeToTableColumnDef`) берёт `node.binding ?? node.id`, а `extractEditableColumns` в `table-node.tsx` читает `c.props?.binding` — два разных контракта: колонка, у которой binding лежит в props, в одном пути работает, в другом молча ломается. Плюс `renderCellValue` продублирован в двух файлах.

**Files:**
- Modify: `src/features/sdui/lib/utils/build-column-defs.ts`
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx` (если дублирует построение колонок — переиспользовать)
- Test: `src/features/sdui/lib/utils/build-column-defs.test.ts` (create)

**Interfaces:**
- Produces: `nodeToTableColumnDef` с приоритетом `node.binding ?? props.binding ?? node.id`; `renderCellValue` — единственный экспорт из `build-column-defs.ts`.

- [ ] **Step 1: Падающий тест**

`src/features/sdui/lib/utils/build-column-defs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { nodeToTableColumnDef } from './build-column-defs'

describe('nodeToTableColumnDef', () => {
  it('приоритет binding: node.binding > props.binding > node.id', () => {
    expect(
      nodeToTableColumnDef({ id: 'c1', type: 'TABLE_COLUMN', binding: 'top' } as ViewNode).binding,
    ).toBe('top')
    expect(
      nodeToTableColumnDef({
        id: 'c1',
        type: 'TABLE_COLUMN',
        props: { binding: 'inProps' },
      } as ViewNode).binding,
    ).toBe('inProps')
    expect(
      nodeToTableColumnDef({ id: 'c1', type: 'TABLE_COLUMN' } as ViewNode).binding,
    ).toBe('c1')
  })
})
```

(если `nodeToTableColumnDef` сейчас не экспортируется — экспортировать).

- [ ] **Step 2: Запустить — FAIL** (case `props.binding` вернёт `c1`).

- [ ] **Step 3: Исправить nodeToTableColumnDef**

В `build-column-defs.ts`:

```ts
binding: node.binding ?? (node.props?.binding as string | undefined) ?? node.id,
```

- [ ] **Step 4: table-node.tsx — убрать собственный контракт**

`extractEditableColumns` перевести на `nodeToTableColumnDef` (или `extractAllLeafColumns`) из `build-column-defs.ts`, удалив локальное чтение `c.props?.binding`. Удалить локальную копию `renderCellValue`, импортировать из `../../../lib/utils/build-column-defs`.

- [ ] **Step 5: editable-table.tsx — переиспользование**

Проверить: если inline-построение колонок в `editable-table.tsx` дублирует извлечение binding — оно получает готовые `TableColumnDef[]` пропсом, менять не нужно; убедиться, что все места, СОЗДАЮЩИЕ `TableColumnDef`, проходят через `nodeToTableColumnDef` (grep: `cellWidget`).

- [ ] **Step 6: Тесты + проверка**

Run: `npm run test` → PASS. Вручную: SDUI-таблица с редактированием отображает и сохраняет значения по колонкам.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/lib/utils/build-column-defs.ts src/features/sdui/lib/utils/build-column-defs.test.ts src/features/sdui/ui/nodes/composite/table-node.tsx src/features/sdui/ui/nodes/composite/editable-table.tsx
git commit -m "fix: M7 единый контракт binding колонок, дедуп renderCellValue"
```

---

### Task 12: M9 — ложный dirty при клике по строке master-detail

**Проблема:** `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx` — `handleRowClick` пишет `setValue(node.binding + '.__selectedRowId', rowId)`, а `setValue` помечает форму dirty. Простой клик по строке (не редактирование) делает форму «несохранённой».

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`

- [ ] **Step 1: Заменить setValue на setFromServer**

В `handleRowClick`:

```ts
// было:
setValue(node.binding + '.__selectedRowId', rowId)
// стало (выделение строки — UI-состояние, не данные формы; dirty не трогаем):
setFromServer(node.binding + '.__selectedRowId', rowId)
```

`setFromServer` взять из `useSduiSession()` (уже в контракте). Проверить, нет ли других записей `__selectedRowId` через `setValue` (grep: `__selectedRowId`).

- [ ] **Step 2: Ручная проверка**

SDUI-форма с master-detail: клик по строке мастера НЕ добавляет `*` к заголовку вкладки и не включает диалог «несохранённые изменения».

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/complex-editable-table.tsx
git commit -m "fix: M9 выделение строки master-detail не помечает форму dirty"
```

---

### Task 13: M10 — запросы опций в api/, debounce и защита от гонок

**Проблема:** `reference-field-node.tsx:78-116` — inline `apiService.get` в UI-компоненте (нарушение «запросы в api/»), без debounce (запрос на каждый символ), без защиты от гонок (поздний ответ раннего запроса перетирает свежий), `catch {}` молча. Аналогичный inline-fetch в `list-node.tsx`.

**Files:**
- Create: `src/features/sdui/api/reference-options.ts`
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx`

**Interfaces:**
- Produces:

```ts
export function fetchReferenceOptions(args: {
  url: string
  params?: Record<string, unknown>
  search?: string
}): Promise<SelectOption[]>
```

- [ ] **Step 1: Создать api/reference-options.ts**

```ts
import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'

interface EntryItem {
  id: number
  presentation?: string
  name?: string
  [key: string]: unknown
}

interface EntriesResponse {
  content?: EntryItem[]
  items?: EntryItem[]
}

export async function fetchReferenceOptions(args: {
  url: string
  params?: Record<string, unknown>
  search?: string
}): Promise<SelectOption[]> {
  const res = await apiService.get<EntriesResponse>({
    url: args.url,
    params: { ...args.params, search: args.search, page: 0, size: 20 },
  })
  const items = res.data.content ?? res.data.items ?? []
  return items.map((item) => ({
    id: item.id,
    code: String(item.id),
    label: item.presentation ?? item.name ?? String(item.id),
  }))
}
```

- [ ] **Step 2: reference-field-node — debounce + анти-гонка**

Заменить `fetchOptions` (строки 78–116):

```ts
const requestSeqRef = useRef(0)
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const loadOptions = (search?: string) => {
  const url = optionsSource
    ? optionsSource.url
    : targetTypeCode
      ? `/api/${domainPath}/${targetTypeCode}/entries`
      : null
  if (!url) return
  const params = optionsSource ? optionsSource.params : filter
  const seq = ++requestSeqRef.current
  setLoading(true)
  fetchReferenceOptions({ url, params, search })
    .then((opts) => {
      if (seq !== requestSeqRef.current) return // поздний ответ раннего запроса — игнор
      setOptions(opts)
    })
    .catch(() => {
      if (seq === requestSeqRef.current) setOptions([])
    })
    .finally(() => {
      if (seq === requestSeqRef.current) setLoading(false)
    })
}

const loadOptionsDebounced = (search: string) => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => loadOptions(search), 300)
}
```

В `onInputChange` при `reason === 'input'` вызывать `loadOptionsDebounced(val)`; в `onOpen` — `loadOptions()` без debounce. Удалить старый `fetchOptions` и прямой импорт `apiService`. Хуки (`useRef`) объявить ДО `if (!visible) return null` — рядом с существующими `useState`.

- [ ] **Step 3: list-node — вынести fetch в api/**

Прочитать `src/features/sdui/ui/nodes/composite/list-node.tsx`: его inline-запрос (queryFn с `apiService`) вынести функцией в `src/features/sdui/api/reference-options.ts` (или отдельный `api/list-data.ts`, если сигнатура ответа другая), сохранив URL/params/маппинг байт-в-байт. В компоненте оставить `useQuery({ queryKey: [...], queryFn: () => fetchХ(...) })`.

- [ ] **Step 4: Проверка**

Run: `npm run test` → PASS. Вручную: реф-поле — быстрый набор текста шлёт один запрос после паузы; результаты соответствуют последнему вводу.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/api/reference-options.ts src/features/sdui/ui/nodes/fields/reference-field-node.tsx src/features/sdui/ui/nodes/composite/list-node.tsx
git commit -m "refactor: M10 запросы опций в api/ с debounce и защитой от гонок"
```

---

### Task 14: M11 — i18n всех захардкоженных строк SDUI

**Проблема:** русские строки захардкожены в JSX/логике вместо ключей `common.json`.

**Files:**
- Modify: `src/features/sdui/lib/relay-selection.ts`
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/editable-table.tsx`
- Modify: `src/app/config/i18n/locales/ru/common.json`, `src/app/config/i18n/locales/kz/common.json`

- [ ] **Step 1: Инвентаризация**

Run: `grep -rn "[А-Яа-яЁё]" src/features/sdui --include="*.ts" --include="*.tsx" | grep -v "^\S*:.*//" | grep -v test`
Ожидаемые попадания: `relay-selection.ts` («Форма устарела, выбор не применён», «Ошибка»), `table-node.tsx` («Добавить», «Нет данных»), `editable-table.tsx` (заголовок «N»). Комментарии на русском — НЕ трогать.

- [ ] **Step 2: Ключи**

В `ru/common.json`:
- в `sdui`: `"refSelectStale": "Форма устарела, выбор не применён"`, `"error": "Ошибка"`;
- в `table` УЖЕ есть `add`/`empty` — использовать их; добавить `"rowNumber": "N"`.

В `kz/common.json` — те же ключи (перевод по аналогии с соседними).

- [ ] **Step 3: Замены**

- `relay-selection.ts` (не-React контекст, строки переехали туда в Task 9): `import i18n from 'i18next'` → `i18n.t('sdui.refSelectStale')`, `i18n.t('sdui.error')`.
- `table-node.tsx` (React): `const { t } = useTranslation()` → `t('table.add')`, `t('table.empty')`.
- `editable-table.tsx`: заголовок `N` → `{t('table.rowNumber')}` (useTranslation уже импортирован).

- [ ] **Step 4: Проверка**

Повторить grep из Step 1 — русских строковых ЛИТЕРАЛОВ в коде (кроме комментариев и common.json) не осталось. `npm run test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui src/app/config/i18n/locales
git commit -m "fix: M11 i18n-ключи вместо захардкоженных строк в SDUI"
```

---

### Task 15: m1 — мёртвый код (остаток после Task 9)

**Files:**
- Modify: `src/features/sdui/lib/stores/view-state-store.ts`
- Modify: `src/features/sdui/lib/hooks/use-table-sync.ts`

- [ ] **Step 1: Удалить неиспользуемые экспорты view-state-store**

Run: `grep -rn "useViewState\b\|useViewStateSetter" src/ --include="*.ts*"`
Если единственные попадания — определения в `view-state-store.ts`, удалить `useViewState` и `useViewStateSetter`.

- [ ] **Step 2: flushPending из публичного результата**

Run: `grep -rn "\.flushPending" src/ --include="*.ts*"`
Если снаружи хука никто не вызывает `sync.flushPending` (flush идёт через `pending-table-commits`) — убрать `flushPending` из `UseTableSyncResult` и из возвращаемого объекта (сама функция остаётся, она регистрируется в registry).

- [ ] **Step 3: Тесты** — `npm run test` → PASS (тест Task 2 использует `flushPending` через `result.current` — если убрали из результата, переписать тест через `flushAllPendingTableCommits`).

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui
git commit -m "refactor: удалить мёртвые экспорты SDUI-сторов"
```

---

### Task 16: m2 — icon-node: явная карта иконок

**Проблема:** `src/features/sdui/ui/nodes/display/icon-node.tsx` резолвит MUI-иконку динамически по имени — нетипизировано и тянет лишнее в бандл.

**Files:**
- Modify: `src/features/sdui/ui/nodes/display/icon-node.tsx`

- [ ] **Step 1: Явный ICON_MAP**

Прочитать текущий `icon-node.tsx`, выписать все имена иконок, реально приходящие от бэка (grep по докам: `grep -rn "icon" docs/superpowers/specs --include="*.md" -i | grep -i "name\|значен"` + имена, уже упомянутые в самом файле/дефолтах). Заменить динамический резолв на:

```tsx
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
// ...остальные РЕАЛЬНО используемые имена

const ICON_MAP: Record<string, typeof AddIcon> = {
  Add: AddIcon,
  Close: CloseIcon,
  // ...
}

const Icon = ICON_MAP[name]
if (!Icon) return null // неизвестное имя — молча ничего (как UnknownNode-паттерн)
```

Сохранить текущие props (size/color и т.п.) как есть.

- [ ] **Step 2: Ручная проверка** — иконки на SDUI-экранах (тулбары, сайдбар) отображаются.

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/ui/nodes/display/icon-node.tsx
git commit -m "refactor: явная карта иконок в icon-node вместо динамического резолва"
```

---

### Task 17: m3–m7 — пакет MINOR-фиксов

**Files:**
- Modify: `src/features/sdui/ui/nodes/layout/tabs-node.tsx`
- Modify: `src/features/sdui/ui/nodes/display/label-node.tsx`
- Modify: `src/features/sdui/lib/pending-table-commits.ts` + `src/features/sdui/lib/hooks/use-table-sync.ts`
- Modify: `src/features/sdui/ui/dialog-host.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`
- Modify: `src/features/sdui/api/view-transport.ts`

- [ ] **Step 1: m3 — плавающие промисы**

`tabs-node.tsx:~26` и `label-node.tsx:~35` — вызовы `dispatch(...)` без обработки: добавить `void` перед вызовом (grep в этих файлах: `dispatch({`).

- [ ] **Step 2: m4 — pending-table-commits: уникальные ключи регистрации**

Регистрация по `binding` коллизится, если две таблицы (рут + панель) имеют одинаковый binding. Перевести на токены — полное новое содержимое `pending-table-commits.ts`:

```ts
const registry = new Map<symbol, () => Promise<void>>()

export function registerPendingFlush(flush: () => Promise<void>): symbol {
  const token = Symbol('pending-flush')
  registry.set(token, flush)
  return token
}

export function unregisterPendingFlush(token: symbol): void {
  registry.delete(token)
}

export async function flushAllPendingTableCommits(): Promise<void> {
  const flushes = [...registry.values()]
  await Promise.all(flushes.map((fn) => fn()))
}
```

В `use-table-sync.ts` эффект регистрации:

```ts
useEffect(() => {
  if (!node.binding) return
  const token = registerPendingFlush(() => flushPendingRef.current())
  return () => unregisterPendingFlush(token)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [node.binding])
```

Обновить тест `pending-table-commits.test.ts` (afterEach: сохранённый token).

- [ ] **Step 3: m5 (часть) — dialog-host: Typography и цвета в константы**

`dialog-host.tsx:108-110`: `<span className="text-lg font-semibold">…</span>` →

```tsx
<Typography variant="h6" sx={{ fontWeight: 600 }}>
  {String(panel.node.props.title)}
</Typography>
```

(импорт `Typography` из `@mui/material`). Хардкоды `'#F2F6FD'` (2 места) и `'rgba(34, 33, 36, 0.6)'` вынести в модульные константы вверху файла:

```ts
const PANEL_BG = '#F2F6FD'
const BACKDROP_BG = 'rgba(34, 33, 36, 0.6)'
```

(Реактивность replaceNode для панелей — вне скоупа, см. ниже.)

- [ ] **Step 4: m6 — complex-editable-table: убрать бесполезные useMemo**

`footerValues`/`hasFooter` из `useMemo` развернуть в обычные выражения (правило проекта: useMemo только с явной перф-причиной; здесь её нет — дешёвые вычисления). Часть m6 про `useCallback` в dispatch с нестабильным `session` решена в Task 8 (deps сессии стали стабильными) — только проверить, что deps актуальны.

- [ ] **Step 5: m7 — view-transport: таймаут и типизация сообщения**

В axios-инстансе добавить `timeout: 30000`. Двойной каст сообщения ошибки заменить на типобезопасное извлечение:

```ts
function extractMessage(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
    return data.message
  }
  return undefined
}
```

и использовать в месте(ах) построения ошибки. `closeBeacon` с пустым телом POST — код не менять, зафиксировать вопрос бэку (в существующей переписке по SDUI в docs/superpowers).

- [ ] **Step 6: Тесты** — `npm run test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui
git commit -m "fix: пакет minor-правок SDUI (void-промисы, токены flush, Typography, таймаут транспорта)"
```

---

### Task 18: B5 — инвалидация кэша списков после работы в SDUI-форме

**Проблема:** SDUI сохраняет документ мимо TanStack Query; легаси-список документов (queryKey `['document-entries', ...]`) остаётся со стейл-данными — пользователь не видит созданный/изменённый документ.

**Files:**
- Modify: `src/pages/documents/documents-entry/ui/sdui-document-page.tsx`

- [ ] **Step 1: Инвалидация при размонтировании SDUI-страницы**

В `sdui-document-page.tsx`:

```tsx
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()
useEffect(() => {
  return () => {
    // SDUI пишет мимо TanStack Query — при уходе со страницы сбрасываем
    // кэш легаси-списков, чтобы список документов показал свежие данные (B5).
    void queryClient.invalidateQueries({ queryKey: ['document-entries'] })
  }
}, [queryClient])
```

Сверить точный queryKey легаси-списка: `grep -rn "document-entries" src/pages src/features --include="*.ts*" | grep -i querykey` — использовать общий префикс.

- [ ] **Step 2: Ручная проверка** — создать документ в SDUI-форме, закрыть вкладку, открыть легаси-список: документ виден без ручного обновления.

- [ ] **Step 3: Commit**

```bash
git add src/pages/documents/documents-entry/ui/sdui-document-page.tsx
git commit -m "fix: B5 инвалидация document-entries после работы в SDUI-форме"
```

---

## Вне скоупа (осознанно не делаем)

- **m9** — `table-cell-editor.tsx`: 50 строк `!important`-хаков поверх MUI и `'✓'` для readonly BOOLEAN — работает; правильное решение (табличные варианты shared-инпутов) — отдельная задача после стабилизации таблиц.
- **m5 (часть)** — реактивность replaceNode в dialog-host: панель держит копию узла в useState; синхронизация с обновлением узла на уровне стека — отдельная фича, сейчас сценария нет.
- **B4** — `useDocumentType` на критическом пути SDUI: неустранимо, пока роутинг решает по `newView` из метаданных типа документа. Зафиксировано в отчёте ревью.
- **B6** — общие утилиты shared-слайса: и легаси, и SDUI легально зависят от `shared/` — это норма FSD.
- **M4** (цикл node-renderer → registry → app-shell-node → node-renderer) — разрывается лениво через `getComponent`, работает; правка реестра затронет все ноды, отложено до стабилизации схемы бэка.

## Финальная верификация (после Task 18)

- [ ] `npm run test` — все тесты зелёные.
- [ ] `grep -rn "@/features/dict-sidebar\|@/features/workspace-tabs" src/features/sdui` — пусто (граница чистая).
- [ ] Ручной прогон: легаси-форма документа (открытие, правка, сохранение) — поведение не изменилось; SDUI-форма — открытие, ввод, таблица, реф-поле, панель, сохранение, закрытие вкладки.
- [ ] Отметить в отчёте `2026-07-02-sdui-code-review.md` статус находок (исправлено / вне скоупа).





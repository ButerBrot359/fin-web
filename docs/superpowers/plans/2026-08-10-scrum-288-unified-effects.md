# SCRUM-288 «Унификация Effect'ов» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** привести панель связанных документов, подтверждения, признак «грязно» и печать/экспорт отчёта к единому механизму эффектов — фронт исполняет `effects[]`, не зная бизнес-процесса за ними.

**Architecture:** новый минимальный исполнитель `lib/action-request.ts` делает GET/POST по готовому `ActionRequest` и проигрывает `res.effects` через `effect-handler`, **не касаясь** `tree-store`/`view-state-store`/ревизии (панель session-less). Общие зависимости эффект-хэндлера выносятся в `build-effect-deps.ts`; новый хук `useSduiEffects()` даёт `{ play, playAll, executeActionRequest }` для `button-node`/`report-result-node`; `useSduiDispatch` сохраняет сигнатуру (16 вызовов целы). Ветвление везде — **по наличию полей**, не по фронтовому флагу.

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, Vitest + Testing Library, MUI, i18next.

## Global Constraints

- Тексты — только через `useTranslation`/`i18n` и ключи `common.json`; не хардкодить строки в JSX. Тексты подтверждений на панели — **серверные** (не выбирать на клиенте).
- Изоляция SDUI/легаси: работаем только в `src/features/sdui/**` и `src/shared/**`; легаси не трогаем.
- Barrel-экспорты только на уровне слайса (`features/sdui/index.ts`); внутри сегмента импорт напрямую из файлов.
- Никаких `useMemo`/`useCallback` без явной причины производительности.
- Новый файл — цель ~200 строк, >300 обязателен к разбиению.
- НЕ запускать `tsc`/`lint`/`build` после каждого шага; тесты блока — `npx vitest run --dir src/features/sdui`. Перед пушем — `npm run build` (tsc -b строже).
- Имя query-параметра `selectedRowId` — из именованной константы, не литерал вразнос.
- Ответ `ActionRequest`/`confirmRequest` трактовать ТОЛЬКО как `effects[]`; `revision`/`patches`/`state`/`formSessionId` игнорировать безусловно.
- Одна ветка `feature/SCRUM-288-unified-effects`, коммиты по блокам, PR не открывать.

**Формат сообщения коммита (husky commit-msg):** `feat|fix|add|refactor: описание`. Хвост каждого коммита:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NK5hEfedMVXXL8gkjnLgkt
```

## Карта файлов

**Создаются:**

- `src/features/sdui/lib/view-request-params.ts` — константа имени query-параметра.
- `src/features/sdui/lib/action-request.ts` — `createActionRequestExecutor(playEffects)`.
- `src/features/sdui/lib/action-request.test.ts`
- `src/features/sdui/lib/build-effect-deps.ts` — общий строитель зависимостей эффект-хэндлера (без `confirm`/`closeDialog`).
- `src/features/sdui/lib/use-sdui-effects.ts` — хук `{ play, playAll, executeActionRequest }` для нод.
- `src/features/sdui/lib/use-sdui-effects.test.ts`
- `src/features/sdui/lib/stores/selection-store.ts` — объединённый реестр выделения.
- `src/features/sdui/lib/stores/selection-store.test.ts`

**Модифицируются:**

- `src/features/sdui/types/view.ts` — `ActionRequest`; `ViewNodeAction.request`; `ViewEffect.request/confirmRequest/confirmBehavior`; `ViewResponse.dirty`.
- `src/features/sdui/lib/effect-handler.ts` — `confirm` принимает эффект; возврат `executeActionRequest`; ветка `download` с телом.
- `src/features/sdui/lib/effect-handler.test.ts`
- `src/features/sdui/lib/dispatch.ts` — общий строитель deps; confirm-мост (§2.3+§2.4); чтение `res.dirty` (§2.5).
- `src/features/sdui/lib/dispatch.test.ts`
- `src/features/sdui/lib/stores/view-state-store.ts` — `setDirty(value)`.
- `src/features/sdui/lib/stores/view-state-store.test.ts` (если есть; иначе создать)
- `src/features/sdui/lib/sdui-session-context.tsx` — прокинуть `setDirty`.
- `src/features/sdui/ui/nodes/action/button-node.tsx` — снять `handleRelatedCommand`, добавить путь `request`.
- `src/features/sdui/ui/nodes/action/button-node-related.test.tsx`
- `src/features/sdui/ui/nodes/composite/subordination-tree.tsx` — писать в объединённый стор по `selectionField`.
- `src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`
- `src/features/sdui/ui/nodes/composite/list-node.tsx` — импорт объединённого стора.
- `src/features/sdui/ui/nodes/composite/report-result-node.tsx` — `printEffect`/`exportEffect`.
- `src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`

**Удаляются:**

- `src/features/sdui/lib/open-related-docs.ts` (+`.test.ts`)
- `src/features/sdui/api/related-docs-api.ts` (+`.test.ts`)
- `src/features/sdui/lib/stores/ref-picker-selection-store.ts`
- `src/features/sdui/lib/stores/related-docs-store.ts` (+`.test.ts`)

---

# КОММИТ A — Рантайм + confirm-мост + панель связей (§2.1, §2.2, §2.3, §2.4)

## Task 1: Контракт — типы и константа

**Files:**

- Modify: `src/features/sdui/types/view.ts`
- Create: `src/features/sdui/lib/view-request-params.ts`

**Interfaces:**

- Produces: `interface ActionRequest { method?: string; url: string; body?: Record<string, unknown> | null }`; `ViewNodeAction.request?: ActionRequest | null`; `ViewEffect.request?/confirmRequest?/confirmBehavior?`; `ViewResponse.dirty?: boolean | null`; `export const SELECTED_ROW_ID = 'selectedRowId'`.

- [ ] **Step 1: Добавить типы в `types/view.ts`**

После `ActionBehavior` добавить:

```ts
// SCRUM-288: готовый запрос действия. url — БЕЗ плейсхолдеров (гарантия сервера,
// бэк-тест ActionRequestUrlIsReadyTest). method пусто ⇒ GET.
export interface ActionRequest {
  method?: string
  url: string
  body?: Record<string, unknown> | null
}
```

В `ViewNodeAction` добавить поле:

```ts
  // SCRUM-288 §2.1: если задан — фронт НЕ диспатчит command, а исполняет ЭТОТ запрос.
  request?: ActionRequest | null
```

В `ViewEffect` добавить (рядом с `confirmCommand`):

```ts
  // SCRUM-288 §3.1: download с телом — ровно одно из url/request заполнено.
  request?: ActionRequest | null
  // SCRUM-288 §2.3: session-less подтверждение (панель) — исполнить запрос по «Да».
  // Ровно одно из confirmCommand/confirmRequest заполнено на эффекте confirm.
  confirmRequest?: ActionRequest | null
  // SCRUM-288 §2.4: behavior подтверждённой команды (resetsDirty и пр.).
  confirmBehavior?: ActionBehavior | null
```

В `ViewResponse` добавить:

```ts
  // SCRUM-288 §2.5: авторитетный признак несохранённого. true/false перекрывают
  // клиентский флаг; null/отсутствие — «решай сам». На OPEN не приходит.
  dirty?: boolean | null
```

- [ ] **Step 2: Создать `lib/view-request-params.ts`**

```ts
// SCRUM-288 §2.1: имя query-параметра id выделенной строки. Зеркало контрактной
// константы webbuh-contract ViewRequestParams.SELECTED_ROW_ID — не литерал вразнос.
export const SELECTED_ROW_ID = 'selectedRowId'
```

- [ ] **Step 3: Проверить компиляцию затронутого**

Run: `npx vitest run --dir src/features/sdui/lib` (существующие тесты должны остаться зелёными — типы аддитивны, опциональны)
Expected: PASS

- [ ] **Step 4: Commit** — вместе с Task 2 (коммит A целиком в конце Task 9). Пока `git add -A` не делаем.

---

## Task 2: Исполнитель запроса действия `action-request.ts`

**Files:**

- Create: `src/features/sdui/lib/action-request.ts`
- Test: `src/features/sdui/lib/action-request.test.ts`

**Interfaces:**

- Consumes: `ActionRequest`, `ViewEffect` (Task 1); `SELECTED_ROW_ID` (Task 1); `apiService` из `@/shared/api/api`.
- Produces: `createActionRequestExecutor(playEffects: (effects: ViewEffect[]) => void) => (request: ActionRequest, selectedRowId?: string | number) => Promise<void>`.

- [ ] **Step 1: Написать падающий тест `action-request.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiService } from '@/shared/api/api'

import { createActionRequestExecutor } from './action-request'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn(), post: vi.fn() },
}))
const mockGet = vi.mocked(apiService.get)
const mockPost = vi.mocked(apiService.post)

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: { effects: [] } } as never)
  mockPost.mockResolvedValue({ data: { effects: [] } } as never)
})

describe('executeActionRequest', () => {
  it('POST c selectedRowId — дописывает РОВНО один параметр и играет effects', async () => {
    const play = vi.fn()
    mockPost.mockResolvedValue({
      data: { effects: [{ type: 'notify', message: 'ok' }] },
    } as never)
    await createActionRequestExecutor(play)(
      {
        method: 'POST',
        url: '/api/view/related-documents/post?rootId=1&anchorId=2',
        body: null,
      },
      '77'
    )
    expect(mockPost).toHaveBeenCalledWith({
      url: '/api/view/related-documents/post?rootId=1&anchorId=2&selectedRowId=77',
      data: undefined,
    })
    expect(play).toHaveBeenCalledWith([{ type: 'notify', message: 'ok' }])
  })

  it('GET без selectedRowId — url не трогается, method пуст ⇒ get', async () => {
    const play = vi.fn()
    await createActionRequestExecutor(play)(
      { url: '/api/view/related-documents/5?anchorId=2' },
      undefined
    )
    expect(mockGet).toHaveBeenCalledWith({
      url: '/api/view/related-documents/5?anchorId=2',
    })
    expect(mockPost).not.toHaveBeenCalled()
    expect(play).toHaveBeenCalledWith([])
  })

  it('body уходит как data при POST', async () => {
    const play = vi.fn()
    await createActionRequestExecutor(play)(
      { method: 'POST', url: '/api/x?y=1', body: { a: 1 } },
      undefined
    )
    expect(mockPost).toHaveBeenCalledWith({ url: '/api/x?y=1', data: { a: 1 } })
  })

  it('effects отсутствуют — играет пустой массив', async () => {
    const play = vi.fn()
    mockGet.mockResolvedValue({ data: {} } as never)
    await createActionRequestExecutor(play)({ url: '/api/x?y=1' }, undefined)
    expect(play).toHaveBeenCalledWith([])
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/features/sdui/lib/action-request.test.ts`
Expected: FAIL — модуль `./action-request` не найден.

- [ ] **Step 3: Реализовать `action-request.ts`**

```ts
import { apiService } from '@/shared/api/api'

import type { ActionRequest, ViewEffect } from '../types/view'
import { SELECTED_ROW_ID } from './view-request-params'

interface ActionRequestResponse {
  effects?: ViewEffect[]
}

// SCRUM-288 §2.1: минимальный исполнитель. GET/POST по готовому адресу, ответ —
// ТОЛЬКО носитель effects[]; сессию/дерево/ревизию не трогает (панель session-less).
export function createActionRequestExecutor(
  playEffects: (effects: ViewEffect[]) => void
) {
  return async function executeActionRequest(
    request: ActionRequest,
    selectedRowId?: string | number
  ): Promise<void> {
    let url = request.url
    // Единственная допустимая модификация адреса — один selectedRowId (§2.1).
    if (selectedRowId != null) {
      url += `${url.includes('?') ? '&' : '?'}${SELECTED_ROW_ID}=${selectedRowId}`
    }
    const res =
      request.method === 'POST'
        ? await apiService.post<ActionRequestResponse>({
            url,
            data: request.body ?? undefined,
          })
        : await apiService.get<ActionRequestResponse>({ url })
    playEffects(res.data.effects ?? [])
  }
}
```

- [ ] **Step 4: Запустить — зелёные**

Run: `npx vitest run src/features/sdui/lib/action-request.test.ts`
Expected: PASS (4 теста)

---

## Task 3: Расширить `effect-handler.ts` — confirm(effect) + executeActionRequest

**Files:**

- Modify: `src/features/sdui/lib/effect-handler.ts`
- Test: `src/features/sdui/lib/effect-handler.test.ts`

**Interfaces:**

- Consumes: `createActionRequestExecutor` (Task 2), `ViewEffect` (Task 1).
- Produces: `EffectHandlerDeps.confirm: (effect: ViewEffect) => void` (СИГНАТУРА ИЗМЕНЕНА); `createEffectHandler(deps)` возвращает `{ play, playAll, executeActionRequest }`, где `executeActionRequest(request, selectedRowId?)`.

- [ ] **Step 1: Обновить падающие тесты в `effect-handler.test.ts`**

Заменить блок `describe('effect confirm …')` — теперь мост получает ВЕСЬ эффект:

```ts
describe('effect confirm (SCRUM-244 v3 §1 / SCRUM-288 §2.3)', () => {
  it('прокидывает весь эффект в мост confirm', () => {
    const deps = makeDeps()
    const effect = {
      type: 'confirm' as const,
      message: 'Данные будут записаны.',
      confirmCommand: 'nav.saveAndOpen:X',
    }
    createEffectHandler(deps).play(effect)
    expect(deps.confirm).toHaveBeenCalledWith(effect)
  })

  it('playAll обрывается на первом confirm (§1.3)', () => {
    const deps = makeDeps()
    createEffectHandler(deps).playAll([
      { type: 'confirm', message: 'm', confirmCommand: 'c' },
      { type: 'notify', level: 'info', message: 'не должен показаться' },
      { type: 'refresh' },
    ])
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.invalidateLists).not.toHaveBeenCalled()
  })
})
```

Добавить в начало файла мок apiService и новый тест на `executeActionRequest`:

```ts
import { apiService } from '@/shared/api/api'
vi.mock('@/shared/api/api', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    getFileBlob: vi.fn(),
    postFileBlob: vi.fn(),
  },
}))

describe('executeActionRequest на хэндлере (SCRUM-288 §2.1)', () => {
  it('проигрывает эффекты ответа через playAll', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { effects: [{ type: 'refresh' }] },
    } as never)
    const deps = makeDeps()
    await createEffectHandler(deps).executeActionRequest({ url: '/api/x?a=1' })
    expect(deps.invalidateLists).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/lib/effect-handler.test.ts`
Expected: FAIL — `executeActionRequest` не существует / confirm вызывается со старой сигнатурой.

- [ ] **Step 3: Реализация в `effect-handler.ts`**

Импорт вверху:

```ts
import { createActionRequestExecutor } from './action-request'
```

Изменить тип `confirm` в `EffectHandlerDeps`:

```ts
  // SCRUM-288 §2.3/§2.4: мост получает ВЕСЬ эффект (confirmCommand ИЛИ confirmRequest,
  // + confirmBehavior). Диалог и ветвление — в реализации (dispatch / use-sdui-effects).
  confirm: (effect: ViewEffect) => void
```

В `case 'confirm'`:

```ts
      case 'confirm':
        deps.confirm(effect)
        break
```

В конце `createEffectHandler`, перед `return`:

```ts
const executeActionRequest = createActionRequestExecutor(playAll)
return { play, playAll, executeActionRequest }
```

- [ ] **Step 4: Запустить — зелёные**

Run: `npx vitest run src/features/sdui/lib/effect-handler.test.ts`
Expected: PASS

---

## Task 4: `build-effect-deps.ts` + confirm-мост в `dispatch.ts` (§2.3 + §2.4)

**Files:**

- Create: `src/features/sdui/lib/build-effect-deps.ts`
- Modify: `src/features/sdui/lib/dispatch.ts`
- Test: `src/features/sdui/lib/dispatch.test.ts`

**Interfaces:**

- Consumes: `EffectHandlerDeps` (Task 3), `SduiSessionValue`, `viewTransport`, `usePanelStore`, `openDialogAsPanel`, `armNewTab`.
- Produces: `buildCommonEffectDeps(ctx) => Omit<EffectHandlerDeps, 'confirm' | 'closeDialog'>` где `ctx: { navigate; session; queryClient; setSearchParams }`.

- [ ] **Step 1: Тесты confirm-моста в `dispatch.test.ts`**

Добавить в `sessionMock` (vi.hoisted) поле `setDirty: vi.fn()` (пригодится в Task 11; сейчас не мешает). Добавить блок:

```ts
describe('confirm-мост (SCRUM-288 §2.3/§2.4)', () => {
  it('confirmCommand: по «Да» диспатчит COMMAND с confirmBehavior', async () => {
    // подготовка: viewTransport.post отвечает эффектом confirm с confirmBehavior
    mockPost.mockResolvedValueOnce({
      formSessionId: 's',
      revision: 2,
      effects: [
        {
          type: 'confirm',
          message: 'm',
          confirmCommand: 'setDeletionMark:confirmed',
          confirmBehavior: { resetsDirty: true },
        },
      ],
    } as ViewResponse)
    // и второй ответ на подтверждённый COMMAND
    mockPost.mockResolvedValueOnce({
      formSessionId: 's',
      revision: 3,
    } as ViewResponse)

    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const p = result.current({ type: 'COMMAND', command: 'setDeletionMark' })
    // ответить «Да» в диалоге
    await Promise.resolve()
    useConfirmStore.getState().answer(true)
    await p

    // подтверждённый COMMAND ушёл (второй вызов post) — с revision из behavior-пути
    expect(mockPost).toHaveBeenCalledTimes(2)
    // resetsDirty=true из confirmBehavior привёл к resetDirty()
    expect(sessionMock.resetDirty).toHaveBeenCalled()
  })

  it('confirmRequest: по «Да» исполняет запрос, НЕ диспатчит COMMAND в сессию', async () => {
    mockPost.mockResolvedValueOnce({
      formSessionId: 's',
      revision: 2,
      effects: [
        {
          type: 'confirm',
          message: 'm',
          confirmRequest: {
            method: 'POST',
            url: '/api/view/related-documents/toggle-deletion-mark?rootId=1&anchorId=2&selectedRowId=7&confirmed=true',
          },
        },
      ],
    } as ViewResponse)
    // executeActionRequest пойдёт через apiService.post (замокан в файле)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    const p = result.current({ type: 'COMMAND', command: 'noop' })
    await Promise.resolve()
    useConfirmStore.getState().answer(true)
    await p
    // ровно один вызов viewTransport.post (исходный COMMAND); подтверждение ушло
    // мимо сессии — через apiService.post исполнителя
    expect(mockPost).toHaveBeenCalledTimes(1)
  })
})
```

> Примечание для исполнителя: точная форма `wrapper`/`mockPost` — как в существующем `dispatch.test.ts` (viewTransport замокан там же). Если `apiService` в файле ещё не замокан — добавить `vi.mock('@/shared/api/api', () => ({ apiService: { get: vi.fn(), post: vi.fn(), getFileBlob: vi.fn(), postFileBlob: vi.fn() } }))`.

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts`
Expected: FAIL — confirmBehavior не передаётся; confirmRequest не обрабатывается.

- [ ] **Step 3: Создать `build-effect-deps.ts`**

```ts
import type { NavigateFunction } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'

import { viewTransport } from '../api/view-transport'
import type { EffectHandlerDeps } from './effect-handler'
import { openDialogAsPanel } from './open-dialog-panel'
import type { SduiSessionValue } from './sdui-session-context'
import { armNewTab } from './workspace-tab-gateway'

export interface EffectDepsCtx {
  navigate: NavigateFunction
  session: SduiSessionValue
  queryClient: QueryClient
  setSearchParams: (search: string, opts?: { replace?: boolean }) => void
}

// SCRUM-288: общая часть зависимостей эффект-хэндлера (без confirm/closeDialog —
// они ссылаются на сам хэндлер и строятся на месте вызова). Используют dispatch и
// use-sdui-effects. closeSession/openDialog читают сессию ЛЕНИВО (в момент проигрывания).
export function buildCommonEffectDeps(
  ctx: EffectDepsCtx
): Omit<EffectHandlerDeps, 'confirm' | 'closeDialog'> {
  return {
    navigate: ctx.navigate,
    closeSession: async () => {
      const { formSessionId } = ctx.session.getSession()
      if (!formSessionId) return
      try {
        await viewTransport.post({ formSessionId, action: { type: 'CLOSE' } })
      } catch {
        // best-effort
      }
    },
    openDialog: (effect) => {
      openDialogAsPanel(
        effect,
        ctx.session.getSession().formSessionId ?? undefined
      )
    },
    invalidateLists: () => {
      void ctx.queryClient.invalidateQueries({ queryKey: ['sdui-list'] })
    },
    openRouteInNewTab: (route) => {
      // armNewTab взводится ДО navigate — см. dispatch (редирект между OPEN и целью)
      armNewTab()
      void ctx.navigate(route)
    },
    replaceUrl: (route) => {
      const i = route.indexOf('?')
      ctx.setSearchParams(i >= 0 ? route.slice(i + 1) : '', { replace: true })
    },
  }
}
```

- [ ] **Step 4: Переключить `dispatch.ts` на общий строитель + новый confirm-мост**

Импорты добавить:

```ts
import { buildCommonEffectDeps } from './build-effect-deps'
```

Заменить создание `effectHandler` внутри `dispatchAction` на:

```ts
const common = buildCommonEffectDeps({
  navigate,
  session,
  queryClient,
  setSearchParams,
})
const effectHandler = createEffectHandler({
  ...common,
  closeDialog: (effect) => {
    if (effect.id) usePanelStore.getState().remove(effect.id)
    relaySelectionToParent(effect, (effects) => {
      effectHandler.playAll(effects)
    })
  },
  confirm: (effect) => {
    // SCRUM-288 §2.3/§2.4: session-less подтверждение (панель) исполняет
    // confirmRequest; иначе — форм-сессионный COMMAND С confirmBehavior.
    void useConfirmStore
      .getState()
      .ask(effect.message ?? '')
      .then((ok) => {
        if (!ok) return
        if (effect.confirmRequest) {
          void effectHandler.executeActionRequest(effect.confirmRequest)
          return
        }
        void dispatchAction(
          { type: 'COMMAND', command: effect.confirmCommand ?? '' },
          effect.confirmBehavior
        )
      })
  },
})
```

Удалить старый инлайн `closeSession`/`openRouteInNewTab`/`openDialog`/`invalidateLists`/`replaceUrl` внутри `dispatchAction` (теперь из `common`). `setSearchParams` уже в зависимостях useCallback.

- [ ] **Step 5: Запустить — зелёные**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts src/features/sdui/lib/effect-handler.test.ts`
Expected: PASS (в т.ч. существующие navigate/replaceUrl/refresh-тесты — поведение сохранено).

---

## Task 5: Хук `use-sdui-effects.ts`

**Files:**

- Create: `src/features/sdui/lib/use-sdui-effects.ts`
- Test: `src/features/sdui/lib/use-sdui-effects.test.ts`

**Interfaces:**

- Consumes: `buildCommonEffectDeps` (Task 4), `createEffectHandler` (Task 3), `useConfirmStore`, `usePanelStore`, `relaySelectionToParent`, `useSduiSession`.
- Produces: `useSduiEffects(): { play; playAll; executeActionRequest }`.

- [ ] **Step 1: Тест `use-sdui-effects.test.ts`**

```ts
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiService } from '@/shared/api/api'

import { useSduiEffects } from './use-sdui-effects'

vi.mock('@/shared/api/api', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    getFileBlob: vi.fn(),
    postFileBlob: vi.fn(),
  },
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('./sdui-session-context', () => ({
  useSduiSession: () => ({
    getSession: () => ({ formSessionId: null, revision: null }),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiService.post).mockResolvedValue({
    data: { effects: [] },
  } as never)
})

describe('useSduiEffects', () => {
  it('возвращает play/playAll/executeActionRequest', () => {
    const { result } = renderHook(() => useSduiEffects())
    expect(typeof result.current.play).toBe('function')
    expect(typeof result.current.playAll).toBe('function')
    expect(typeof result.current.executeActionRequest).toBe('function')
  })

  it('executeActionRequest шлёт POST по request', async () => {
    const { result } = renderHook(() => useSduiEffects())
    await result.current.executeActionRequest(
      { method: 'POST', url: '/api/x?a=1' },
      '5'
    )
    expect(apiService.post).toHaveBeenCalledWith({
      url: '/api/x?a=1&selectedRowId=5',
      data: undefined,
    })
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/lib/use-sdui-effects.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация `use-sdui-effects.ts`**

```ts
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { buildCommonEffectDeps } from './build-effect-deps'
import { createEffectHandler } from './effect-handler'
import { relaySelectionToParent } from './relay-selection'
import { useSduiSession } from './sdui-session-context'
import { useConfirmStore } from './stores/confirm-store'
import { usePanelStore } from './stores/panel-store'

// SCRUM-288: эффект-рантайм для нод (button-node, report-result-node). В отличие
// от dispatch: confirm обслуживает ТОЛЬКО confirmRequest (панель session-less —
// диспатчить command в неё некуда).
export function useSduiEffects() {
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const session = useSduiSession()

  const common = buildCommonEffectDeps({
    navigate,
    session,
    queryClient,
    setSearchParams,
  })
  const handler = createEffectHandler({
    ...common,
    closeDialog: (effect) => {
      if (effect.id) usePanelStore.getState().remove(effect.id)
      relaySelectionToParent(effect, (effects) => {
        handler.playAll(effects)
      })
    },
    confirm: (effect) => {
      void useConfirmStore
        .getState()
        .ask(effect.message ?? '')
        .then((ok) => {
          if (ok && effect.confirmRequest) {
            void handler.executeActionRequest(effect.confirmRequest)
          }
        })
    },
  })
  return handler
}
```

- [ ] **Step 4: Запустить — зелёные**

Run: `npx vitest run src/features/sdui/lib/use-sdui-effects.test.ts`
Expected: PASS

---

## Task 6: Объединённый реестр выделения `selection-store.ts`

**Files:**

- Create: `src/features/sdui/lib/stores/selection-store.ts`
- Test: `src/features/sdui/lib/stores/selection-store.test.ts`
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx` (импорт)
- Delete: `src/features/sdui/lib/stores/ref-picker-selection-store.ts`

**Interfaces:**

- Produces: `useSelectionStore` (zustand) с `selection: Record<string, string | number | null>`, `setSelection(field, id)`, `clearSelection(field)`; `useSelection(field: string | null): string | number | null`.

- [ ] **Step 1: Тест `selection-store.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import { useSelectionStore } from './selection-store'

beforeEach(() => {
  useSelectionStore.setState({ selection: {} })
})

describe('selection-store — единый реестр (SCRUM-288 §2.2)', () => {
  it('хранит number (пикер) и string (дерево) под непрозрачными ключами', () => {
    useSelectionStore.getState().setSelection('ref.field', 42)
    useSelectionStore.getState().setSelection('related.anchor7', 'row-13')
    expect(useSelectionStore.getState().selection['ref.field']).toBe(42)
    expect(useSelectionStore.getState().selection['related.anchor7']).toBe(
      'row-13'
    )
  })

  it('clearSelection удаляет ключ', () => {
    useSelectionStore.getState().setSelection('k', 1)
    useSelectionStore.getState().clearSelection('k')
    expect('k' in useSelectionStore.getState().selection).toBe(false)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/lib/stores/selection-store.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `selection-store.ts`**

```ts
import { create } from 'zustand'

// SCRUM-288 §2.2: единый реестр выделения. Ключ — непрозрачный selectionField
// (пикер ссылочного поля/подбор в ТЧ и дерево связей). Значение — id строки:
// number у пикера, string у дерева (String.valueOf(entryId) на бэке).
interface SelectionState {
  selection: Record<string, string | number | null>
  setSelection: (field: string, id: string | number | null) => void
  clearSelection: (field: string) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: {},
  setSelection: (field, id) =>
    set((s) => ({ selection: { ...s.selection, [field]: id } })),
  clearSelection: (field) =>
    set((s) => {
      const next = { ...s.selection }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- ключ selectionField, не пользовательский ввод
      delete next[field]
      return { selection: next }
    }),
}))

/** Селектор: id выделенной строки для поля, или null. */
export function useSelection(field: string | null): string | number | null {
  return useSelectionStore((s) => (field ? (s.selection[field] ?? null) : null))
}
```

- [ ] **Step 4: Перевести `list-node.tsx` на новый стор**

Заменить импорт `useRefPickerSelectionStore` → `useSelectionStore` (из `../../../lib/stores/selection-store`) и обращения `useRefPickerSelectionStore((s) => s.setSelection)` / `s.clearSelection` — на `useSelectionStore(...)`. Логика записи (`setSelection(selectField, selectedRowId)`) не меняется.

- [ ] **Step 5: Удалить старый файл**

```bash
git rm src/features/sdui/lib/stores/ref-picker-selection-store.ts
```

- [ ] **Step 6: Запустить — зелёные**

Run: `npx vitest run src/features/sdui/lib/stores/selection-store.test.ts src/features/sdui/ui/nodes/composite/list-node.test.tsx`
Expected: PASS (list-node тест может требовать правки мока — см. Task 8 паттерн; поправить импорт мока стора).

---

## Task 7: `subordination-tree.tsx` → запись в объединённый стор по `selectionField`

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/subordination-tree.tsx`
- Test: `src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`
- Delete: `src/features/sdui/lib/stores/related-docs-store.ts` (+`.test.ts`) — в Task 9 (после снятия последнего потребителя).

**Interfaces:**

- Consumes: `useSelectionStore` (Task 6), `ViewNodeAction.selectionField` (Task 1).

- [ ] **Step 1: Тест — дерево пишет rowId по selectionField из select-действия**

Обновить `subordination-tree.test.tsx`: замокать `useSelectionStore`, подать узлу `actions: [{ trigger: 'select', actionId: 'select', selectionField: 'related.a1' }]`, кликнуть строку, проверить `setSelection('related.a1', '<rowId>')`. Пример ключевого кейса:

```ts
it('клик по строке пишет rowId в объединённый стор по selectionField (флаг вкл)', () => {
  const setSelection = vi.fn()
  vi.mocked(useSelectionStore).mockImplementation((sel) =>
    sel({ selection: {}, setSelection, clearSelection: vi.fn() })
  )
  render(<SubordinationTree node={treeNodeWithSelectAction('related.a1')} />)
  fireEvent.click(screen.getByText('Документ №1'))
  expect(setSelection).toHaveBeenCalledWith('related.a1', 'row-1')
})

it('без select-действия (флаг выкл) — не пишет в стор (старый путь не ломаем)', () => {
  const setSelection = vi.fn()
  vi.mocked(useSelectionStore).mockImplementation((sel) =>
    sel({ selection: {}, setSelection, clearSelection: vi.fn() })
  )
  render(<SubordinationTree node={treeNodeNoActions()} />)
  fireEvent.click(screen.getByText('Документ №1'))
  expect(setSelection).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализация**

В `subordination-tree.tsx`:

- Убрать импорт/использование `useRelatedDocsStore`, локальную реконсиляцию по `isDeletionMarked`/`anchorId` и прямую запись `select(anchorId, …)`.
- Читать select-действие и его `selectionField`:

```ts
const selectAction = node.actions?.find((a) => a.trigger === 'select')
const selectionField = selectAction?.selectionField ?? undefined
const setSelection = useSelectionStore((s) => s.setSelection)
const clearSelection = useSelectionStore((s) => s.clearSelection)
const selectedId = useSelection(selectionField ?? null)
```

- `handleClick`:

```ts
const handleClick = (row: RelatedTreeRow) => {
  if (row._isTruncated === true) return
  if (!selectionField) return // флаг выкл: select-действия нет — старый путь мёртв, ничего не пишем
  setSelection(selectionField, row.rowId)
}
```

- Подсветка строки: `selected={selectedId === row.rowId}`.
- Реконсиляция после перестроения дерева (строка пропала) — по объединённому стору:

```ts
useEffect(() => {
  if (!selectionField || selectedId == null) return
  if (!rows.some((r) => r.rowId === selectedId)) clearSelection(selectionField)
}, [rows, selectedId, selectionField, clearSelection])
```

`isDeletionMarked` в сторе больше не хранится (§2.2 — текст подтверждения серверный).

- [ ] **Step 4: Запустить — зелёные**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/subordination-tree.test.tsx`
Expected: PASS

---

## Task 8: `button-node.tsx` — путь `request`, снятие `handleRelatedCommand`

**Files:**

- Modify: `src/features/sdui/ui/nodes/action/button-node.tsx`
- Test: `src/features/sdui/ui/nodes/action/button-node-related.test.tsx` (переписать на request-путь)

**Interfaces:**

- Consumes: `useSduiEffects` (Task 5), `useSelection` (Task 6), `ViewNodeAction.request` (Task 1).

- [ ] **Step 1: Переписать `button-node-related.test.tsx` под request-путь**

```ts
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ButtonNode } from './button-node'

const dispatchMock = vi.fn()
const executeActionRequestMock = vi.fn()
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => dispatchMock }))
vi.mock('../../../lib/use-sdui-effects', () => ({
  useSduiEffects: () => ({ executeActionRequest: executeActionRequestMock, play: vi.fn(), playAll: vi.fn() }),
}))
vi.mock('../../../lib/overflow/overflow-context', () => ({ useOverflowCollapsed: () => [] }))
vi.mock('../../../lib/stores/selection-store', () => ({ useSelection: () => 'row-7' }))

const btnWithRequest = (): ViewNode =>
  ({
    id: 'btn.post', type: 'BUTTON', props: { label: 'Провести' },
    actions: [{
      trigger: 'click', actionId: 'post',
      requiresSelectedRow: true, selectionField: 'related.a1',
      request: { method: 'POST', url: '/api/view/related-documents/post?rootId=1&anchorId=a1' },
    }],
  }) as ViewNode

beforeEach(() => { cleanup(); vi.clearAllMocks() })

describe('ButtonNode — путь request (SCRUM-288 §2.1)', () => {
  it('клик исполняет request с selectedRowId, НЕ диспатчит COMMAND', () => {
    render(<ButtonNode node={btnWithRequest()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Провести' }))
    expect(executeActionRequestMock).toHaveBeenCalledWith(
      { method: 'POST', url: '/api/view/related-documents/post?rootId=1&anchorId=a1' },
      'row-7'
    )
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('кнопка без request идёт прежним путём в dispatch', () => {
    const node = { id: 'b', type: 'BUTTON', props: { label: 'Сохранить', command: 'form.save' } } as ViewNode
    render(<ButtonNode node={node} />)
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'COMMAND', command: 'form.save' }, null)
    expect(executeActionRequestMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-node-related.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализация в `button-node.tsx`**

- Удалить `import { handleRelatedCommand } from '../../../lib/open-related-docs'`.
- Заменить импорт `useRefPickerSelection` → `useSelection` из `../../../lib/stores/selection-store`.
- Добавить `const effects = useSduiEffects()`.
- `const requestAction = clickAction?.request ?? null`.
- `selectedRowId`: `const selectedRowId = useSelection(requiresSelectedRow ? (selectionField ?? null) : null)`.
- `handleClick` — request-путь ПЕРВЫМ, до `command`:

```ts
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  if (isDropdown) {
    setMenuAnchor(e.currentTarget)
    return
  }
  // SCRUM-288 §2.1: панель связей — исполнение готового request (не COMMAND в сессию).
  if (requestAction) {
    void effects.executeActionRequest(
      requestAction,
      requiresSelectedRow ? (selectedRowId ?? undefined) : undefined
    )
    return
  }
  if (command) {
    if (requiresSelectedRow) {
      if (selectedRowId == null) return
      void dispatch(
        {
          type: 'COMMAND',
          command,
          value: { id: selectedRowId },
          sourceNodeId: node.id,
        },
        behavior
      )
      return
    }
    void dispatch({ type: 'COMMAND', command }, behavior)
  }
}
```

`disabled` остаётся `!enabled || (requiresSelectedRow && selectedRowId == null)`.

- [ ] **Step 4: Запустить — зелёные (и общий прогон кнопки)**

Run: `npx vitest run src/features/sdui/ui/nodes/action`
Expected: PASS (в т.ч. `button-node-requires-row.test.tsx`; если он мокал `ref-picker-selection-store` — переключить мок на `selection-store`).

---

## Task 9: Снос `open-related-docs` / `related-docs-api` / `related-docs-store` + grep-инвариант

**Files:**

- Delete: `src/features/sdui/lib/open-related-docs.ts` (+`.test.ts`), `src/features/sdui/api/related-docs-api.ts` (+`.test.ts`), `src/features/sdui/lib/stores/related-docs-store.ts` (+`.test.ts`)
- Create (тест-инвариант): `src/features/sdui/lib/no-name-interception.test.ts`

- [ ] **Step 1: grep-инвариантный тест (крит. §6.1)**

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(process.cwd(), 'src/features/sdui')
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('SCRUM-288 §6.1 — нет перехвата команд по именам', () => {
  it('ACTION_BY_COMMAND / isRelatedCommand / handleRelatedCommand отсутствуют', () => {
    const hits = walk(ROOT)
      .filter(
        (f) =>
          /\.(ts|tsx)$/.test(f) && !f.endsWith('no-name-interception.test.ts')
      )
      .filter((f) =>
        /ACTION_BY_COMMAND|isRelatedCommand|handleRelatedCommand/.test(
          readFileSync(f, 'utf8')
        )
      )
    expect(hits).toEqual([])
  })
})
```

- [ ] **Step 2: Запустить — падает (файлы ещё есть)**

Run: `npx vitest run src/features/sdui/lib/no-name-interception.test.ts`
Expected: FAIL — найдены вхождения.

- [ ] **Step 3: Удалить файлы**

```bash
git rm src/features/sdui/lib/open-related-docs.ts src/features/sdui/lib/open-related-docs.test.ts \
       src/features/sdui/api/related-docs-api.ts src/features/sdui/api/related-docs-api.test.ts \
       src/features/sdui/lib/stores/related-docs-store.ts src/features/sdui/lib/stores/related-docs-store.test.ts
```

Проверить, что `open-related-docs`/`related-docs-api`/`related-docs-store` больше нигде не импортируются:

```bash
grep -rn "open-related-docs\|related-docs-api\|related-docs-store\|useRelatedDocsStore\|useRefPickerSelection" src | grep -v selection-store
```

Ожидание: пусто. Если `subordination-tree`/`button-node`/`list-node` ещё ссылаются — доправить импорты (Tasks 6–8).

- [ ] **Step 4: Запустить весь SDUI**

Run: `npx vitest run --dir src/features/sdui`
Expected: PASS (весь слайс зелёный).

- [ ] **Step 5: Сборка и коммит A**

Run: `npm run build`
Expected: сборка успешна (tsc -b без ошибок).

```bash
git add -A
git commit -F - <<'EOF'
feat: унификация эффектов — рантайм, confirm-мост, панель связей (SCRUM-288 A)

Общий исполнитель action-request + useSduiEffects; confirmRequest/confirmBehavior
в confirm-мосте (§2.3/§2.4); снос handleRelatedCommand и слияние сторов выделения
(§2.1/§2.2).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NK5hEfedMVXXL8gkjnLgkt
EOF
```

---

# КОММИТ B — Авторитетный `dirty` с сервера (§2.5)

## Task 10: `view-state-store.setDirty` + проброс в session-context

**Files:**

- Modify: `src/features/sdui/lib/stores/view-state-store.ts`
- Create/Modify: `src/features/sdui/lib/stores/view-state-store.test.ts`
- Modify: `src/features/sdui/lib/sdui-session-context.tsx`

**Interfaces:**

- Produces: `useViewStateStore.setDirty(value: boolean)`; `SduiSessionValue.setDirty`.

- [ ] **Step 1: Тест на `setDirty`**

Создать (или дополнить) `view-state-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import { useViewStateStore } from './view-state-store'

beforeEach(() => useViewStateStore.setState({ state: {}, dirty: false }))

describe('view-state-store setDirty (SCRUM-288 §2.5)', () => {
  it('setDirty(true) поднимает флаг, setDirty(false) — снимает', () => {
    useViewStateStore.getState().setDirty(true)
    expect(useViewStateStore.getState().dirty).toBe(true)
    useViewStateStore.getState().setDirty(false)
    expect(useViewStateStore.getState().dirty).toBe(false)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/lib/stores/view-state-store.test.ts`
Expected: FAIL — `setDirty` не существует.

- [ ] **Step 3: Реализация**

В `view-state-store.ts` в интерфейс добавить `setDirty: (value: boolean) => void`, в стор:

```ts
  setDirty: (value) => set({ dirty: value }),
```

В `sdui-session-context.tsx`: добавить `setDirty` в тип `SduiSessionValue` и в fallback-объект:

```ts
    setDirty: useViewStateStore.getState().setDirty,
```

(и в `panel-state-provider.tsx`, если там свой объект сессии реализует интерфейс целиком — прокинуть `setDirty` из того же стора; проверить компиляцию типа).

- [ ] **Step 4: Запустить — зелёные**

Run: `npx vitest run src/features/sdui/lib/stores/view-state-store.test.ts`
Expected: PASS

---

## Task 11: Чтение `res.dirty` в `dispatch.ts`

**Files:**

- Modify: `src/features/sdui/lib/dispatch.ts`
- Test: `src/features/sdui/lib/dispatch.test.ts`

**Interfaces:**

- Consumes: `session.setDirty` (Task 10), `ViewResponse.dirty` (Task 1).

- [ ] **Step 1: Тесты dirty-override**

Добавить в `dispatch.test.ts` (в `sessionMock` уже есть `setDirty: vi.fn()` из Task 4):

```ts
describe('res.dirty авторитетно (SCRUM-288 §2.5)', () => {
  it('res.dirty=false перекрывает клиентский флаг', async () => {
    mockPost.mockResolvedValueOnce({
      formSessionId: 's',
      revision: 2,
      dirty: false,
    } as ViewResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'EVENT', command: 'x' })
    expect(sessionMock.setDirty).toHaveBeenCalledWith(false)
  })

  it('res.dirty отсутствует — setDirty не зовём (клиентский флаг как есть)', async () => {
    mockPost.mockResolvedValueOnce({
      formSessionId: 's',
      revision: 2,
    } as ViewResponse)
    const { result } = renderHook(() => useSduiDispatch(), { wrapper })
    await result.current({ type: 'EVENT', command: 'x' })
    expect(sessionMock.setDirty).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/lib/dispatch.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

Взять `setDirty` из деструктуризации `session` (рядом с `resetDirty`). В EVENT/COMMAND-ветке, после `merge(res.statePatch ?? {})` и ПЕРЕД `effectHandler.playAll(...)` (или перед `if (shouldReset) resetDirty()` — порядок с эффектами не конфликтует):

```ts
// SCRUM-288 §2.5: серверный dirty авторитетен и ПЕРЕКРЫВАЕТ клиентский флаг
// (включая false с LIST/REPORT). null/undefined — «решай сам».
if (res.dirty != null) setDirty(res.dirty)
```

`setDirty` добавить в список деструктуризации из `session` вверху `dispatchAction`.

- [ ] **Step 4: Запустить — зелёные + сборка + коммит B**

Run: `npx vitest run --dir src/features/sdui`
Expected: PASS

Run: `npm run build`
Expected: успех

```bash
git add -A
git commit -F - <<'EOF'
feat: чтение авторитетного res.dirty с сервера (SCRUM-288 B §2.5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NK5hEfedMVXXL8gkjnLgkt
EOF
```

---

# КОММИТ C — Download с телом + печать/экспорт отчёта (§3)

## Task 12: Ветка `download` с телом в `effect-handler.ts`

**Files:**

- Modify: `src/features/sdui/lib/effect-handler.ts`
- Test: `src/features/sdui/lib/effect-handler.test.ts`

**Interfaces:**

- Consumes: `apiService.postFileBlob`/`getFileBlob`, `ViewEffect.request` (Task 1).

- [ ] **Step 1: Тесты download-ветвления**

```ts
describe('effect download (SCRUM-288 §3.1)', () => {
  it('есть request — POST через postFileBlob с телом', async () => {
    const blob = new Blob(['x'])
    vi.mocked(apiService.postFileBlob).mockResolvedValue({
      data: blob,
      headers: {},
    } as never)
    createEffectHandler(makeDeps()).play({
      type: 'download',
      request: {
        method: 'POST',
        url: '/api/reportalt/OSVPoSchetu/print',
        body: { parameters: {} },
      },
    })
    await Promise.resolve()
    expect(apiService.postFileBlob).toHaveBeenCalledWith({
      url: '/api/reportalt/OSVPoSchetu/print',
      data: { parameters: {} },
    })
    expect(apiService.getFileBlob).not.toHaveBeenCalled()
  })

  it('есть только url — прежний GET через getFileBlob', async () => {
    const blob = new Blob(['x'])
    vi.mocked(apiService.getFileBlob).mockResolvedValue({
      data: blob,
      headers: {},
    } as never)
    createEffectHandler(makeDeps()).play({
      type: 'download',
      url: '/api/print/42.pdf',
    })
    await Promise.resolve()
    expect(apiService.getFileBlob).toHaveBeenCalledWith({
      url: '/api/print/42.pdf',
    })
    expect(apiService.postFileBlob).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/lib/effect-handler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

В `effect-handler.ts` вынести сохранение blob в локальную функцию и добавить ветку request:

```ts
function saveOrPreviewBlob(res: {
  data: Blob
  headers: Record<string, unknown>
}): void {
  const objectUrl = URL.createObjectURL(res.data)
  const disposition = res.headers['content-disposition'] as string | undefined
  if (disposition && /attachment/i.test(disposition)) {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = parseContentDispositionFilename(disposition) || 'download'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } else {
    window.open(objectUrl, '_blank')
  }
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 60_000)
}
```

`case 'download'`:

```ts
      case 'download': {
        // SCRUM-288 §3.1: есть request — POST с телом; иначе прежний GET по url.
        const blobPromise = effect.request
          ? apiService.postFileBlob({
              url: effect.request.url,
              data: effect.request.body ?? undefined,
            })
          : effect.url
            ? apiService.getFileBlob({ url: effect.url })
            : null
        if (!blobPromise) break
        void blobPromise
          .then((res) => { saveOrPreviewBlob(res as never) })
          .catch(() => { showToast('error', i18n.t('sdui.downloadError')) })
        break
      }
```

- [ ] **Step 4: Запустить — зелёные**

Run: `npx vitest run src/features/sdui/lib/effect-handler.test.ts`
Expected: PASS

---

## Task 13: `report-result-node.tsx` — `printEffect`/`exportEffect`

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/report-result-node.tsx`
- Test: `src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`

**Interfaces:**

- Consumes: `useSduiEffects().play` (Task 5), `ViewEffect` (Task 1).

- [ ] **Step 1: Тесты — печать/экспорт проигрывают эффект, наложение userSettings**

Добавить в `report-result-node.test.tsx` (замокать `useSduiEffects`):

```ts
const playMock = vi.fn()
vi.mock('../../../lib/use-sdui-effects', () => ({
  useSduiEffects: () => ({ play: playMock, playAll: vi.fn(), executeActionRequest: vi.fn() }),
}))

it('printEffect есть — «Печать» проигрывает эффект, gateway.print НЕ зовётся', () => {
  // node.props.printEffect = { type:'download', request:{ method:'POST', url:'/api/reportalt/X/print', body:{ parameters:{} } } }
  // + source задан (кнопки видны)
  render(<ReportResultNode node={nodeWithPrintEffect()} />)
  fireEvent.click(screen.getByTestId('report-result-print'))
  expect(playMock).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'download', request: expect.objectContaining({ url: '/api/reportalt/X/print' }) })
  )
})

it('userSettings домешивается в request.body перед проигрыванием', () => {
  render(<ReportResultNode node={nodeWithPrintEffect()} />)
  // применить настройки через SettingsPanel-стаб (onApply)
  fireEvent.click(screen.getByTestId('apply-settings')) // стаб зовёт onApply({ foo: 1 })
  fireEvent.click(screen.getByTestId('report-result-print'))
  expect(playMock).toHaveBeenCalledWith(
    expect.objectContaining({
      request: expect.objectContaining({ body: expect.objectContaining({ userSettings: { foo: 1 } }) }),
    })
  )
})
```

> Форма фикстур/стабов — по образцу существующего `report-result-node.test.tsx` (gateway-стаб, useInfiniteQuery-мок).

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализация**

В `report-result-node.tsx`:

- `const effects = useSduiEffects()`.
- Прочитать пропы:

```ts
const printEffect = node.props?.printEffect as ViewEffect | undefined
const exportEffect = node.props?.exportEffect as ViewEffect | undefined
```

- Хелпер наложения настроек на тело эффекта (§3.5 п.3 — не удаляем клиентское наложение):

```ts
const playDownload = (effect: ViewEffect) => {
  const req = effect.request
  if (
    req &&
    userSettings != null &&
    typeof req.body === 'object' &&
    req.body != null
  ) {
    effects.play({
      ...effect,
      request: { ...req, body: { ...req.body, userSettings } },
    })
  } else {
    effects.play(effect)
  }
}
```

- Кнопка «Печать»: ветвление по наличию нового пропа:

```tsx
{
  printEffect ? (
    <Button
      data-testid="report-result-print"
      onClick={() => {
        playDownload(printEffect)
      }}
    >
      {t('sdui.reportResult.print')}
    </Button>
  ) : printSource ? (
    <Button
      data-testid="report-result-print"
      onClick={() => {
        void gateway?.print?.(printSource.url, effectiveBody)
      }}
    >
      {t('sdui.reportResult.print')}
    </Button>
  ) : null
}
```

- Кнопка «Экспорт» аналогично: `exportEffect ? play : exportEnabled ? old`:

```tsx
{
  exportEffect ? (
    <Button
      data-testid="report-result-export"
      onClick={() => {
        playDownload(exportEffect)
      }}
    >
      {t('sdui.reportResult.export')}
    </Button>
  ) : exportEnabled ? (
    <Button
      data-testid="report-result-export"
      disabled={!result}
      onClick={() => {
        if (result) gateway?.exportXlsx?.(result, reportName)
      }}
    >
      {t('sdui.reportResult.export')}
    </Button>
  ) : null
}
```

- Условие показа панели кнопок дополнить: `(printSource || printEffect || exportEnabled || exportEffect || (settingsEnabled && SettingsPanel))`.
- Клиентское наложение `effectiveBody` для СТАРОГО пути — НЕ удалять.

- [ ] **Step 4: Запустить — зелёные**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`
Expected: PASS

- [ ] **Step 5: Полный прогон, сборка, коммит C**

Run: `npx vitest run --dir src/features/sdui`
Expected: PASS

Run: `npm run build`
Expected: успех

```bash
git add -A
git commit -F - <<'EOF'
feat: download с телом + printEffect/exportEffect отчёта (SCRUM-288 C §3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NK5hEfedMVXXL8gkjnLgkt
EOF
git push -u origin feature/SCRUM-288-unified-effects
```

---

# E2E / ручная проверка на деве

- **Печать/экспорт отчёта (§3.6, без флага):** `OborotnoSaldovayaVedomost` (layout=TREE, списковый параметр `ACCOUNT_LIST`, `multi-ref-enabled` включён) и `OSVPoSchetu` (без списковых). Сценарий: открыть → «Сформировать» → `printEffect`/`exportEffect` заполнены → «Печать»/«Экспорт» скачивают файл → `report.reset`/смена варианта → пропы снова `null` (кнопки не отдают файл по устаревшему телу). Настройки из `SettingsPanel` попадают в скачанный файл.
- **Панель связей (§6.2, нужен флаг):** попросить Alisher включить `sdui.related-docs.action-request` на деве. Проверить: пять кнопок работают через `action-request`; кнопки без выделения (кроме «Обновить») погашены; «Пометить на удаление» спрашивает СЕРВЕРНЫМ текстом RU/KZ; ответ не сбивает форму-владельца (нет 409 на следующем действии).
- **§2.4 регресс (§6.5):** «Пометить на удаление» на карточке документа (форм-сессия): после «Да» форма НЕ остаётся грязной.

# Не наша работа (держать в уме, §5)

- Легаси-фолбэк по `422 SCREEN_NOT_SDUI` не срабатывает (перехвачен явными `<Route>` выше catch-all — дефект роутинга, тикет у PM).
- Заголовок вложения печати чинён на бэке; не полагаться на regex-подстроку `attachment` как гарантию формата.
- §7: если на включённом флаге `request.url` содержит `{...}` или `requiresSelectedRow:true` без `selectionField` — баг бэка (`ActionRequestUrlIsReadyTest`/`SelectionKeyInvariantTest`), адрес сам не строим — пишем Alisher.

# SCRUM-244 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поддержать SDUI-карточку справочника страницей, новые эффекты/варианты контракта и починить восстановление формы после потери сессии.

**Architecture:** Все изменения в SDUI-слайсе (`src/features/sdui`) + развилка маршрута справочника по образцу документов + плоский редирект. Багфиксы 409 — нормализацией на границе транспорта; `layoutCode` для переоткрытия — в tree-store через session-context; ретрай — чистой функцией-политикой.

**Tech Stack:** React 19, TS 5.9, zustand, TanStack Query, MUI, date-fns, vitest.

## Global Constraints

- Спека: `docs/superpowers/specs/2026-07-21-scrum-244-dict-card-front-design.md`; спека бэка — `specs-local/scrum-244-struktura-podchineniya/SCRUM-244-spec-v1-2026-07-21-back.md`.
- Ветка: `feature/SCRUM-244-dict-card-links` (уже создана, design-doc закоммичен).
- НЕ запускать `tsc --noEmit`/`npm run lint`/`npm run build` после каждого изменения — только финальная проверка (Task 10) или по просьбе пользователя. Тесты конкретного файла гонять можно: `npx vitest run <path>`.
- Никаких `useMemo`/`useCallback` без явной perf-причины (существующие не трогать).
- Тексты — только через `useTranslation`/i18n-ключи из `common.json` (все локали: `find src -name common.json`).
- Легаси не рефакторить; прямые импорты SDUI↔легаси запрещены.
- Коммиты: формат `feat|fix|add|refactor: описание` (commit-msg hook), в конце каждой таски.
- Один файл — одна ответственность; новый код ~200 строк на файл.

---

### Task 1: Нормализация 409 в транспорте (A1)

**Files:**
- Modify: `src/features/sdui/types/view.ts:98-104` (тип ConflictError)
- Modify: `src/features/sdui/api/view-transport.ts:35-37`
- Create: `src/features/sdui/api/normalize-conflict.ts`
- Test: `src/features/sdui/api/normalize-conflict.test.ts`

**Interfaces:**
- Produces: `normalizeConflictBody(body: unknown): ConflictError` — маппит `code = body.code ?? body.error`; `ConflictError.code` становится `string` (открытый тип), известные значения — константы `STALE_REVISION`, `SESSION_NOT_FOUND` (строковые литералы, как раньше).
- `conflict-handler.ts` и его тесты НЕ изменяются.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/sdui/api/normalize-conflict.test.ts
import { describe, expect, it } from 'vitest'

import { normalizeConflictBody } from './normalize-conflict'

describe('normalizeConflictBody', () => {
  it('читает код конфликта из поля error (реальный провод, §2.6 спеки бэка)', () => {
    const body = {
      error: 'SESSION_NOT_FOUND',
      formSessionId: 'abc',
      reason: 'session not found or expired',
    }
    const result = normalizeConflictBody(body)
    expect(result.code).toBe('SESSION_NOT_FOUND')
    expect(result.formSessionId).toBe('abc')
  })

  it('поле code имеет приоритет, если бэк начнёт слать его', () => {
    const result = normalizeConflictBody({ code: 'STALE_REVISION', error: 'X' })
    expect(result.code).toBe('STALE_REVISION')
  })

  it('переносит currentRevision и snapshot как есть', () => {
    const result = normalizeConflictBody({
      error: 'STALE_REVISION',
      currentRevision: 7,
      snapshot: { state: { a: 1 } },
    })
    expect(result.currentRevision).toBe(7)
    expect(result.snapshot?.state).toEqual({ a: 1 })
  })

  it('не падает на мусорном теле — код пустой строкой', () => {
    expect(normalizeConflictBody(null).code).toBe('')
    expect(normalizeConflictBody('oops').code).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sdui/api/normalize-conflict.test.ts`
Expected: FAIL — `Cannot find module './normalize-conflict'`

- [ ] **Step 3: Write implementation**

Тип (`src/features/sdui/types/view.ts`, заменить интерфейс ConflictError):

```typescript
export interface ConflictError {
  // Открытый тип НАМЕРЕННО: закрытый union маскировал расхождение с проводом
  // (код приходил в поле error и никогда не матчился) — SCRUM-244 §4.1
  code: string
  formSessionId?: string
  currentRevision?: number
  snapshot?: { state: Record<string, unknown> }
  reason?: string
}
```

Новый файл `src/features/sdui/api/normalize-conflict.ts`:

```typescript
import type { ConflictError } from '../types/view'

/**
 * Тело 409 с бэка несёт код конфликта в поле `error` (не `code`) — §2.6 спеки
 * SCRUM-244. Нормализуем на границе транспорта, чтобы conflict-handler и его
 * тесты остались на прежнем контракте.
 */
export function normalizeConflictBody(body: unknown): ConflictError {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const code =
    (typeof b.code === 'string' && b.code) ||
    (typeof b.error === 'string' && b.error) ||
    ''
  return {
    code,
    formSessionId: typeof b.formSessionId === 'string' ? b.formSessionId : undefined,
    currentRevision: typeof b.currentRevision === 'number' ? b.currentRevision : undefined,
    snapshot: b.snapshot as ConflictError['snapshot'],
    reason: typeof b.reason === 'string' ? b.reason : undefined,
  }
}
```

В `src/features/sdui/api/view-transport.ts` строка 36 — заменить:

```typescript
// было:
throw new ViewConflictError(error.response.data as ConflictError)
// стало:
throw new ViewConflictError(normalizeConflictBody(error.response.data))
```

и добавить импорт `import { normalizeConflictBody } from './normalize-conflict'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/sdui/api/normalize-conflict.test.ts`
Expected: PASS (4 теста). Также: `npx vitest run src/features/sdui` — существующие тесты conflict-handler зелёные без правок.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/types/view.ts src/features/sdui/api/normalize-conflict.ts src/features/sdui/api/normalize-conflict.test.ts src/features/sdui/api/view-transport.ts
git commit -m "fix: 409-конфликт читается из поля error — обработчик конфликтов оживает (SCRUM-244)"
```

---

### Task 2: layoutCode для переоткрытия + политика ретрая (A2, A3)

**Files:**
- Modify: `src/features/sdui/lib/stores/tree-store.ts`
- Modify: `src/features/sdui/lib/sdui-session-context.tsx` (интерфейс + fallback)
- Modify: `src/features/sdui/ui/sdui-screen.tsx:142-169` (sessionValue)
- Modify: `src/features/sdui/lib/dispatch.ts:65-67, 89`
- Create: `src/features/sdui/lib/reopen-retry-policy.ts`
- Test: `src/features/sdui/lib/reopen-retry-policy.test.ts`

**Interfaces:**
- Consumes: `ViewAction`, `ActionBehavior` из `types/view.ts`.
- Produces: `isRetryableAfterReopen(action: ViewAction, behavior?: ActionBehavior | null): boolean`; в `SduiSessionValue` появляются опциональные `getLayoutCode?: () => string | null` и `setLayoutCode?: (code: string | null) => void`; в tree-store — поле `layoutCode: string | null` + `setLayoutCode`. Панели (`PanelFormProvider`) их не реализуют — для них reopen остаётся прежним (без ретрая), это осознанно.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/sdui/lib/reopen-retry-policy.test.ts
import { describe, expect, it } from 'vitest'

import { isRetryableAfterReopen } from './reopen-retry-policy'

describe('isRetryableAfterReopen', () => {
  it('EVENT ретраится — клик/ввод не теряется', () => {
    expect(isRetryableAfterReopen({ type: 'EVENT', value: 'x' }, null)).toBe(true)
  })

  it('навигационная команда (behavior null) ретраится', () => {
    expect(isRetryableAfterReopen({ type: 'COMMAND', command: 'nav.open:X:Y:Z' }, null)).toBe(true)
  })

  it('команда записи (resetsDirty) НЕ ретраится — scratch умер вместе с сессией', () => {
    expect(
      isRetryableAfterReopen({ type: 'COMMAND', command: 'dict.save' }, { resetsDirty: true }),
    ).toBe(false)
  })

  it('команда записи-закрытия (closeAfter) НЕ ретраится', () => {
    expect(
      isRetryableAfterReopen({ type: 'COMMAND', command: 'dict.saveAndClose' }, { closeAfter: true }),
    ).toBe(false)
  })

  it('OPEN и CLOSE не ретраятся', () => {
    expect(isRetryableAfterReopen({ type: 'OPEN' }, null)).toBe(false)
    expect(isRetryableAfterReopen({ type: 'CLOSE' }, null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sdui/lib/reopen-retry-policy.test.ts`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Write implementation**

`src/features/sdui/lib/reopen-retry-policy.ts`:

```typescript
import type { ActionBehavior, ViewAction } from '../types/view'

/**
 * После восстановления сессии (SESSION_NOT_FOUND → reopen) повторяем исходное
 * действие, чтобы клик пользователя не терялся. Исключение — команды записи:
 * их scratch-состояние умерло вместе с сессией, повтор сохранил бы пустую
 * форму поверх данных. Маркеры записи — resetsDirty/closeAfter из контракта
 * Actions (SCRUM-283).
 */
export function isRetryableAfterReopen(
  action: ViewAction,
  behavior?: ActionBehavior | null,
): boolean {
  if (action.type === 'OPEN' || action.type === 'CLOSE') return false
  if (action.type === 'COMMAND' && (behavior?.resetsDirty || behavior?.closeAfter)) {
    return false
  }
  return true
}
```

Tree-store — добавить поле и сеттер (в интерфейс и в `create`):

```typescript
// в TreeStoreState:
  layoutCode: string | null
  setLayoutCode: (code: string | null) => void
// в create(...):
  layoutCode: null,
  setLayoutCode: (code) => set({ layoutCode: code }),
// в reset(): добавить layoutCode: null
```

`sdui-session-context.tsx` — в `SduiSessionValue` после `setSession`:

```typescript
  // layoutCode последнего OPEN — нужен reopen'у после SESSION_NOT_FOUND (SCRUM-244 §4.2).
  // Хранится в session-context (не в module-scope): у панелей свои провайдеры,
  // модульная переменная перепутала бы параллельные сессии.
  getLayoutCode?: () => string | null
  setLayoutCode?: (code: string | null) => void
```

и в fallback-объект `useSduiSession` (после `setSession: ...`):

```typescript
    getLayoutCode: () => useTreeStore.getState().layoutCode,
    setLayoutCode: useTreeStore.getState().setLayoutCode,
```

`sdui-screen.tsx` — в `sessionValue` те же две строки (после `setSession: ...`):

```typescript
      getLayoutCode: () => useTreeStore.getState().layoutCode,
      setLayoutCode: useTreeStore.getState().setLayoutCode,
```

`dispatch.ts` — три правки:

1. Импорт: `import { isRetryableAfterReopen } from './reopen-retry-policy'`
2. Заменить `reopen` (строки 65-67):

```typescript
      const reopen = async () => {
        // layoutCode обязателен для OPEN (§2.3 спеки SCRUM-244) — без него
        // переоткрытие уходило в цикл 409 → 400. Берём сохранённый с первого OPEN.
        const layoutCode = session.getLayoutCode?.() ?? undefined
        const ok = await dispatch({ type: 'OPEN', layoutCode })
        // Повторяем исходное действие, чтобы клик не терялся (кроме команд записи)
        if (ok && isRetryableAfterReopen(action, behavior)) {
          void dispatch(action, behavior, true)
        }
      }
```

3. В ветке успешного OPEN (сразу после `setSession(res.formSessionId, res.revision)` строка 90):

```typescript
          session.setLayoutCode?.(action.layoutCode ?? null)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/sdui/lib/reopen-retry-policy.test.ts`
Expected: PASS (5 тестов). Также `npx vitest run src/features/sdui` — без регрессий.

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/reopen-retry-policy.ts src/features/sdui/lib/reopen-retry-policy.test.ts src/features/sdui/lib/stores/tree-store.ts src/features/sdui/lib/sdui-session-context.tsx src/features/sdui/ui/sdui-screen.tsx src/features/sdui/lib/dispatch.ts
git commit -m "fix: переоткрытие формы после потери сессии — layoutCode и ретрай без команд записи (SCRUM-244)"
```

---

### Task 3: Heartbeat сессии (A4)

**Files:**
- Modify: `src/features/sdui/api/view-transport.ts` (метод heartbeat)
- Create: `src/features/sdui/lib/hooks/use-session-heartbeat.ts`
- Modify: `src/features/sdui/ui/sdui-screen.tsx` (подключение хука)

**Interfaces:**
- Produces: `viewTransport.heartbeat(sessionId: string): Promise<boolean>` — `true`=жива (204), `false`=нет (404); сетевые/прочие ошибки НЕ убивают пинг (возврат `true`). `useSessionHeartbeat(formSessionId: string | null)` — интервал `HEARTBEAT_INTERVAL_MS = 10 * 60_000`.

- [ ] **Step 1: Implementation (чистого юнита нет — таймер+сеть; проверка типами и финальной сборкой)**

В `view-transport.ts` внутрь объекта `viewTransport` (после `post`):

```typescript
  // Продление form-session долгоживущих форм (карточка справочника) — §2.2
  // спеки SCRUM-244. true = сессия жива, false = 404 (нужно переоткрытие).
  // Прочие ошибки (сеть, 5xx) не считаем смертью сессии — пинг продолжается.
  heartbeat: async (sessionId: string): Promise<boolean> => {
    try {
      await instance.post(`/api/view/${sessionId}/heartbeat`)
      return true
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return false
      return true
    }
  },
```

Новый файл `src/features/sdui/lib/hooks/use-session-heartbeat.ts`:

```typescript
import { useEffect } from 'react'

import { viewTransport } from '../../api/view-transport'

// 10 минут — рекомендация спеки SCRUM-244 §2.2 (idle-TTL сессии заметно больше)
export const HEARTBEAT_INTERVAL_MS = 10 * 60_000

/**
 * Пинг form-session, пока форма смонтирована: между вводом полей запросов нет,
 * без пинга сессия истекает по idle-TTL и набранный ввод теряется на первом
 * «Записать». На 404 пинг молча останавливается: следующее действие пользователя
 * получит 409 и пройдёт штатное восстановление (conflict-handler → reopen).
 */
export function useSessionHeartbeat(formSessionId: string | null): void {
  useEffect(() => {
    if (!formSessionId) return
    const id = setInterval(() => {
      void viewTransport.heartbeat(formSessionId).then((alive) => {
        if (!alive) clearInterval(id)
      })
    }, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [formSessionId])
}
```

В `sdui-screen.tsx`: импорт `import { useSessionHeartbeat } from '../lib/hooks/use-session-heartbeat'`; после строки `const dirty = useViewStateStore((s) => s.dirty)` добавить:

```typescript
  const formSessionId = useTreeStore((s) => s.formSessionId)
  useSessionHeartbeat(formSessionId)
```

- [ ] **Step 2: Smoke-проверка типов затронутых файлов**

Run: `npx vitest run src/features/sdui` (существующие тесты, компиляция тест-бандла подхватит грубые ошибки типов)
Expected: PASS без регрессий.

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/api/view-transport.ts src/features/sdui/lib/hooks/use-session-heartbeat.ts src/features/sdui/ui/sdui-screen.tsx
git commit -m "add: heartbeat form-session раз в 10 минут для долгоживущих форм (SCRUM-244)"
```

---

### Task 4: Эффект refresh (B1)

**Files:**
- Modify: `src/features/sdui/types/node-types.ts:22` (EffectType)
- Modify: `src/features/sdui/lib/effect-handler.ts` (deps + case)
- Modify: `src/features/sdui/lib/dispatch.ts:53-63` (прокидка dep)
- Test: `src/features/sdui/lib/effect-handler.test.ts` (создать, если нет; если есть — дополнить)

**Interfaces:**
- Produces: `EffectType` += `'refresh'`; `EffectHandlerDeps.invalidateLists: () => void`. Реализация в dispatch: `queryClient.invalidateQueries({ queryKey: ['sdui-list'] })` — ключ списков из `list-node.tsx:68`. Толерантно: не зависит от полей эффекта (payload не подтверждён бэком — вопрос §2.2 спеки v2 Talgat'у).

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/sdui/lib/effect-handler.test.ts
import { describe, expect, it, vi } from 'vitest'

import { createEffectHandler, type EffectHandlerDeps } from './effect-handler'

function makeDeps(): EffectHandlerDeps {
  return {
    navigate: vi.fn(),
    closeSession: vi.fn().mockResolvedValue(undefined),
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    invalidateLists: vi.fn(),
  }
}

describe('effect refresh', () => {
  it('вызывает инвалидацию списков', () => {
    const deps = makeDeps()
    const handler = createEffectHandler(deps)
    handler.play({ type: 'refresh' })
    expect(deps.invalidateLists).toHaveBeenCalledTimes(1)
  })

  it('не задевает другие зависимости', () => {
    const deps = makeDeps()
    createEffectHandler(deps).play({ type: 'refresh' })
    expect(deps.navigate).not.toHaveBeenCalled()
    expect(deps.openDialog).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sdui/lib/effect-handler.test.ts`
Expected: FAIL — `'refresh'` не входит в `EffectType` (ошибка типов) / `invalidateLists` нет в deps.

- [ ] **Step 3: Write implementation**

`node-types.ts:22`:

```typescript
export type EffectType = 'navigate' | 'openDialog' | 'closeDialog' | 'notify' | 'download' | 'refresh'
```

`effect-handler.ts` — в `EffectHandlerDeps` добавить `invalidateLists: () => void`; в `switch` новый case (после `notify`):

```typescript
      case 'refresh':
        // Списки (LIST-ноды) перечитываются через TanStack Query. Payload
        // эффекта игнорируем намеренно: адресация не подтверждена контрактом
        // (вопрос Talgat'у в спеке v2) — инвалидация всех SDUI-списков безопасна.
        deps.invalidateLists()
        break
```

`dispatch.ts` — импорт `useQueryClient` из `@tanstack/react-query`, в теле хука `const queryClient = useQueryClient()`, в `createEffectHandler({...})` добавить:

```typescript
        invalidateLists: () => {
          void queryClient.invalidateQueries({ queryKey: ['sdui-list'] })
        },
```

и `queryClient` в deps `useCallback` дописать в массив зависимостей.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/sdui/lib/effect-handler.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/types/node-types.ts src/features/sdui/lib/effect-handler.ts src/features/sdui/lib/effect-handler.test.ts src/features/sdui/lib/dispatch.ts
git commit -m "add: эффект refresh — инвалидация SDUI-списков после записи (SCRUM-244)"
```

---

### Task 5: Каркас confirm — стор + диалог-хост (B2)

**Files:**
- Create: `src/features/sdui/lib/stores/confirm-store.ts`
- Create: `src/features/sdui/ui/confirm-dialog-host.tsx`
- Modify: `src/features/sdui/ui/dialog-host.tsx` (монтирование хоста)
- Modify: локали `common.json` (ключи `sdui.confirm.ok`, `sdui.confirm.cancel`)
- Test: `src/features/sdui/lib/stores/confirm-store.test.ts`

**Interfaces:**
- Produces: `useConfirmStore` (zustand): `state = { open: boolean; message: string }`, `ask(message: string): Promise<boolean>`, `answer(ok: boolean): void`. `ConfirmDialogHost` — MUI Dialog, рендерится внутри `DialogHost` (есть на каждом SDUI-экране).
- ВАЖНО: case `'confirm'` в effect-handler НЕ добавляется — провод к эффекту заблокирован вопросом §2.1 спеки v2 (что играть по «Да»). `'confirm'` в `EffectType` тоже пока не добавляем.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/sdui/lib/stores/confirm-store.test.ts
import { describe, expect, it } from 'vitest'

import { useConfirmStore } from './confirm-store'

describe('confirm-store', () => {
  it('ask открывает диалог и резолвится ответом true', async () => {
    const promise = useConfirmStore.getState().ask('Перейти без сохранения?')
    expect(useConfirmStore.getState().open).toBe(true)
    expect(useConfirmStore.getState().message).toBe('Перейти без сохранения?')

    useConfirmStore.getState().answer(true)
    await expect(promise).resolves.toBe(true)
    expect(useConfirmStore.getState().open).toBe(false)
  })

  it('answer(false) резолвит отказом', async () => {
    const promise = useConfirmStore.getState().ask('m')
    useConfirmStore.getState().answer(false)
    await expect(promise).resolves.toBe(false)
  })

  it('повторный ask после ответа работает (стор переиспользуемый)', async () => {
    const p1 = useConfirmStore.getState().ask('первый')
    useConfirmStore.getState().answer(true)
    await p1
    const p2 = useConfirmStore.getState().ask('второй')
    expect(useConfirmStore.getState().message).toBe('второй')
    useConfirmStore.getState().answer(false)
    await expect(p2).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sdui/lib/stores/confirm-store.test.ts`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Write implementation**

`src/features/sdui/lib/stores/confirm-store.ts`:

```typescript
import { create } from 'zustand'

interface ConfirmStoreState {
  open: boolean
  message: string
  resolve: ((ok: boolean) => void) | null

  // Императивный мост для эффекта confirm (SCRUM-244 §B2): effect-handler
  // (не-React слой) ждёт ответа пользователя промисом, диалог рендерит
  // ConfirmDialogHost. Провод к самому эффекту — после ответа бэка о payload.
  ask: (message: string) => Promise<boolean>
  answer: (ok: boolean) => void
}

export const useConfirmStore = create<ConfirmStoreState>((set, get) => ({
  open: false,
  message: '',
  resolve: null,

  ask: (message) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, message, resolve })
    }),

  answer: (ok) => {
    get().resolve?.(ok)
    set({ open: false, message: '', resolve: null })
  },
}))
```

`src/features/sdui/ui/confirm-dialog-host.tsx`:

```typescript
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material'

import { useConfirmStore } from '../lib/stores/confirm-store'

/** Хост диалога подтверждения для императивного моста confirm-store (SCRUM-244). */
export const ConfirmDialogHost = () => {
  const { t } = useTranslation()
  const open = useConfirmStore((s) => s.open)
  const message = useConfirmStore((s) => s.message)
  const answer = useConfirmStore((s) => s.answer)

  return (
    <Dialog open={open} onClose={() => answer(false)} maxWidth="xs" fullWidth>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => answer(false)}>
          {t('sdui.confirm.cancel')}
        </Button>
        <Button variant="contained" onClick={() => answer(true)}>
          {t('sdui.confirm.ok')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

В `dialog-host.tsx`: импорт `ConfirmDialogHost` и отрендерить `<ConfirmDialogHost />` последним элементом корневого фрагмента компонента `DialogHost` (рядом с рендером стека панелей).

Локали: `find src -name common.json` → в каждую добавить в существующий блок `sdui` (или создать):

```json
"confirm": { "ok": "Да", "cancel": "Нет" }
```

(в казахской локали: `"ok": "Иә", "cancel": "Жоқ"`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/sdui/lib/stores/confirm-store.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/stores/confirm-store.ts src/features/sdui/lib/stores/confirm-store.test.ts src/features/sdui/ui/confirm-dialog-host.tsx src/features/sdui/ui/dialog-host.tsx $(find src -name common.json | tr '\n' ' ')
git commit -m "add: каркас confirm — стор и диалог-хост, провод к эффекту после ответа бэка (SCRUM-244)"
```

---

### Task 6: Варианты кнопок text / text-dropdown (B3)

**Files:**
- Create: `src/features/sdui/ui/nodes/action/button-presentation.ts`
- Modify: `src/features/sdui/ui/nodes/action/button-node.tsx:37-38`
- Test: `src/features/sdui/ui/nodes/action/button-presentation.test.ts`

**Interfaces:**
- Produces: `resolveButtonPresentation(variant: string | undefined, hasChildren: boolean): { muiVariant: 'text' | 'outlined' | 'contained'; isDropdown: boolean }`. Рантайм-варианты с бэка: `text | text-dropdown | contained | outlined | dropdown` (+ легаси `primary`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/sdui/ui/nodes/action/button-presentation.test.ts
import { describe, expect, it } from 'vitest'

import { resolveButtonPresentation } from './button-presentation'

describe('resolveButtonPresentation', () => {
  it('text-dropdown: меню, выглядящее ссылкой («Ещё...» панели «Перейти»)', () => {
    expect(resolveButtonPresentation('text-dropdown', true)).toEqual({
      muiVariant: 'text',
      isDropdown: true,
    })
  })

  it('dropdown: командное меню остаётся outlined', () => {
    expect(resolveButtonPresentation('dropdown', true)).toEqual({
      muiVariant: 'outlined',
      isDropdown: true,
    })
  })

  it('дропдаун без детей вырождается в кнопку', () => {
    expect(resolveButtonPresentation('text-dropdown', false).isDropdown).toBe(false)
    expect(resolveButtonPresentation('dropdown', false).isDropdown).toBe(false)
  })

  it('прямые MUI-варианты с бэка проходят как есть', () => {
    expect(resolveButtonPresentation('text', false).muiVariant).toBe('text')
    expect(resolveButtonPresentation('contained', false).muiVariant).toBe('contained')
    expect(resolveButtonPresentation('outlined', false).muiVariant).toBe('outlined')
  })

  it('легаси primary → contained, неизвестное/пустое → outlined', () => {
    expect(resolveButtonPresentation('primary', false).muiVariant).toBe('contained')
    expect(resolveButtonPresentation(undefined, false).muiVariant).toBe('outlined')
    expect(resolveButtonPresentation('weird', false).muiVariant).toBe('outlined')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-presentation.test.ts`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Write implementation**

`src/features/sdui/ui/nodes/action/button-presentation.ts`:

```typescript
export interface ButtonPresentation {
  muiVariant: 'text' | 'outlined' | 'contained'
  isDropdown: boolean
}

/**
 * Маппинг props.variant с бэка → MUI. text-dropdown — меню, выглядящее
 * ссылкой («Ещё...» в панели «Перейти» читается как продолжение ссылок-регистров,
 * а не как кнопка) — SCRUM-244 §2.5.
 */
export function resolveButtonPresentation(
  variant: string | undefined,
  hasChildren: boolean,
): ButtonPresentation {
  const isDropdown =
    (variant === 'dropdown' || variant === 'text-dropdown') && hasChildren

  const muiVariant =
    variant === 'contained' || variant === 'primary'
      ? 'contained'
      : variant === 'text' || variant === 'text-dropdown'
        ? 'text'
        : 'outlined'

  return { muiVariant, isDropdown }
}
```

`button-node.tsx` — заменить строки 37-38:

```typescript
// было:
  const isDropdown = variantProp === 'dropdown' && !!node.children?.length
  const muiVariant = variantProp === 'primary' ? 'contained' : 'outlined'
// стало:
  const { muiVariant, isDropdown } = resolveButtonPresentation(
    variantProp,
    !!node.children?.length,
  )
```

с импортом `import { resolveButtonPresentation } from './button-presentation'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-presentation.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/action/button-presentation.ts src/features/sdui/ui/nodes/action/button-presentation.test.ts src/features/sdui/ui/nodes/action/button-node.tsx
git commit -m "add: варианты кнопок text и text-dropdown с сервера (SCRUM-244)"
```

---

### Task 7: format-cell — форматирование ячеек LIST по dataType (B4)

**Files:**
- Create: `src/features/sdui/lib/format-cell.ts`
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx:139-162` (accessorFn)
- Test: `src/features/sdui/lib/format-cell.test.ts`

**Interfaces:**
- Produces: `formatSduiCellValue(value: unknown, dataType?: string): string`. dataType с бэка: `STRING | INTEGER | DATE | DATETIME | BOOLEAN | ENUMS | DICTIONARY | OBJECT`. Ссылочные объекты (`{id, presentation}`) разворачивает СУЩЕСТВУЮЩИЙ код accessorFn до вызова форматтера — форматтер работает с примитивами.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/sdui/lib/format-cell.test.ts
import { describe, expect, it } from 'vitest'

import { formatSduiCellValue } from './format-cell'

describe('formatSduiCellValue', () => {
  it('DATE → дд.мм.гггг', () => {
    expect(formatSduiCellValue('2026-06-09', 'DATE')).toBe('09.06.2026')
  })

  it('DATETIME с полуночью — время опускается (как в 1С)', () => {
    expect(formatSduiCellValue('2026-06-09T00:00:00', 'DATETIME')).toBe('09.06.2026')
  })

  it('DATETIME со временем → дд.мм.гггг чч:мм', () => {
    expect(formatSduiCellValue('2026-06-09T14:30:00', 'DATETIME')).toBe('09.06.2026 14:30')
  })

  it('BOOLEAN → галочка/пусто', () => {
    expect(formatSduiCellValue(true, 'BOOLEAN')).toBe('✓')
    expect(formatSduiCellValue(false, 'BOOLEAN')).toBe('')
    expect(formatSduiCellValue('true', 'BOOLEAN')).toBe('✓')
  })

  it('null/undefined/пустая строка → пусто для любого типа', () => {
    expect(formatSduiCellValue(null, 'DATE')).toBe('')
    expect(formatSduiCellValue(undefined, 'BOOLEAN')).toBe('')
    expect(formatSduiCellValue('', 'STRING')).toBe('')
  })

  it('STRING/INTEGER/без dataType — как есть', () => {
    expect(formatSduiCellValue('текст', 'STRING')).toBe('текст')
    expect(formatSduiCellValue(42, 'INTEGER')).toBe('42')
    expect(formatSduiCellValue('x', undefined)).toBe('x')
  })

  it('невалидная дата не падает — исходная строка', () => {
    expect(formatSduiCellValue('не-дата', 'DATE')).toBe('не-дата')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sdui/lib/format-cell.test.ts`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Write implementation**

`src/features/sdui/lib/format-cell.ts`:

```typescript
import { format, isValid, parseISO } from 'date-fns'

/**
 * Форматирование значения ячейки SDUI-списка по dataType колонки
 * (TABLE_COLUMN.props.dataType) — SCRUM-244 §B4. Даты — дд.мм.гггг,
 * время показывается только ненулевое (полночь опускается, как в 1С),
 * булево — галочка/пусто. Ссылочные объекты разворачивает вызывающий код.
 */
export function formatSduiCellValue(value: unknown, dataType?: string): string {
  if (value == null || value === '') return ''

  switch (dataType) {
    case 'BOOLEAN':
      return value === true || value === 'true' ? '✓' : ''

    case 'DATE':
    case 'DATETIME': {
      const date = typeof value === 'string' ? parseISO(value) : null
      if (!date || !isValid(date)) return String(value)
      const hasTime =
        dataType === 'DATETIME' &&
        (date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0)
      return format(date, hasTime ? 'dd.MM.yyyy HH:mm' : 'dd.MM.yyyy')
    }

    default:
      return String(value)
  }
}
```

`list-node.tsx` — в `columns` (accessorFn, строки 144-153) применить форматтер к примитивам:

```typescript
        accessorFn: (row: ListRow) => {
          const binding = (col.props?.attributeCode ?? col.props?.binding) as string
          if (!binding) return ''
          const val = resolveBinding(row, binding)
          if (val && typeof val === 'object') {
            const obj = val as Record<string, unknown>
            return (obj.presentation ?? obj.displayName ?? obj.nameRu ?? obj.name ?? String(obj.id ?? '')) as string
          }
          return formatSduiCellValue(val, col.props?.dataType as string | undefined)
        },
```

с импортом `import { formatSduiCellValue } from '../../../lib/format-cell'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/sdui/lib/format-cell.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/lib/format-cell.ts src/features/sdui/lib/format-cell.test.ts src/features/sdui/ui/nodes/composite/list-node.tsx
git commit -m "add: форматирование ячеек SDUI-списков по dataType — даты, булевы (SCRUM-244)"
```

---

### Task 8: SDUI-карточка справочника страницей (C1)

**Files:**
- Rename: `src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx` → `legacy-dictionary-entry-page.tsx` (компонент → `LegacyDictionaryEntryPage`; содержимое НЕ рефакторить)
- Create: `src/pages/dictionaries/dictionary-entry/ui/sdui-dictionary-entry-page.tsx`
- Create: `src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx` (новый — развилка)
- Modify: `src/pages/dictionaries/dictionary-entry/index.ts` (если реэкспорт по пути — путь не меняется, проверить)
- Modify: `src/features/sdui/ui/sdui-screen.tsx` (проп `onOpenFailed`)
- Modify: `src/features/sdui/api/view-transport.ts` + `src/features/sdui/lib/dispatch.ts` (тихий 404 на OPEN)

**Interfaces:**
- Consumes: паттерн `document-entry-page.tsx` (развилка), `sdui-document-page.tsx` (страница), queryKey `['dict-type', domain, moduleCode]` (кэш общий с легаси-страницей и списком).
- Produces: `ViewHttpError extends Error { status: number }` в транспорте; `SduiScreen` получает проп `onOpenFailed?: (status?: number) => void`; `SduiDictionaryEntryPage` с пропом `moduleCode`; развилка: SDUI при `newView === true` И наличии `entryId` (создание/копирование — легаси, у бэка контракт страницы только для существующей записи: route `/dictionaries/<TypeCode>/<entryId>`); при `onOpenFailed(404)` — откат на легаси (штатный гейт раскатки §2.3).

- [ ] **Step 1: Транспорт — ViewHttpError со статусом**

В `view-transport.ts` после класса `ViewConflictError`:

```typescript
export class ViewHttpError extends Error {
  constructor(
    message: string,
    public status: number | undefined,
  ) {
    super(message)
  }
}
```

и заменить ветку не-409 axios-ошибок (строки 38-40):

```typescript
      if (axios.isAxiosError(error)) {
        throw new ViewHttpError(
          extractMessage(error.response?.data) ?? error.message,
          error.response?.status,
        )
      }
```

- [ ] **Step 2: dispatch — тихий 404 на OPEN + сигнал наверх**

В `dispatch.ts` импортировать `ViewHttpError` из `../api/view-transport`. В блоке `catch` (строки 116-132), перед существующей веткой `else`:

```typescript
        } else if (
          error instanceof ViewHttpError &&
          error.status === 404 &&
          action.type === 'OPEN'
        ) {
          // 404 на OPEN — штатный гейт раскатки (§2.3 SCRUM-244): тип ещё не
          // переведён на SDUI. Без тоста: хост покажет легаси-форму.
        } else {
```

(итог: `if (ViewConflictError) ... else if (404-OPEN) ... else { toast }`; во всех ветках `return false` в конце как сейчас).

- [ ] **Step 3: SduiScreen — проп onOpenFailed**

В `SduiScreenProps` добавить:

```typescript
  // OPEN не удался (напр. 404 — тип не переведён на SDUI): хост может показать легаси
  onOpenFailed?: () => void
```

в главном эффекте (строка 71) заменить `void dispatch({ type: 'OPEN', layoutCode })` на:

```typescript
      void dispatch({ type: 'OPEN', layoutCode }).then((ok) => {
        if (!ok) onOpenFailed?.()
      })
```

- [ ] **Step 4: Страница SDUI-карточки**

`src/pages/dictionaries/dictionary-entry/ui/sdui-dictionary-entry-page.tsx` (по образцу `sdui-document-page.tsx`, без инвалидации `document-entries`):

```typescript
import { useMemo, useState, type FC } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { SduiScreen, useViewStateStore, useTreeStore, useSduiDispatch } from '@/features/sdui'
import { useWorkspaceTabsStore, useFormCacheStore, useTabMeta } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { useUnsavedChangesDialog } from '@/pages/documents/documents-entry/lib/hooks/use-unsaved-changes-dialog'

interface SduiDictionaryEntryPageProps {
  moduleCode: string
  // 404 от OPEN — тип не переведён (штатный гейт §2.3): хост откатывается на легаси
  onOpenFailed: () => void
}

export const SduiDictionaryEntryPage: FC<SduiDictionaryEntryPageProps> = ({
  moduleCode,
  onOpenFailed,
}) => {
  const { pageCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const domain = searchParams.get('domain') ?? 'DICTIONARY'
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useSduiDispatch()
  const queryClient = useQueryClient()

  const dirty = useViewStateStore((s) => s.dirty)
  const baseTitle = (useTreeStore((s) => s.root?.props?.title) as string | undefined) ?? ''
  const pageTitle = dirty ? `${baseTitle} *` : baseTitle

  const [tabTitle, setTabTitle] = useState('')
  useTabMeta(tabTitle)

  const listPath = `/modules/${pageCode}/dictionary/${moduleCode}?domain=${domain}`

  const closeCurrentTab = () => {
    useFormCacheStore.getState().removeTab(location.pathname)
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
  }

  const unsavedDialog = useUnsavedChangesDialog({
    onSave: () => {
      // Имя команды и поведение — из серверного дескриптора (SCRUM-283 §4.6)
      const desc = useTreeStore.getState().onDirtyClose
      if (!desc?.command) return
      void dispatch({ type: 'COMMAND', command: desc.command }, desc.behavior)
    },
    onDiscard: () => {
      closeCurrentTab()
      void navigate(listPath)
    },
  })

  const handleClose = () => {
    if (dirty) {
      unsavedDialog.open()
    } else {
      closeCurrentTab()
      void navigate(listPath)
    }
  }

  const tabsApi = useMemo(
    () => ({
      shouldPersistSession: (route: string) =>
        useWorkspaceTabsStore.getState().tabs.some((tab) => tab.id === route),
      onDirtyChange: (route: string, dirty: boolean) =>
        useFormCacheStore.getState().setDirty(route, dirty),
      consumePendingAction: (route: string) =>
        useFormCacheStore.getState().consumePendingAction(route),
      onCloseAfter: (route: string) => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
      },
      onSavedAndClosed: (route: string) => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
        void navigate(listPath)
      },
    }),
    [navigate, listPath],
  )

  // При уходе SDUI-кэш списков может устареть для легаси-списка справочника
  const screenApi = useMemo(
    () => ({
      ...tabsApi,
      onOpenFailed: () => {
        void queryClient.invalidateQueries({ queryKey: ['dict-type'] })
        onOpenFailed()
      },
    }),
    [tabsApi, queryClient, onOpenFailed],
  )

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />
      <SduiScreen
        layoutCode={`dict.${moduleCode}.OBJECT_FORM`}
        {...screenApi}
        onTitleChange={setTabTitle}
      />
      <UnsavedChangesDialog
        open={unsavedDialog.isOpen}
        onSave={unsavedDialog.handleSave}
        onDiscard={unsavedDialog.handleDiscard}
        onCancel={unsavedDialog.handleCancel}
      />
    </div>
  )
}
```

ПРИМЕЧАНИЕ для исполнителя: `useUnsavedChangesDialog` лежит в `src/pages/documents/documents-entry/lib/hooks/` — проверь, что импорт между pages-слайсами не запрещён линтером; если запрещён — скопируй хук в `src/pages/dictionaries/dictionary-entry/lib/hooks/use-unsaved-changes-dialog.ts` (он ~30 строк, копия допустима, отметь TODO на вынос в shared).

- [ ] **Step 5: Развилка**

Переименовать старый файл: `git mv src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx src/pages/dictionaries/dictionary-entry/ui/legacy-dictionary-entry-page.tsx`, внутри переименовать `export const DictionaryEntryPage` → `export const LegacyDictionaryEntryPage` (единственная правка).

Новый `src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx`:

```typescript
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { fetchDictTypeMetadata } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { LegacyDictionaryEntryPage } from './legacy-dictionary-entry-page'
import { SduiDictionaryEntryPage } from './sdui-dictionary-entry-page'

/**
 * Развилка SDUI/легаси для карточки справочника (SCRUM-244 §C1), по образцу
 * document-entry-page. SDUI — только для существующей записи (entryId) типа
 * с newView; создание/копирование и 404 от OPEN — легаси.
 */
export const DictionaryEntryPage = () => {
  const { moduleCode = '', entryId } = useParams()
  const [searchParams] = useSearchParams()
  const domain = searchParams.get('domain') ?? 'DICTIONARY'
  // 404 от OPEN: тип помечен newView, но конкретная форма ещё не раскатана
  const [sduiFailed, setSduiFailed] = useState(false)

  const { data: newView, isLoading } = useQuery({
    queryKey: ['dict-type', domain, moduleCode],
    queryFn: ({ signal }) => fetchDictTypeMetadata(domain, moduleCode, signal),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data.newView,
  })

  if (isLoading) return <PageSkeleton />

  if (newView && entryId && !sduiFailed) {
    return (
      <SduiDictionaryEntryPage
        moduleCode={moduleCode}
        onOpenFailed={() => setSduiFailed(true)}
      />
    )
  }
  return <LegacyDictionaryEntryPage />
}
```

ПРИМЕЧАНИЕ: `fetchDictTypeMetadata` уже используется легаси-страницей этого же слайса — queryKey `['dict-type', domain, moduleCode]` совпадает, кэш общий, лишнего запроса нет. Проверь `index.ts` слайса: экспорт `DictionaryEntryPage` идёт из `ui/dictionary-entry-page.tsx` — путь не изменился.

- [ ] **Step 6: Прогон тестов SDUI**

Run: `npx vitest run src/features/sdui src/pages`
Expected: PASS без регрессий.

- [ ] **Step 7: Commit**

```bash
git add -A src/pages/dictionaries/dictionary-entry src/features/sdui/ui/sdui-screen.tsx src/features/sdui/api/view-transport.ts src/features/sdui/lib/dispatch.ts
git commit -m "feat: SDUI-карточка справочника страницей по флагу newView с откатом на легаси (SCRUM-244)"
```

---

### Task 9: Плоский редирект /dictionaries/... (C2)

**Files:**
- Create: `src/entities/module/lib/resolve-type-page-code.ts` (перенос из `src/pages/documents/document-redirect/lib/resolve-document-page-code.ts`)
- Create: `src/entities/module/lib/use-resolve-type-page-code.ts` (перенос хука)
- Move test: `src/entities/module/lib/resolve-type-page-code.test.ts`
- Modify: `src/entities/module/index.ts` (экспорты)
- Modify: `src/pages/documents/document-redirect/ui/document-redirect.tsx` (импорт из entities)
- Delete: `src/pages/documents/document-redirect/lib/*` (после переноса)
- Create: `src/pages/dictionaries/dictionary-redirect/ui/dictionary-redirect.tsx`
- Create: `src/pages/dictionaries/dictionary-redirect/index.ts`
- Modify: `src/app/App.tsx` (2 маршрута + lazy)

**Interfaces:**
- Produces: `resolveTypePageCode(moduleCodes, itemsByModuleCode, typeCode)` и `useResolveTypePageCode(typeCode): { isResolving, pageCode }` в `@/entities/module` (общая зона — можно из обоих миров). Резолвер обходит структуру модулей (колонки → секции → элементы), код элемента = код типа — работает и для документов, и для справочников. Роуты: `/dictionaries/:typeCode` → `/modules/<pageCode>/dictionary/<typeCode>?domain=DICTIONARY`; `/dictionaries/:typeCode/:entryId` → `.../dictionary/<typeCode>/<entryId>?domain=DICTIONARY`.

- [ ] **Step 1: Перенос резолвера в entities/module**

`git mv src/pages/documents/document-redirect/lib/resolve-document-page-code.ts src/entities/module/lib/resolve-type-page-code.ts` — внутри переименовать `resolveDocumentPageCode` → `resolveTypePageCode` (комментарий «тип документа» → «тип (документа/справочника)»); тип `ModuleItems` теперь импортировать относительно: `import type { ModuleItems } from '../types/...'` — свериться с фактическим путём типа в entities/module.

`git mv src/pages/documents/document-redirect/lib/resolve-document-page-code.test.ts src/entities/module/lib/resolve-type-page-code.test.ts` — обновить импорт и имя функции в тесте.

`git mv src/pages/documents/document-redirect/lib/use-resolve-document-page-code.ts src/entities/module/lib/use-resolve-type-page-code.ts` — переименовать `useResolveDocumentPageCode` → `useResolveTypePageCode`, импорт `getModule` сделать относительным (внутри слайса), `resolveDocumentPageCode` → `resolveTypePageCode`.

В `src/entities/module/index.ts` добавить:

```typescript
export { resolveTypePageCode } from './lib/resolve-type-page-code'
export { useResolveTypePageCode } from './lib/use-resolve-type-page-code'
```

В `document-redirect.tsx` заменить импорт:

```typescript
import { useResolveTypePageCode } from '@/entities/module'
// и вызов: const { isResolving, pageCode } = useResolveTypePageCode(typeCode)
```

Run: `npx vitest run src/entities/module`
Expected: PASS (перенесённый тест зелёный).

- [ ] **Step 2: Страница dictionary-redirect**

`src/pages/dictionaries/dictionary-redirect/ui/dictionary-redirect.tsx`:

```typescript
import { Navigate, useParams } from 'react-router-dom'

import { useResolveTypePageCode } from '@/entities/module'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

interface DictionaryRedirectProps {
  mode: 'list' | 'entry'
}

/**
 * Плоские ссылки с бэка /dictionaries/:typeCode[/:entryId] → редирект в раздел
 * /modules/:pageCode/dictionary/... (SCRUM-244 §C2). Их отдаёт серверный effect
 * navigate (напр. после dict.saveAndClose).
 */
export const DictionaryRedirect = ({ mode }: DictionaryRedirectProps) => {
  const { typeCode = '', entryId } = useParams()
  const { isResolving, pageCode } = useResolveTypePageCode(typeCode)

  if (isResolving) return <PageSkeleton />

  if (!pageCode) {
    console.warn(`[dictionary-redirect] Раздел для справочника «${typeCode}» не найден`)
    return <Navigate to="/" replace />
  }

  const base = `/modules/${pageCode}/dictionary/${typeCode}`
  const to =
    mode === 'entry' && entryId
      ? `${base}/${entryId}?domain=DICTIONARY`
      : `${base}?domain=DICTIONARY`
  return <Navigate to={to} replace />
}
```

`src/pages/dictionaries/dictionary-redirect/index.ts`:

```typescript
export { DictionaryRedirect } from './ui/dictionary-redirect'
```

- [ ] **Step 3: Маршруты в App.tsx**

Рядом с lazy-импортом `DocumentRedirect` (строка 38) добавить:

```typescript
const DictionaryRedirect = lazy(() =>
  import('@/pages/dictionaries/dictionary-redirect').then((m) => ({
    default: m.DictionaryRedirect,
  })),
)
```

Рядом с роутами `/documents/:typeCode` (строки 140-146) добавить:

```tsx
          <Route
            path="/dictionaries/:typeCode"
            element={<DictionaryRedirect mode="list" />}
          />
          <Route
            path="/dictionaries/:typeCode/:entryId"
            element={<DictionaryRedirect mode="entry" />}
          />
```

- [ ] **Step 4: Прогон тестов**

Run: `npx vitest run src/entities/module src/pages`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/entities/module src/pages/documents/document-redirect src/pages/dictionaries/dictionary-redirect src/app/App.tsx
git commit -m "feat: плоский редирект /dictionaries в раздел + общий резолвер раздела в entities/module (SCRUM-244)"
```

---

### Task 10: Финальная верификация

**Files:** нет новых.

- [ ] **Step 1: Полный тестовый прогон**

Run: `npx vitest run`
Expected: все тесты PASS (новых: normalize-conflict 4, retry-policy 5, effect-handler 2, confirm-store 3, button-presentation 5, format-cell 7 + перенесённый resolve-type-page-code).

- [ ] **Step 2: Сборка и линт**

Run: `npm run build && npx eslint src/features/sdui src/pages/dictionaries src/entities/module --max-warnings 0`
Expected: build OK (tsc+vite), eslint без ошибок.

- [ ] **Step 3: Живая проверка (dev-бэк уже раскатан)**

Запустить `npm run dev`, руками (или playwright-ом) проверить сценарии приёмки:
1. Карточка Физлица (запись 72624, раздел со справочником Физлица) открывается SDUI-страницей: 7 вкладок, панель «Перейти», «Ещё...» выглядит ссылкой с меню.
2. Колонки вкладок-регистров: даты `дд.мм.гггг`, булевы галочкой.
3. «Записать и закрыть» уводит на список раздела (через /dictionaries-редирект).
4. Справочник БЕЗ newView открывается легаси-формой как раньше.
5. Восстановление: открыть карточку → дождаться/сымитировать потерю сессии (см. шаг 4) → клик по ссылке «Перейти» → форма переоткрывается и ссылка открывается (не сырой SESSION_NOT_FOUND).

- [ ] **Step 4: Имитация потери сессии для сценария 5**

Взять `formSessionId` из ответа OPEN в network-табе и убить сессию снаружи —
`POST /api/view/{formSessionId}` пустым телом (это CLOSE-эндпоинт, тот же, что у
`closeBeacon`): `curl -X POST https://dev-api.qazyna.ai/api/view/<formSessionId>`.
Следующее действие на форме должно получить 409 `SESSION_NOT_FOUND`, форма —
переоткрыться, а исходное действие (клик по ссылке «Перейти») — выполниться после
восстановления, без сырой ошибки.

- [ ] **Step 5: Итоговый статус**

Отчитаться пользователю: что прошло, что нет, готовность к PR/мерджу. Мердж — только по команде пользователя.

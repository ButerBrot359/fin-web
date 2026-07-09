# SDUI Language Switch (SCRUM-268) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SDUI-формы открываются на языке переключателя РУС/ҚАЗ: каждый `/api/view` несёт `language`, смена языка закрывает все form-session и переоткрывает активную форму, при несохранённых изменениях — confirm-диалог.

**Architecture:** Язык инжектится в единственном HTTP-chokepoint (`view-transport.post`). Оркестрация переключения — в top-bar через новый публичный API SDUI (`hasSduiUnsavedWork` / `closeAllSduiSessions`), порядок критичен: CLOSE сессий и очистка кэша ДО `i18n.changeLanguage`. Активная форма переоткрывается отдельным эффектом в `sdui-screen` по событию `languageChanged` (НЕ через deps главного OPEN-эффекта — его cleanup с persist воскресил бы стейл-сессию).

**Tech Stack:** React 19, TypeScript, Zustand, i18next, MUI, vitest + @testing-library/react.

**Спека:** `docs/superpowers/specs/2026-07-08-sdui-language-switch-design.md` (принятые решения — там).

## Global Constraints

- Канонические значения языка для бэка: `"Ru"` / `"Kz"`; коды i18next в проекте: `ru` / `kz`. Неизвестный код → `"Ru"`.
- `Accept-Language`-интерцептор НЕ делать (YAGNI, body-поле выигрывает).
- Тексты — только через `useTranslation` и ключи `common.json` (ru + kz), не хардкодить строки в JSX. Текстовые элементы — `<Typography>` из `@mui/material`.
- Никаких `useMemo`/`useCallback` без явной перф-причины.
- Изоляция SDUI↔легаси: легаси-файлы не трогать. Импорт `@/features/sdui` из `src/widgets/top-bar` легален (widget→feature).
- Коммиты: формат `feat|fix|add|refactor: описание` (commit-msg hook).
- НЕ запускать `tsc --noEmit` / `npm run lint` / `npm run build` после каждого изменения.
- Тесты гонять точечно: `npx vitest run <путь>`.

---

### Task 1: `language` в ViewRequest и транспорте

**Files:**
- Create: `src/features/sdui/api/view-language.ts`
- Test: `src/features/sdui/api/view-language.test.ts`
- Modify: `src/features/sdui/types/view.ts` (интерфейс `ViewRequest`, строки 28-35)
- Modify: `src/features/sdui/api/view-transport.ts` (метод `post`, строки 24-38)

**Interfaces:**
- Consumes: —
- Produces: `resolveViewLanguage(i18nLanguage: string): string`; поле `language?: string` в `ViewRequest`; каждый `viewTransport.post` автоматически несёт `language` (на это полагаются Task 3 и Task 5 — им НЕ нужно передавать язык самим).

- [ ] **Step 1: Написать падающий тест**

`src/features/sdui/api/view-language.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { resolveViewLanguage } from './view-language'

describe('resolveViewLanguage', () => {
  it('ru → Ru', () => {
    expect(resolveViewLanguage('ru')).toBe('Ru')
  })

  it('kz → Kz', () => {
    expect(resolveViewLanguage('kz')).toBe('Kz')
  })

  it('неизвестный код → Ru (fallback)', () => {
    expect(resolveViewLanguage('en-US')).toBe('Ru')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/api/view-language.test.ts`
Expected: FAIL — `Cannot find module './view-language'` (или аналог).

- [ ] **Step 3: Минимальная реализация**

`src/features/sdui/api/view-language.ts`:

```ts
// Маппинг кодов i18next (ru/kz) в канонические значения бэка (SCRUM-268).
// Сервер парсит lenient, но шлём канонику; неизвестный код → 'Ru'.
const LANG_MAP: Record<string, string> = { ru: 'Ru', kz: 'Kz' }

export function resolveViewLanguage(i18nLanguage: string): string {
  return LANG_MAP[i18nLanguage] ?? 'Ru'
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/api/view-language.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Добавить поле в ViewRequest**

`src/features/sdui/types/view.ts` — в интерфейс `ViewRequest` добавить последней строкой:

```ts
export interface ViewRequest {
  formSessionId?: string | null
  revision?: number | null
  layoutCode?: string | null
  route?: string
  action: ViewAction
  state?: Record<string, unknown>
  // Язык интерфейса формы; сервер читает только на OPEN (SCRUM-268)
  language?: string
}
```

- [ ] **Step 6: Инжектить язык в транспорте**

`src/features/sdui/api/view-transport.ts` — добавить импорты и одну строку в `post`:

```ts
import axios from 'axios'
import i18n from 'i18next'

import type { ViewRequest, ViewResponse, ConflictError } from '../types/view'
import { resolveViewLanguage } from './view-language'
```

В `post`, первой строкой `try`-блока (перед `instance.post`):

```ts
  post: async (req: ViewRequest): Promise<ViewResponse> => {
    try {
      const res = await instance.post<ViewResponse>('/api/view', {
        ...req,
        language: resolveViewLanguage(i18n.language),
      })
      return res.data
    } catch (error) {
```

(Остальной код `post` и `closeBeacon` без изменений. `closeBeacon` через `sendBeacon` не несёт body — это ок, на CLOSE язык серверу не нужен.)

- [ ] **Step 7: Прогнать тесты SDUI-api и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS (все существующие + новые).

```bash
git add src/features/sdui/api/view-language.ts src/features/sdui/api/view-language.test.ts src/features/sdui/api/view-transport.ts src/features/sdui/types/view.ts
git commit -m "feat: слать language в каждом запросе /api/view (SCRUM-268)"
```

---

### Task 2: `dirty` и `clear()` в sdui-cache-store + wiring в sdui-screen

**Files:**
- Modify: `src/features/sdui/lib/stores/sdui-cache-store.ts`
- Test: `src/features/sdui/lib/stores/sdui-cache-store.test.ts` (создать)
- Modify: `src/features/sdui/ui/sdui-screen.tsx` (cleanup главного эффекта, строки 68-86)

**Interfaces:**
- Consumes: `useViewStateStore.getState().dirty` (существующий флаг), `useViewStateStore.getState().replaceAll(s)`.
- Produces: `SduiCacheEntry.dirty: boolean` (обязательное поле); `useSduiCacheStore.getState().clear(): void`. На них полагается Task 3.

- [ ] **Step 1: Написать падающий тест**

`src/features/sdui/lib/stores/sdui-cache-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useSduiCacheStore } from './sdui-cache-store'

const node = { id: 'root', type: 'VSTACK', props: {}, children: [] } as unknown as ViewNode

const entry = (dirty: boolean) => ({
  root: node,
  formSessionId: 'fs-1',
  revision: 1,
  viewState: {},
  dirty,
})

describe('sdui-cache-store', () => {
  beforeEach(() => {
    useSduiCacheStore.setState({ cache: {} })
  })

  it('save/get сохраняет флаг dirty', () => {
    useSduiCacheStore.getState().save('/a', entry(true))
    expect(useSduiCacheStore.getState().get('/a')?.dirty).toBe(true)
  })

  it('clear() очищает весь кэш', () => {
    useSduiCacheStore.getState().save('/a', entry(false))
    useSduiCacheStore.getState().save('/b', entry(true))
    useSduiCacheStore.getState().clear()
    expect(useSduiCacheStore.getState().cache).toEqual({})
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/stores/sdui-cache-store.test.ts`
Expected: FAIL — TS-ошибка на `dirty` в объекте entry и `clear is not a function`.

- [ ] **Step 3: Реализация в сторе**

`src/features/sdui/lib/stores/sdui-cache-store.ts` — добавить поле в интерфейс entry, метод в интерфейс стора и реализацию:

```ts
export interface SduiCacheEntry {
  root: ViewNode
  formSessionId: string | null
  revision: number | null
  viewState: Record<string, unknown>
  // Были ли несохранённые изменения на момент ухода со вкладки —
  // нужен для confirm при переключении языка (SCRUM-268)
  dirty: boolean
}

interface SduiCacheStore {
  cache: Record<string, SduiCacheEntry>
  save: (route: string, entry: SduiCacheEntry) => void
  get: (route: string) => SduiCacheEntry | undefined
  remove: (route: string) => void
  clear: () => void
}
```

В `create(...)` добавить:

```ts
  clear: () => set({ cache: {} }),
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/lib/stores/sdui-cache-store.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Wiring в sdui-screen**

`src/features/sdui/ui/sdui-screen.tsx`, cleanup главного эффекта (строки 68-86). Две правки:

1. В persist-ветке добавить `dirty` в сохраняемый entry;
2. В else-ветке (не persist) сбросить view-state — иначе `dirty` останется `true` после ухода с SDUI-страницы и `hasSduiUnsavedWork()` (Task 3) будет врать.

```ts
    return () => {
      const persist = shouldPersistSession?.(route) ?? false
      const treeState = useTreeStore.getState()

      if (persist && treeState.root) {
        useSduiCacheStore.getState().save(route, {
          root: treeState.root,
          formSessionId: treeState.formSessionId,
          revision: treeState.revision,
          viewState: useViewStateStore.getState().getAll(),
          dirty: useViewStateStore.getState().dirty,
        })
      } else {
        void dispatch({ type: 'CLOSE' })
        useSduiCacheStore.getState().remove(route)
        // Сбросить state+dirty: SDUI-экран размонтирован, стейл dirty
        // не должен триггерить confirm переключения языка
        useViewStateStore.getState().replaceAll({})
      }
      onDirtyChange?.(route, false)
      usePanelStore.getState().reset()
      reset()
    }
```

- [ ] **Step 6: Прогнать тесты SDUI и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/features/sdui/lib/stores/sdui-cache-store.ts src/features/sdui/lib/stores/sdui-cache-store.test.ts src/features/sdui/ui/sdui-screen.tsx
git commit -m "feat: dirty-флаг и clear() в кэше SDUI-сессий"
```

---

### Task 3: Публичный API — `hasSduiUnsavedWork` / `closeAllSduiSessions`

**Files:**
- Create: `src/features/sdui/lib/language-session-control.ts`
- Test: `src/features/sdui/lib/language-session-control.test.ts`
- Modify: `src/features/sdui/index.ts`

**Interfaces:**
- Consumes: `SduiCacheEntry.dirty`, `useSduiCacheStore.getState().clear()` (Task 2); `viewTransport.post` (Task 1 — язык инжектится сам); `useViewStateStore.getState().dirty`.
- Produces (публичный API из `@/features/sdui`, на него полагается Task 6):
  - `hasSduiUnsavedWork(): boolean`
  - `closeAllSduiSessions(): Promise<void>`

- [ ] **Step 1: Написать падающий тест**

`src/features/sdui/lib/language-session-control.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../types/view'
import { viewTransport } from '../api/view-transport'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { useViewStateStore } from './stores/view-state-store'
import { closeAllSduiSessions, hasSduiUnsavedWork } from './language-session-control'

vi.mock('../api/view-transport', () => ({
  viewTransport: { post: vi.fn(), closeBeacon: vi.fn() },
}))

const node = { id: 'root', type: 'VSTACK', props: {}, children: [] } as unknown as ViewNode

const entry = (formSessionId: string | null, dirty: boolean) => ({
  root: node,
  formSessionId,
  revision: 1,
  viewState: {},
  dirty,
})

describe('hasSduiUnsavedWork', () => {
  beforeEach(() => {
    useSduiCacheStore.setState({ cache: {} })
    useViewStateStore.setState({ state: {}, dirty: false })
  })

  it('false, когда нет dirty ни в активной форме, ни в кэше', () => {
    useSduiCacheStore.getState().save('/a', entry('fs-1', false))
    expect(hasSduiUnsavedWork()).toBe(false)
  })

  it('true при dirty активной формы', () => {
    useViewStateStore.setState({ dirty: true })
    expect(hasSduiUnsavedWork()).toBe(true)
  })

  it('true при dirty-записи в кэше вкладок', () => {
    useSduiCacheStore.getState().save('/a', entry('fs-1', true))
    expect(hasSduiUnsavedWork()).toBe(true)
  })
})

describe('closeAllSduiSessions', () => {
  beforeEach(() => {
    vi.mocked(viewTransport.post).mockReset().mockResolvedValue({} as never)
    useSduiCacheStore.setState({ cache: {} })
  })

  it('шлёт CLOSE по каждой сессии кэша и очищает кэш', async () => {
    useSduiCacheStore.getState().save('/a', entry('fs-1', false))
    useSduiCacheStore.getState().save('/b', entry('fs-2', true))

    await closeAllSduiSessions()

    expect(viewTransport.post).toHaveBeenCalledTimes(2)
    expect(viewTransport.post).toHaveBeenCalledWith({
      formSessionId: 'fs-1',
      action: { type: 'CLOSE' },
    })
    expect(viewTransport.post).toHaveBeenCalledWith({
      formSessionId: 'fs-2',
      action: { type: 'CLOSE' },
    })
    expect(useSduiCacheStore.getState().cache).toEqual({})
  })

  it('пропускает записи без formSessionId', async () => {
    useSduiCacheStore.getState().save('/a', entry(null, false))
    await closeAllSduiSessions()
    expect(viewTransport.post).not.toHaveBeenCalled()
    expect(useSduiCacheStore.getState().cache).toEqual({})
  })

  it('ошибка CLOSE не мешает очистке (best-effort)', async () => {
    vi.mocked(viewTransport.post).mockRejectedValue(new Error('network'))
    useSduiCacheStore.getState().save('/a', entry('fs-1', false))
    await expect(closeAllSduiSessions()).resolves.toBeUndefined()
    expect(useSduiCacheStore.getState().cache).toEqual({})
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/language-session-control.test.ts`
Expected: FAIL — `Cannot find module './language-session-control'`.

- [ ] **Step 3: Реализация**

`src/features/sdui/lib/language-session-control.ts`:

```ts
import { viewTransport } from '../api/view-transport'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { useViewStateStore } from './stores/view-state-store'

// Публичный API для оркестрации переключения языка (SCRUM-268).
// Потребитель — top-bar (widget → feature, легально по FSD).

export function hasSduiUnsavedWork(): boolean {
  if (useViewStateStore.getState().dirty) return true
  const { cache } = useSduiCacheStore.getState()
  return Object.values(cache).some((entry) => entry.dirty)
}

// CLOSE всех закэшированных form-session (best-effort) + полная очистка кэша.
// Вызывать ДО i18n.changeLanguage: иначе restore-ветка sdui-screen
// воскресит стейл-сессию на старом языке.
export async function closeAllSduiSessions(): Promise<void> {
  const { cache } = useSduiCacheStore.getState()
  const closes = Object.values(cache)
    .filter((entry) => entry.formSessionId != null)
    .map((entry) =>
      viewTransport
        .post({ formSessionId: entry.formSessionId, action: { type: 'CLOSE' } })
        .catch(() => undefined),
    )
  await Promise.all(closes)
  useSduiCacheStore.getState().clear()
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/lib/language-session-control.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Экспорт из публичного API слайса**

`src/features/sdui/index.ts` — добавить строку:

```ts
export { hasSduiUnsavedWork, closeAllSduiSessions } from './lib/language-session-control'
```

- [ ] **Step 6: Коммит**

```bash
git add src/features/sdui/lib/language-session-control.ts src/features/sdui/lib/language-session-control.test.ts src/features/sdui/index.ts
git commit -m "feat: публичный API SDUI для закрытия сессий при смене языка"
```

---

### Task 4: `ConfirmDialog` в shared/ui

**Files:**
- Create: `src/shared/ui/confirm-dialog/confirm-dialog.tsx`
- Test: `src/shared/ui/confirm-dialog/confirm-dialog.test.tsx`

**Interfaces:**
- Consumes: `Button` из `@/shared/ui/buttons`, `Dialog`/`Typography` из `@mui/material`.
- Produces (на это полагается Task 6):

```ts
interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}
export const ConfirmDialog: FC<ConfirmDialogProps>
```

Компонент generic и принимает готовые строки — переводы делает вызывающая сторона (диалог переиспользуем вне контекста языка).

- [ ] **Step 1: Написать падающий тест**

`src/shared/ui/confirm-dialog/confirm-dialog.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './confirm-dialog'

vi.mock('@/shared/assets/icons/cross.svg', () => ({ default: () => null }))

const renderDialog = (onConfirm = vi.fn(), onCancel = vi.fn()) => {
  render(
    <ConfirmDialog
      open
      title="Заголовок"
      message="Текст сообщения"
      confirmLabel="Да"
      cancelLabel="Нет"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  afterEach(cleanup)

  it('рендерит заголовок, сообщение и обе кнопки', () => {
    renderDialog()
    expect(screen.getByText('Заголовок')).toBeTruthy()
    expect(screen.getByText('Текст сообщения')).toBeTruthy()
    expect(screen.getByText('Да')).toBeTruthy()
    expect(screen.getByText('Нет')).toBeTruthy()
  })

  it('клик по confirm вызывает onConfirm', () => {
    const { onConfirm, onCancel } = renderDialog()
    fireEvent.click(screen.getByText('Да'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('клик по cancel вызывает onCancel', () => {
    const { onConfirm, onCancel } = renderDialog()
    fireEvent.click(screen.getByText('Нет'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/shared/ui/confirm-dialog/confirm-dialog.test.tsx`
Expected: FAIL — `Cannot find module './confirm-dialog'`.

- [ ] **Step 3: Реализация**

`src/shared/ui/confirm-dialog/confirm-dialog.tsx` (визуальный стиль зеркалит `src/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog.tsx`):

```tsx
import type { FC } from 'react'
import { Dialog, Typography } from '@mui/material'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// Generic confirm-диалог с двумя действиями. Строки передаёт вызывающая
// сторона (уже переведённые) — компонент не привязан к i18n-ключам.
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => (
  <Dialog
    open={open}
    onClose={onCancel}
    slotProps={{
      paper: {
        sx: {
          borderRadius: '40px',
          boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
          p: 0,
          m: 0,
          minWidth: 660,
          maxWidth: 'none',
        },
      },
    }}
  >
    <div className="flex flex-col gap-8 px-15 py-10">
      <div className="flex w-full items-center gap-6">
        <Typography
          component="h2"
          className="flex-1 text-[26px] font-bold leading-normal text-ui-06"
        >
          {title}
        </Typography>
        <button type="button" onClick={onCancel} className="shrink-0 cursor-pointer">
          <CrossIcon className="h-5 w-5" />
        </button>
      </div>

      <Typography className="text-base font-medium text-ui-06">{message}</Typography>

      <div className="flex w-full gap-3">
        <Button variant="primary" onClick={onConfirm} className="flex-1 rounded-lg">
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} className="flex-1 rounded-lg">
          {cancelLabel}
        </Button>
      </div>
    </div>
  </Dialog>
)
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/shared/ui/confirm-dialog/confirm-dialog.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/shared/ui/confirm-dialog/confirm-dialog.tsx src/shared/ui/confirm-dialog/confirm-dialog.test.tsx
git commit -m "add: generic ConfirmDialog в shared/ui"
```

---

### Task 5: Re-OPEN активной формы при смене языка

**Files:**
- Create: `src/features/sdui/lib/language-reopen.ts`
- Test: `src/features/sdui/lib/language-reopen.test.ts`
- Modify: `src/features/sdui/ui/sdui-screen.tsx` (новый эффект после главного OPEN-эффекта)

**Interfaces:**
- Consumes: `useSduiCacheStore.remove`, `usePanelStore.reset`, `useTreeStore.reset` (существующие); тип `ViewAction` из `../types/view`.
- Produces: `reopenFormForLanguageChange(deps: { dispatch, route, layoutCode? }): Promise<void>` — используется только внутри sdui-screen.

**Почему не через deps главного OPEN-эффекта:** его cleanup при `persist=true` сохранил бы стейл-сессию в кэш, а перезапуск эффекта тут же восстановил бы её из restore-ветки. Отдельная подписка на `languageChanged` обходит persist-логику.

- [ ] **Step 1: Написать падающий тест**

`src/features/sdui/lib/language-reopen.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewAction, ViewNode } from '../types/view'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { useTreeStore } from './stores/tree-store'
import { reopenFormForLanguageChange } from './language-reopen'

const node = { id: 'root', type: 'VSTACK', props: {}, children: [] } as unknown as ViewNode

describe('reopenFormForLanguageChange', () => {
  beforeEach(() => {
    useSduiCacheStore.setState({ cache: {} })
    useTreeStore.getState().setRoot(node)
    useTreeStore.getState().setSession('fs-old', 3)
  })

  it('CLOSE → сброс сторов и кэша route → OPEN c layoutCode', async () => {
    useSduiCacheStore.getState().save('/doc/1', {
      root: node,
      formSessionId: 'fs-old',
      revision: 3,
      viewState: {},
      dirty: false,
    })

    const actions: ViewAction[] = []
    const treeAtOpen: unknown[] = []
    const dispatch = vi.fn(async (action: ViewAction) => {
      actions.push(action)
      if (action.type === 'OPEN') treeAtOpen.push(useTreeStore.getState().root)
      return true
    })

    await reopenFormForLanguageChange({
      dispatch,
      route: '/doc/1',
      layoutCode: 'X.ФормаОбъекта',
    })

    expect(actions).toEqual([
      { type: 'CLOSE' },
      { type: 'OPEN', layoutCode: 'X.ФормаОбъекта' },
    ])
    // К моменту OPEN дерево сброшено (скелетон), кэш route очищен
    expect(treeAtOpen).toEqual([null])
    expect(useSduiCacheStore.getState().get('/doc/1')).toBeUndefined()
  })

  it('ошибка CLOSE не блокирует OPEN (best-effort)', async () => {
    const dispatch = vi
      .fn<(action: ViewAction) => Promise<boolean>>()
      .mockResolvedValueOnce(false) // CLOSE упал (dispatch сам гасит ошибки тостом)
      .mockResolvedValueOnce(true) // OPEN
    await reopenFormForLanguageChange({ dispatch, route: '/doc/1' })
    expect(dispatch).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/language-reopen.test.ts`
Expected: FAIL — `Cannot find module './language-reopen'`.

- [ ] **Step 3: Реализация**

`src/features/sdui/lib/language-reopen.ts`:

```ts
import type { ViewAction } from '../types/view'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { usePanelStore } from './stores/panel-store'
import { useTreeStore } from './stores/tree-store'

interface LanguageReopenDeps {
  dispatch: (action: ViewAction) => Promise<boolean>
  route: string
  layoutCode?: string
}

// Смена языка = новая form-session: бэк фиксирует язык один раз на OPEN
// (SCRUM-268). CLOSE старой сессии (не плодим сирот на сервере) → сброс
// сторов → OPEN; новый language уйдёт автоматически из view-transport.
export async function reopenFormForLanguageChange({
  dispatch,
  route,
  layoutCode,
}: LanguageReopenDeps): Promise<void> {
  await dispatch({ type: 'CLOSE' })
  useSduiCacheStore.getState().remove(route)
  usePanelStore.getState().reset()
  useTreeStore.getState().reset()
  await dispatch({ type: 'OPEN', layoutCode })
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run src/features/sdui/lib/language-reopen.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Эффект в sdui-screen**

`src/features/sdui/ui/sdui-screen.tsx`:

Добавить импорты:

```ts
import i18n from 'i18next'

import { reopenFormForLanguageChange } from '../lib/language-reopen'
```

Добавить эффект сразу после главного OPEN-эффекта (после строки 87):

```ts
  // Смена языка: язык фиксируется в form-session на OPEN, поэтому нужен
  // re-OPEN. Отдельная подписка (а не deps главного эффекта): cleanup
  // с persist=true иначе сохранил бы стейл-сессию, которую restore-ветка
  // тут же воскресила бы.
  useEffect(() => {
    const handler = () => {
      void reopenFormForLanguageChange({
        dispatch,
        route: location.pathname,
        layoutCode,
      })
    }
    i18n.on('languageChanged', handler)
    return () => i18n.off('languageChanged', handler)
  }, [location.pathname, layoutCode, dispatch])
```

- [ ] **Step 6: Прогнать тесты SDUI и закоммитить**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

```bash
git add src/features/sdui/lib/language-reopen.ts src/features/sdui/lib/language-reopen.test.ts src/features/sdui/ui/sdui-screen.tsx
git commit -m "feat: re-OPEN SDUI-формы при переключении языка"
```

---

### Task 6: Оркестрация в top-bar + i18n-ключи

**Files:**
- Modify: `src/app/config/i18n/locales/ru/common.json`
- Modify: `src/app/config/i18n/locales/kz/common.json`
- Create: `src/widgets/top-bar/lib/hooks/use-language-switch.ts`
- Test: `src/widgets/top-bar/lib/hooks/use-language-switch.test.tsx`
- Modify: `src/widgets/top-bar/ui/top-bar.tsx`

**Interfaces:**
- Consumes: `hasSduiUnsavedWork`, `closeAllSduiSessions` из `@/features/sdui` (Task 3); `ConfirmDialog` из `@/shared/ui/confirm-dialog/confirm-dialog` (Task 4).
- Produces: хук `useLanguageSwitch(): { confirmOpen: boolean; requestToggle: () => void; confirmSwitch: () => void; cancelSwitch: () => void }`.

- [ ] **Step 1: Добавить i18n-ключи**

`src/app/config/i18n/locales/ru/common.json` — добавить блок на верхнем уровне (например, после `unsavedChangesDialog`):

```json
  "languageSwitchDialog": {
    "title": "Переключить язык?",
    "message": "Переключение языка перезагрузит открытые формы, несохранённые изменения будут потеряны",
    "confirm": "Переключить"
  },
```

`src/app/config/i18n/locales/kz/common.json` — аналогично:

```json
  "languageSwitchDialog": {
    "title": "Тілді ауыстыру керек пе?",
    "message": "Тілді ауыстырғанда ашық формалар қайта жүктеледі, сақталмаған өзгерістер жоғалады",
    "confirm": "Ауыстыру"
  },
```

Для кнопки «Отмена» переиспользуется существующий ключ `actions.cancel` — проверить, что он есть в ОБОИХ файлах (в ru есть, строка 16; в kz найти блок `actions`; если ключа нет — добавить `"cancel": "Болдырмау"`).

- [ ] **Step 2: Написать падающий тест хука**

`src/widgets/top-bar/lib/hooks/use-language-switch.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { closeAllSduiSessions, hasSduiUnsavedWork } from '@/features/sdui'

import { useLanguageSwitch } from './use-language-switch'

vi.mock('@/features/sdui', () => ({
  hasSduiUnsavedWork: vi.fn(),
  closeAllSduiSessions: vi.fn().mockResolvedValue(undefined),
}))

const changeLanguage = vi.fn().mockResolvedValue(undefined)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage },
  }),
}))

describe('useLanguageSwitch', () => {
  beforeEach(() => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(false)
    vi.mocked(closeAllSduiSessions).mockClear()
    changeLanguage.mockClear()
  })

  it('без несохранённых изменений: сразу CLOSE сессий → changeLanguage', async () => {
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.requestToggle())

    await waitFor(() => expect(changeLanguage).toHaveBeenCalledWith('kz'))
    expect(closeAllSduiSessions).toHaveBeenCalledTimes(1)
    // Порядок критичен: сначала закрыть сессии/кэш, потом менять язык
    expect(vi.mocked(closeAllSduiSessions).mock.invocationCallOrder[0]).toBeLessThan(
      changeLanguage.mock.invocationCallOrder[0],
    )
    expect(result.current.confirmOpen).toBe(false)
  })

  it('с несохранёнными изменениями: открывает confirm, ничего не переключает', () => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(true)
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.requestToggle())

    expect(result.current.confirmOpen).toBe(true)
    expect(closeAllSduiSessions).not.toHaveBeenCalled()
    expect(changeLanguage).not.toHaveBeenCalled()
  })

  it('confirmSwitch: закрывает диалог и переключает', async () => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(true)
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.requestToggle())
    act(() => result.current.confirmSwitch())

    await waitFor(() => expect(changeLanguage).toHaveBeenCalledWith('kz'))
    expect(result.current.confirmOpen).toBe(false)
  })

  it('cancelSwitch: закрывает диалог, язык не меняется', () => {
    vi.mocked(hasSduiUnsavedWork).mockReturnValue(true)
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.requestToggle())
    act(() => result.current.cancelSwitch())

    expect(result.current.confirmOpen).toBe(false)
    expect(changeLanguage).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx vitest run src/widgets/top-bar/lib/hooks/use-language-switch.test.tsx`
Expected: FAIL — `Cannot find module './use-language-switch'`.

- [ ] **Step 4: Реализация хука**

`src/widgets/top-bar/lib/hooks/use-language-switch.ts`:

```ts
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { closeAllSduiSessions, hasSduiUnsavedWork } from '@/features/sdui'

// Оркестрация переключения РУС/ҚАЗ (SCRUM-268): язык SDUI-формы фиксируется
// в form-session на OPEN, поэтому смена языка = CLOSE всех сессий + re-OPEN.
export function useLanguageSwitch() {
  const { i18n } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const performSwitch = async () => {
    setConfirmOpen(false)
    const nextLang = i18n.language === 'ru' ? 'kz' : 'ru'
    // Порядок критичен: CLOSE сессий и очистка кэша ДО changeLanguage —
    // иначе restore-ветка sdui-screen воскресит сессию на старом языке
    await closeAllSduiSessions()
    await i18n.changeLanguage(nextLang)
  }

  const requestToggle = () => {
    if (hasSduiUnsavedWork()) {
      setConfirmOpen(true)
      return
    }
    void performSwitch()
  }

  return {
    confirmOpen,
    requestToggle,
    confirmSwitch: () => void performSwitch(),
    cancelSwitch: () => setConfirmOpen(false),
  }
}
```

- [ ] **Step 5: Тест зелёный**

Run: `npx vitest run src/widgets/top-bar/lib/hooks/use-language-switch.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 6: Интеграция в top-bar**

`src/widgets/top-bar/ui/top-bar.tsx` — заменить локальный `toggleLanguage` на хук и добавить диалог:

```tsx
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import UserIcon from '@/shared/assets/icons/user.svg'
import MenuIcon from '@/shared/assets/icons/menu.svg'
import { Button } from '@/shared/ui/buttons'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog/confirm-dialog'

import { TOOLBAR_ACTIONS } from '../lib/consts/toolbar-actions'
import { useLanguageSwitch } from '../lib/hooks/use-language-switch'

const LANGUAGE_LABELS: Record<string, string> = {
  ru: 'РУС',
  kz: 'ҚАЗ',
}

export const TopBar = () => {
  const { t, i18n } = useTranslation()
  const { confirmOpen, requestToggle, confirmSwitch, cancelSwitch } =
    useLanguageSwitch()
```

Кнопка языка: `onClick={requestToggle}` (вместо `toggleLanguage`; функцию `toggleLanguage` удалить). Перед закрывающим `</div>` корневого элемента добавить:

```tsx
      <ConfirmDialog
        open={confirmOpen}
        title={t('languageSwitchDialog.title')}
        message={t('languageSwitchDialog.message')}
        confirmLabel={t('languageSwitchDialog.confirm')}
        cancelLabel={t('actions.cancel')}
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />
```

(`LANGUAGE_LABELS` — не переводимый текст, а названия языков; остаются как есть.)

- [ ] **Step 7: Полный прогон тестов и коммит**

Run: `npx vitest run`
Expected: PASS (весь набор).

```bash
git add src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json src/widgets/top-bar/lib/hooks/use-language-switch.ts src/widgets/top-bar/lib/hooks/use-language-switch.test.tsx src/widgets/top-bar/ui/top-bar.tsx
git commit -m "feat: переключение языка с confirm и пересозданием SDUI-сессий (SCRUM-268)"
```

---

### Task 7: Ручная приёмка по критериям спеки

Бэкенд из ветки `talgat/SCRUM-268` (webbuh): `docker compose up -d db && ./mvnw spring-boot:run -pl webbuh-api`. Фронт: `npm run dev`. DevTools → Network, фильтр `/api/view`.

- [ ] Каждый `/api/view` в трейсе несёт `language` (`"Ru"` или `"Kz"`).
- [ ] Открыть SDUI-форму (Заявка ГП или ЭСФ) → переключить на ҚАЗ → форма переоткрывается: командная панель «Өткізу және жабу | Жазу | Өткізу | Дт/Кт | Қазынашылыққа жүктеп шығару | Басып шығару | Есептер | Тағы», лейблы полей казахские (где есть nameKz; иначе русский, пустых нет).
- [ ] `formSessionId` в OPEN-ответе до и после переключения разные; в трейсе есть CLOSE старой сессии.
- [ ] Обратно на РУС → всё русское, без стейл-кэша.
- [ ] Открыть 2+ документа во вкладках, переключить язык, походить по вкладкам — RU-сессии из кэша не воскресают (каждый возврат на вкладку даёт свежий OPEN с новым языком).
- [ ] Изменить поле формы (dirty, `*` на вкладке) → переключить язык → confirm-диалог; «Отмена» — язык не изменился, форма живая; «Переключить» — CLOSE всех сессий, re-OPEN на новом языке.
- [ ] Без несохранённых изменений диалог не показывается.
- [ ] Уйти с dirty SDUI-формы на легаси-страницу (вкладка закрыта) → переключение языка НЕ показывает confirm (стейл dirty сброшен).

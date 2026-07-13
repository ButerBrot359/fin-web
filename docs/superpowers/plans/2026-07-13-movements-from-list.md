# Движения документа из списка + chrome панели — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ДтКт из формы списка открывает движения той же SDUI workspace-вкладкой, что и из формы (`GET /api/view/movements/{entryId}`); панельная вкладка получает заголовок «Движения документа: {название}» и стрелки назад/вперёд.

**Architecture:** Логика `openDialog`-эффекта выносится из `dispatch.ts` в переиспользуемую `openDialogAsPanel`; session-less функция `openMovementsForEntry` (fetch + эффекты) экспортируется из barrel `@/features/sdui` и вызывается toolbar-ом списка через `useMutation`. Chrome панели рендерится на app-уровне в `layout.tsx` (`PageHeader` с `onBack`); закрытие вкладки — через новую утилиту `performTabClose` в `features/workspace-tabs` (DRY с `workspace-tab-bar`).

**Tech Stack:** React 19, TypeScript 5.9, Zustand, TanStack Query (useMutation), vitest + @testing-library/react.

**Спека:** `docs/superpowers/specs/2026-07-13-movements-from-list-design.md` (исходная спека бэка: `docs/superpowers/plans/frontend-spec-movements-from-list-and-title.md`).

## Global Constraints

- Ветка: `feat/sdui-movements-from-list` (уже создана от `feat/sdui-reference-cell`). Коммиты по формату `feat|fix|add|refactor: описание` (commit-msg hook). В конце — push, **PR не открывать**.
- НЕ запускать `tsc --noEmit`, `npm run lint`, `npm run build`. Только целевые vitest-прогоны (`npx vitest run <файл>`).
- Тексты в JSX — только через `useTranslation` и ключи `common.json` (ru + kz). Заголовок панели НЕ хардкодить — он приходит с бэка в `props.title`.
- Не использовать `useMemo`/`useCallback` в новом коде.
- Изоляция SDUI/легаси: единственный согласованный мост — импорт barrel-экспорта `@/features/sdui` из `src/widgets/document-list-toolbar` (одобрено владельцем в спеке). Никаких других импортов между мирами не добавлять.
- Legacy НЕ удалять: `document-movements-page.tsx`, `document-movements-api.ts`, роут `.../movements` в `App.tsx` остаются (cleanup вне scope).
- Поведение `showDtKt` из формы измениться не должно (рефакторинг dispatch — без изменения поведения).
- Vitest-тесты: без jest-dom (ассерты `toBeTruthy()`/`toBeNull()`/`toEqual`), `afterEach(cleanup)` при рендере компонентов.

---

### Task 1: `openDialogAsPanel` — вынос openDialog-логики из dispatch

**Files:**
- Create: `src/features/sdui/lib/open-dialog-panel.ts`
- Modify: `src/features/sdui/lib/dispatch.ts:14-17,44-87`
- Test: `src/features/sdui/lib/open-dialog-panel.test.ts`

**Interfaces:**
- Consumes: `usePanelStore`/`PanelEntry` (`./stores/panel-store`), `openPanelTab` (`./workspace-tab-gateway`), `ViewEffect` (`../types/view`).
- Produces: `openDialogAsPanel(effect: ViewEffect, parentSessionId?: string): void` — Task 2 вызывает её без `parentSessionId`.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/lib/open-dialog-panel.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewEffect } from '../types/view'
import { usePanelStore } from './stores/panel-store'
import { setWorkspaceTabGateway } from './workspace-tab-gateway'
import { openDialogAsPanel } from './open-dialog-panel'

const makeEffect = (overrides: Partial<ViewEffect> = {}): ViewEffect => ({
  type: 'openDialog',
  node: {
    id: 'dialog.movements',
    type: 'PAGE',
    props: {
      title: 'Движения документа: ПКО AAY00-00034',
      presentation: 'page',
      openInWorkspaceTab: true,
      tabKey: 'movements:27856464',
    },
  },
  childState: { 'movements.acc.Zhurnal': [{ id: 1 }] },
  ...overrides,
})

describe('openDialogAsPanel', () => {
  const openPanelTabMock = vi.fn()

  beforeEach(() => {
    usePanelStore.setState({ panels: [] })
    openPanelTabMock.mockClear()
    setWorkspaceTabGateway({ openPanelTab: openPanelTabMock })
  })

  afterEach(() => {
    setWorkspaceTabGateway(null)
  })

  it('openInWorkspaceTab: зовёт gateway и кладёт панель с tabKey', () => {
    openDialogAsPanel(makeEffect())

    expect(openPanelTabMock).toHaveBeenCalledWith({
      tabKey: 'movements:27856464',
      title: 'Движения документа: ПКО AAY00-00034',
      panelId: 'dialog.movements',
    })
    const panel = usePanelStore.getState().panels[0]
    expect(panel.openInWorkspaceTab).toBe(true)
    expect(panel.tabKey).toBe('movements:27856464')
    expect(panel.presentation).toBe('page')
    expect(panel.viewState).toEqual({ 'movements.acc.Zhurnal': [{ id: 1 }] })
    expect(panel.session).toBeUndefined()
  })

  it('повторное открытие того же tabKey заменяет панель, а не дублирует', () => {
    openDialogAsPanel(makeEffect())
    openDialogAsPanel(makeEffect({ childState: { fresh: [] } }))

    const panels = usePanelStore.getState().panels
    expect(panels).toHaveLength(1)
    expect(panels[0].viewState).toEqual({ fresh: [] })
  })

  it('с sessionId создаёт session c parentSessionId', () => {
    openDialogAsPanel(
      makeEffect({ sessionId: 'child-1', childRevision: 3 }),
      'parent-1',
    )

    expect(usePanelStore.getState().panels[0].session).toEqual({
      formSessionId: 'child-1',
      revision: 3,
      parentSessionId: 'parent-1',
      targetNodeId: undefined,
    })
  })

  it('без gateway панель падает в fallback без openInWorkspaceTab', () => {
    setWorkspaceTabGateway(null)

    openDialogAsPanel(makeEffect())

    const panel = usePanelStore.getState().panels[0]
    expect(panel.openInWorkspaceTab).toBeUndefined()
    expect(panel.tabKey).toBeUndefined()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/open-dialog-panel.test.ts`
Expected: FAIL — модуль `open-dialog-panel` не найден.

- [ ] **Step 3: Создать `open-dialog-panel.ts`**

Код — дословный перенос колбэка `openDialog` из `dispatch.ts:47-82` (единственное изменение — `parentSessionId` приходит параметром):

```ts
import type { ViewEffect } from '../types/view'
import { usePanelStore, type PanelEntry } from './stores/panel-store'
import { openPanelTab } from './workspace-tab-gateway'

// Превращает openDialog-эффект в PanelEntry (и workspace-вкладку, если
// props.openInWorkspaceTab). Вынесено из dispatch.ts, чтобы session-less
// путь (движения из формы списка, open-movements.ts) шёл тем же кодом.
export function openDialogAsPanel(
  effect: ViewEffect,
  parentSessionId?: string,
): void {
  const props = effect.node?.props
  const presentation = (props?.presentation as string) ?? 'modal'
  const panelId = effect.node?.id ?? String(Date.now())
  const tabKey = props?.tabKey as string | undefined
  // page-панель с openInWorkspaceTab уходит в workspace-вкладку.
  // Если gateway не забинден — openPanelTab вернёт false и панель
  // откатится на прежний fullScreen Dialog.
  const inTab =
    props?.openInWorkspaceTab === true &&
    typeof tabKey === 'string' &&
    openPanelTab({
      tabKey,
      title: (props?.title as string | undefined) ?? '',
      panelId,
    })
  const entry: PanelEntry = {
    panelId,
    node: effect.node!,
    presentation: presentation as 'drawer' | 'modal' | 'page',
    viewState: effect.childState ?? {},
    ...(inTab ? { openInWorkspaceTab: true, tabKey } : {}),
  }
  if (effect.sessionId) {
    entry.session = {
      formSessionId: effect.sessionId,
      revision: effect.childRevision ?? 0,
      parentSessionId,
      targetNodeId: undefined,
    }
  }
  // Повторное открытие того же документа (тот же tabKey → тот же node.id):
  // свежий PanelEntry с новым childState заменяет старый.
  if (inTab) usePanelStore.getState().remove(panelId)
  usePanelStore.getState().push(entry)
}
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/features/sdui/lib/open-dialog-panel.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Переключить dispatch.ts на новую функцию**

В `src/features/sdui/lib/dispatch.ts`:

1. Импорты: строку `import { usePanelStore, type PanelEntry } from './stores/panel-store'` заменить на `import { usePanelStore } from './stores/panel-store'` (тип `PanelEntry` больше не нужен); удалить `import { openPanelTab } from './workspace-tab-gateway'`; добавить `import { openDialogAsPanel } from './open-dialog-panel'`.
2. Колбэк `openDialog` в `createEffectHandler` (строки 47-82) заменить целиком на:

```ts
        openDialog: (effect) => {
          openDialogAsPanel(effect, session.getSession().formSessionId ?? undefined)
        },
```

`usePanelStore` в dispatch остаётся — он используется в колбэке `closeDialog`.

- [ ] **Step 6: Прогнать все тесты sdui (регрессия)**

Run: `npx vitest run src/features/sdui`
Expected: PASS, ни один существующий тест не сломан.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/lib/open-dialog-panel.ts src/features/sdui/lib/open-dialog-panel.test.ts src/features/sdui/lib/dispatch.ts
git commit -m "refactor: вынос openDialog-эффекта в openDialogAsPanel"
```

---

### Task 2: `fetchMovementsView` + `openMovementsForEntry` + barrel-экспорт

**Files:**
- Create: `src/features/sdui/api/movements-api.ts`
- Create: `src/features/sdui/lib/open-movements.ts`
- Modify: `src/features/sdui/index.ts`
- Test: `src/features/sdui/lib/open-movements.test.ts`

**Interfaces:**
- Consumes: `openDialogAsPanel(effect: ViewEffect, parentSessionId?: string): void` из Task 1 (`./open-dialog-panel`); `apiService.get` из `@/shared/api/api`; `showToast(level, message)` из `@/shared/ui/toast/show-toast`.
- Produces: `openMovementsForEntry(entryId: string): Promise<void>` — экспорт из `@/features/sdui`, Task 3 вызывает из toolbar.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/lib/open-movements.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewResponse } from '../types/view'
import { fetchMovementsView } from '../api/movements-api'
import { openDialogAsPanel } from './open-dialog-panel'
import { openMovementsForEntry } from './open-movements'

vi.mock('../api/movements-api', () => ({ fetchMovementsView: vi.fn() }))
vi.mock('./open-dialog-panel', () => ({ openDialogAsPanel: vi.fn() }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const mockFetch = vi.mocked(fetchMovementsView)

const makeResponse = (effects: ViewResponse['effects']): ViewResponse => ({
  formSessionId: '',
  revision: 0,
  effects,
})

describe('openMovementsForEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('openDialog-эффект уходит в openDialogAsPanel без parentSessionId', async () => {
    const effect = {
      type: 'openDialog' as const,
      node: { id: 'dialog.movements', type: 'PAGE' as const },
    }
    mockFetch.mockResolvedValue(makeResponse([effect]))

    await openMovementsForEntry('123')

    expect(mockFetch).toHaveBeenCalledWith('123')
    expect(openDialogAsPanel).toHaveBeenCalledWith(effect)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('notify-эффект показывает toast и не открывает панель', async () => {
    mockFetch.mockResolvedValue(
      makeResponse([
        { type: 'notify' as const, level: 'warning', message: 'Нет движений' },
      ]),
    )

    await openMovementsForEntry('123')

    expect(showToast).toHaveBeenCalledWith('warning', 'Нет движений')
    expect(openDialogAsPanel).not.toHaveBeenCalled()
  })

  it('пустые effects — ничего не делает', async () => {
    mockFetch.mockResolvedValue(makeResponse(undefined))

    await openMovementsForEntry('123')

    expect(openDialogAsPanel).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })
})
```

Примечание: если union `EffectType`/`NodeType` не совпадёт с литералами — поправить литералы по `src/features/sdui/types/node-types.ts`, не менять типы.

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/lib/open-movements.test.ts`
Expected: FAIL — модули `movements-api` / `open-movements` не найдены.

- [ ] **Step 3: Создать `api/movements-api.ts`**

```ts
import { apiService } from '@/shared/api/api'

import type { ViewResponse } from '../types/view'

// Session-less движения документа (спека §2.1): тот же ViewResponseDto,
// что и POST /api/view, но formSessionId = null, всё в effects[0].
export const fetchMovementsView = async (
  entryId: string,
): Promise<ViewResponse> => {
  const res = await apiService.get<ViewResponse>({
    url: `/api/view/movements/${entryId}`,
  })
  return res.data
}
```

- [ ] **Step 4: Создать `lib/open-movements.ts`**

```ts
import { showToast } from '@/shared/ui/toast/show-toast'

import { fetchMovementsView } from '../api/movements-api'
import { openDialogAsPanel } from './open-dialog-panel'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

// ДтКт из формы списка: session-less GET /api/view/movements/{id} →
// openDialog-эффект → workspace-вкладка тем же путём, что showDtKt из формы.
// По контракту бэка эффект один: openDialog либо notify (нет движений /
// документ не найден) — панель в этом случае не открывается.
export async function openMovementsForEntry(entryId: string): Promise<void> {
  const res = await fetchMovementsView(entryId)
  for (const effect of res.effects ?? []) {
    if (effect.type === 'openDialog') {
      openDialogAsPanel(effect)
    } else if (effect.type === 'notify') {
      showToast((effect.level as ToastLevel) ?? 'info', effect.message ?? '')
    }
  }
}
```

- [ ] **Step 5: Добавить barrel-экспорт**

В `src/features/sdui/index.ts` добавить строку:

```ts
export { openMovementsForEntry } from './lib/open-movements'
```

- [ ] **Step 6: Прогнать тест**

Run: `npx vitest run src/features/sdui/lib/open-movements.test.ts`
Expected: PASS (3/3).

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/api/movements-api.ts src/features/sdui/lib/open-movements.ts src/features/sdui/lib/open-movements.test.ts src/features/sdui/index.ts
git commit -m "feat: session-less открытие движений документа (GET /api/view/movements)"
```

---

### Task 3: ДтКт в toolbar списка → SDUI-вкладка вместо legacy-роута

**Files:**
- Modify: `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx:121-130,152-159`
- Modify: `src/app/config/i18n/locales/ru/common.json` (секция `documentListToolbar`, строки 80-88)
- Modify: `src/app/config/i18n/locales/kz/common.json` (секция `documentListToolbar`, строки 80-88)

**Interfaces:**
- Consumes: `openMovementsForEntry(entryId: string): Promise<void>` из `@/features/sdui` (Task 2). Этот импорт — согласованный мост легаси-виджета в SDUI (Global Constraints).
- Produces: ничего для следующих задач.

Тестов на toolbar нет (компонент завязан на роутер/квери-клиент, unit-тестов у widget-ов в проекте нет) — проверка через тесты Task 2 + ручная приёмка.

- [ ] **Step 1: i18n-ключи**

В `src/app/config/i18n/locales/ru/common.json` в объект `documentListToolbar` (после `"unpostError": "Ошибка отмены проведения"`) добавить:

```json
    "movementsError": "Не удалось загрузить движения документа"
```

В `src/app/config/i18n/locales/kz/common.json` там же:

```json
    "movementsError": "Құжат қозғалыстарын жүктеу мүмкін болмады"
```

(Не забыть запятую после `unpostError` в обоих файлах.)

- [ ] **Step 2: Заменить navigate на useMutation**

В `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx`:

1. Добавить импорт (после существующих импортов из `@/entities/document-entry`):

```ts
import { openMovementsForEntry } from '@/features/sdui'
```

2. После объявления `unpostMutation` (строка 73) добавить:

```ts
  // ДтКт: движения открываются SDUI workspace-вкладкой (паритет с формой),
  // legacy-роут .../movements больше не используется.
  const movementsMutation = useMutation({
    mutationFn: (id: number) => openMovementsForEntry(String(id)),
    onError: () => {
      showToast('error', t('documentListToolbar.movementsError'))
    },
  })
```

3. Заменить `handleMovements` (строки 121-130) на:

```ts
  const handleMovements = () => {
    if (selectedRowId == null) return
    movementsMutation.mutate(selectedRowId)
  }
```

4. У кнопки ДтКт (строки 153-159) заменить `disabled={selectedRowId == null}` на:

```tsx
              disabled={selectedRowId == null || movementsMutation.isPending}
```

- [ ] **Step 3: Прогнать тесты sdui (barrel не сломан)**

Run: `npx vitest run src/features/sdui`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: ДтКт из списка открывает SDUI-вкладку движений вместо legacy-страницы"
```

---

### Task 4: `performTabClose` — переиспользуемое закрытие workspace-вкладки

**Files:**
- Create: `src/features/workspace-tabs/lib/utils/perform-tab-close.ts`
- Modify: `src/features/workspace-tabs/index.ts`
- Modify: `src/widgets/workspace-tab-bar/ui/workspace-tab-bar.tsx:14-32,57-70`
- Test: `src/features/workspace-tabs/lib/utils/perform-tab-close.test.ts`

**Interfaces:**
- Consumes: `useWorkspaceTabsStore`, `useFormCacheStore`, `notifyPanelTabClose` (внутри `features/workspace-tabs`).
- Produces: `performTabClose(tabId: string, navigate: NavigateFunction): void` — экспорт из `@/features/workspace-tabs`; Task 5 зовёт её из layout для кнопок «назад»/крестик панели.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/workspace-tabs/lib/utils/perform-tab-close.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NavigateFunction } from 'react-router-dom'

import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import { onPanelTabClose } from '../panel-tab-close-registry'
import { performTabClose } from './perform-tab-close'

const navigate = vi.fn() as unknown as NavigateFunction

describe('performTabClose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('панельная вкладка: уведомляет реестр и навигирует на соседнюю роут-вкладку', () => {
    useWorkspaceTabsStore.setState({
      tabs: [
        {
          id: '/list',
          path: '/list',
          search: '?a=1',
          title: 'Список',
          pageType: 'document-list',
          createdAt: 1,
        },
        {
          id: 'movements:1',
          path: '',
          search: '',
          title: 'Движения',
          pageType: 'sdui-panel',
          panelId: 'p-1',
          createdAt: 2,
        },
      ],
      activeTabId: 'movements:1',
    })
    const closedPanels: string[] = []
    const unsubscribe = onPanelTabClose((panelId) => closedPanels.push(panelId))

    performTabClose('movements:1', navigate)

    expect(closedPanels).toEqual(['p-1'])
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(1)
    expect(navigate).toHaveBeenCalledWith('/list?a=1')
    unsubscribe()
  })

  it('последняя вкладка: навигация на корень', () => {
    useWorkspaceTabsStore.setState({
      tabs: [
        {
          id: 'movements:1',
          path: '',
          search: '',
          title: 'Движения',
          pageType: 'sdui-panel',
          panelId: 'p-1',
          createdAt: 1,
        },
      ],
      activeTabId: 'movements:1',
    })

    performTabClose('movements:1', navigate)

    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(0)
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('закрытие неактивной вкладки: без навигации', () => {
    useWorkspaceTabsStore.setState({
      tabs: [
        {
          id: '/list',
          path: '/list',
          search: '',
          title: 'Список',
          pageType: 'document-list',
          createdAt: 1,
        },
        {
          id: 'movements:1',
          path: '',
          search: '',
          title: 'Движения',
          pageType: 'sdui-panel',
          panelId: 'p-1',
          createdAt: 2,
        },
      ],
      activeTabId: '/list',
    })

    performTabClose('movements:1', navigate)

    expect(navigate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/workspace-tabs/lib/utils/perform-tab-close.test.ts`
Expected: FAIL — модуль `perform-tab-close` не найден.

- [ ] **Step 3: Создать `perform-tab-close.ts`**

Логика — перенос `performClose` + `navigateAfterClose` из `workspace-tab-bar.tsx:14-32,57-70` (без dirty-проверки — она остаётся в tab-bar):

```ts
import type { NavigateFunction } from 'react-router-dom'

import { notifyPanelTabClose } from '../panel-tab-close-registry'
import { useFormCacheStore } from '../hooks/use-form-cache-store'
import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'

// Закрытие workspace-вкладки без dirty-проверки: снятие кэша формы,
// уведомление владельца панели (SDUI → panel-store.remove) и активация
// соседней вкладки. Используется tab-bar-ом и chrome панельной вкладки
// (layout: «назад»/крестик на странице движений).
export function performTabClose(
  tabId: string,
  navigate: NavigateFunction,
): void {
  const store = useWorkspaceTabsStore.getState()
  const tab = store.tabs.find((t) => t.id === tabId)
  if (!tab) return

  const isPanel = tab.pageType === 'sdui-panel'
  // У панельных вкладок нет кэша формы
  if (!isPanel) useFormCacheStore.getState().removeTab(tabId)

  const wasActive = store.activeTabId === tabId
  const closed = store.closeTab(tabId)
  if (isPanel && closed?.panelId) notifyPanelTabClose(closed.panelId)
  if (!wasActive) return

  const remaining = useWorkspaceTabsStore.getState()
  const nextTab =
    remaining.tabs.find((t) => t.id === remaining.activeTabId) ??
    remaining.tabs[0]
  if (!nextTab) {
    void navigate('/')
    return
  }
  if (nextTab.pageType === 'sdui-panel') {
    // Панельная вкладка живёт вне роутера — активируем без навигации
    remaining.setActiveTab(nextTab.id)
    return
  }
  void navigate(nextTab.path + nextTab.search)
}
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/features/workspace-tabs/lib/utils/perform-tab-close.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Экспорт из barrel**

В `src/features/workspace-tabs/index.ts` добавить:

```ts
export { performTabClose } from './lib/utils/perform-tab-close'
```

- [ ] **Step 6: Переключить workspace-tab-bar на утилиту**

В `src/widgets/workspace-tab-bar/ui/workspace-tab-bar.tsx`:

1. Импорт из `@/features/workspace-tabs` заменить на:

```ts
import {
  useWorkspaceTabsStore,
  useFormCacheStore,
  performTabClose,
} from '@/features/workspace-tabs'
```

(`notifyPanelTabClose` больше не нужен.)

2. Удалить функцию `navigateAfterClose` (строки 14-32).
3. Заменить `performClose` (строки 57-70) на:

```ts
  const performClose = (tabId: string) => {
    performTabClose(tabId, navigate)
  }
```

4. Удалить неиспользуемый селектор `const closeTab = useWorkspaceTabsStore((s) => s.closeTab)` (строка 39). `useFormCacheStore` остаётся — используется в `handleClose`/`handleDialogSave`.

- [ ] **Step 7: Прогнать тесты workspace-tabs (регрессия)**

Run: `npx vitest run src/features/workspace-tabs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/workspace-tabs/lib/utils/perform-tab-close.ts src/features/workspace-tabs/lib/utils/perform-tab-close.test.ts src/features/workspace-tabs/index.ts src/widgets/workspace-tab-bar/ui/workspace-tab-bar.tsx
git commit -m "refactor: вынос закрытия workspace-вкладки в performTabClose"
```

---

### Task 5: Chrome панельной вкладки — заголовок + стрелки (баг #2)

**Files:**
- Modify: `src/features/navigation-buttons/ui/navigation-buttons.tsx`
- Modify: `src/widgets/page-header/ui/page-header.tsx:11-16,31`
- Modify: `src/app/layout/layout.tsx`
- Test: `src/features/navigation-buttons/ui/navigation-buttons.test.tsx`

**Interfaces:**
- Consumes: `performTabClose(tabId, navigate)` из `@/features/workspace-tabs` (Task 4); `PageHeader` из `@/widgets/page-header`; `WorkspacePanelHost` из `@/features/sdui`.
- Produces: `NavigationButtons({ onBack?: () => void })`, `PageHeader({ title, onClose?, onBack? })` — опциональные пропсы, без `onBack` поведение прежнее (`navigate(-1)`).

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/navigation-buttons/ui/navigation-buttons.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NavigationButtons } from './navigation-buttons'

// Без I18nextProvider useTranslation возвращает сам ключ — ищем по нему.
describe('NavigationButtons', () => {
  afterEach(cleanup)

  it('с onBack зовёт его по клику «назад»', () => {
    const onBack = vi.fn()
    render(
      <MemoryRouter>
        <NavigationButtons onBack={onBack} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'actions.back' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('кнопка «вперёд» disabled', () => {
    render(
      <MemoryRouter>
        <NavigationButtons />
      </MemoryRouter>,
    )

    const forward = screen.getByRole('button', {
      name: 'actions.forward',
    }) as HTMLButtonElement
    expect(forward.disabled).toBe(true)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/navigation-buttons/ui/navigation-buttons.test.tsx`
Expected: FAIL — у `NavigationButtons` нет пропа `onBack` (TS) / `onBack` не вызывается.

- [ ] **Step 3: Проп `onBack` в NavigationButtons**

Заменить содержимое `src/features/navigation-buttons/ui/navigation-buttons.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { IconButton } from '@mui/material'
import { useTranslation } from 'react-i18next'

import ArrowLeftIcon from '@/shared/assets/navigation/arrow-left-default.svg'
import ArrowRightIcon from '@/shared/assets/navigation/arrow-right-default.svg'

interface NavigationButtonsProps {
  // Панельная workspace-вкладка живёт вне роутера: «назад» там — закрытие
  // вкладки, а не navigate(-1). Без пропа поведение прежнее.
  onBack?: () => void
}

export const NavigationButtons = ({ onBack }: NavigationButtonsProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleBack = async () => {
    if (onBack) {
      onBack()
      return
    }
    await navigate(-1)
  }

  return (
    <div className="flex items-center">
      <IconButton aria-label={t('actions.back')} onClick={handleBack}>
        <ArrowLeftIcon className="h-5 w-5" />
      </IconButton>
      <IconButton aria-label={t('actions.forward' as never)} disabled>
        <ArrowRightIcon className="h-5 w-5" />
      </IconButton>
    </div>
  )
}
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/features/navigation-buttons/ui/navigation-buttons.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Прокинуть `onBack` через PageHeader**

В `src/widgets/page-header/ui/page-header.tsx`:

1. Интерфейс:

```ts
interface PageHeaderProps {
  title: string
  onClose?: () => void
  onBack?: () => void
}
```

2. Сигнатура: `export const PageHeader = ({ title, onClose, onBack }: PageHeaderProps) => {`
3. Строка 31: `<NavigationButtons />` → `<NavigationButtons onBack={onBack} />`

- [ ] **Step 6: Chrome панели в layout**

Заменить содержимое `src/app/layout/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { WorkspacePanelHost } from '@/features/sdui'
import { performTabClose, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { WorkspaceTabBar } from '@/widgets/workspace-tab-bar'

interface LayoutProps {
  sidebar: ReactNode
  header?: ReactNode
  children?: ReactNode
}

export const Layout = ({ sidebar, header, children }: LayoutProps) => {
  const navigate = useNavigate()
  // Активная вкладка типа 'sdui-panel'; undefined — обычная вкладка/нет вкладок
  const activePanelTab = useWorkspaceTabsStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId)
    return tab?.pageType === 'sdui-panel' ? tab : undefined
  })

  const handleClosePanelTab = () => {
    if (activePanelTab) performTabClose(activePanelTab.id, navigate)
  }

  return (
    <div className="flex h-screen w-full bg-ui-06">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col rounded-tl-4xl rounded-bl-4xl bg-ui-02 p-8 pb-0">
        <header>{header}</header>
        <main className="min-h-0 flex-1 overflow-auto">
          {/* Роут-контент прячем классом, НЕ размонтируем: форма документа
              под панельной вкладкой должна пережить переключение (спека §2.4) */}
          <div className={activePanelTab ? 'hidden' : 'h-full'}>{children}</div>
          {activePanelTab?.panelId && (
            <div className="flex h-full min-h-0 flex-col">
              {/* Chrome панельной вкладки (баг #2): заголовок = props.title
                  от бэка («Движения документа: {название}»), «назад» и
                  крестик закрывают вкладку — роут под панелью не менялся,
                  navigate(-1) тут не годится. */}
              <PageHeader
                title={activePanelTab.title}
                onBack={handleClosePanelTab}
                onClose={handleClosePanelTab}
              />
              <div className="min-h-0 flex-1 overflow-auto">
                <WorkspacePanelHost panelId={activePanelTab.panelId} />
              </div>
            </div>
          )}
        </main>
        <WorkspaceTabBar />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Полный прогон тестов**

Run: `npx vitest run`
Expected: PASS, регрессий нет.

- [ ] **Step 8: Commit и push ветки**

```bash
git add src/features/navigation-buttons/ui/navigation-buttons.tsx src/features/navigation-buttons/ui/navigation-buttons.test.tsx src/widgets/page-header/ui/page-header.tsx src/app/layout/layout.tsx
git commit -m "feat: заголовок и стрелки навигации у панельной workspace-вкладки движений"
git push -u origin feat/sdui-movements-from-list
```

---

## Ручная приёмка (после всех задач, на стенде)

1. **#1**: ДтКт из списка на проведённом документе → workspace-вкладка движений с непустыми проводками (ДЕБЕТ/КРЕДИТ, форматирование, ссылочные ячейки) — идентично открытию из формы.
2. **#1**: непроведённый / не найденный документ → toast warning, вкладка не создаётся.
3. **#2**: заголовок панели «Движения документа: {название}», стрелки назад/вперёд в шапке; «назад» и крестик возвращают к списку/форме.
4. **#3**: нижняя вкладка называется «Движения документа: {название}»; повторное открытие (из списка и из формы) переиспользует вкладку, дублей нет.

# SCRUM-265: иконка «Вывести иерархию», childState-панели, «Назад» на опенер, basisId — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SDUI-кнопки командной панели документа с `icon`/`tooltip`, непустые childState-панели без сессии, «Назад» с панельной вкладки на вкладку-опенер, поддержка `?basisId=` в легаси-форме нового документа.

**Architecture:** 4 независимых WI: WI-B (SDUI `ButtonNode` + новый inline-SVG реестр), WI-C (обёртка `PanelStateProvider` в `DialogHost`), WI-D′ (`openerTabId` + `performTabBack` в общей фиче `workspace-tabs` + `layout.tsx`), WI-E (зеркалирование `VidOperatsii`-плюмбинга для `basisId` в легаси-хуке). Бэкенд-контракт уже в проде.

**Tech Stack:** React 19, TypeScript, MUI (Button/Tooltip/Menu), Zustand, TanStack Query, vitest + Testing Library.

**Дизайн-док:** `docs/superpowers/specs/2026-07-13-scrum-265-basis-buttons-design.md`. **Ветка:** `feat/sdui-scrum-265` (уже создана от `feat/sdui-movements-from-list`, дизайн-док закоммичен).

## Global Constraints

- Изоляция SDUI/легаси: WI-B, WI-C — только `src/features/sdui/`; WI-E — только легаси-файл; WI-D′ — общая фича `workspace-tabs` + `app/layout`, не должна ломать ни один мир. Никаких новых gateway и прямых импортов SDUI↔легаси.
- **Не добавлять i18n-ключей** (WI-A спеки отброшен, YAGNI): tooltip приходит локализованным с бэка, PageHeader уже переводится своими ключами.
- Никаких `useMemo`/`useCallback` без явной perf-причины (правило пользователя).
- Коммиты: формат `feat|fix|add|refactor: описание` (commit-msg hook); по одному коммиту на WI, сообщения — точно как в задачах ниже.
- Тесты: vitest, русские имена `it(...)`, `const navigate = vi.fn() as unknown as NavigateFunction`, сброс zustand-сторов в `beforeEach` через `setState`.
- Финальные проверки обязательны (спека §5, перекрывает дефолт CLAUDE.md «не гонять проверки»): `npx vitest run` весь зелёный, `npx tsc --noEmit` → 0, `npx eslint` чистый **по изменённым файлам** (в репо есть pre-existing lint-ошибки в чужих файлах — их не трогать).
- Комментарии в коде — по-русски, в стиле существующих (объясняют «почему»).
- Push в конце (после финального ревью), **без PR**.

---

### Task 1: WI-B — SDUI BUTTON рендерит `props.icon` и `props.tooltip`

**Files:**
- Create: `src/features/sdui/ui/nodes/action/button-icons.tsx`
- Modify: `src/features/sdui/ui/nodes/action/button-node.tsx`
- Test: `src/features/sdui/ui/nodes/action/button-node.test.tsx` (новый)

**Interfaces:**
- Consumes: `NodeProps` из `../../../types/view`; `useSduiDispatch`; ref-picker store; `NodeRenderer`.
- Produces: `resolveButtonIcon(name: string | undefined): ReactNode | null` (экспорт из `button-icons.tsx`; неизвестное имя → `null`). Ни одна другая задача от этого не зависит.

Текущий `button-node.tsx` (71 строка) читает `label`/`command`/`enabled`/`variant`, имеет dropdown-режим (`variant === 'dropdown'` + `node.children` → MUI `Menu`) и selected-row логику (`needsSelectedRow`). Всё это сохраняется без изменений — меняется только рендер кнопки.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/ui/nodes/action/button-node.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ButtonNode } from './button-node'

const dispatch = vi.fn()

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
}))

vi.mock('../../../lib/stores/ref-picker-selection-store', () => ({
  needsSelectedRow: () => false,
  refCommandField: () => null,
  useRefPickerSelection: () => null,
}))

vi.mock('../../node-renderer', () => ({
  NodeRenderer: () => null,
}))

const button = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'b1', type: 'BUTTON', props }) as ViewNode

describe('ButtonNode: icon и tooltip', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('icon-only: inline svg, accessible name = tooltip', () => {
    const { container } = render(
      <ButtonNode
        node={button({
          command: 'showRelatedDocuments',
          icon: 'related-hierarchy',
          tooltip: 'Вывести иерархию',
        })}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Вывести иерархию' }),
    ).toBeTruthy()
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('hover по кнопке с tooltip показывает role="tooltip"', async () => {
    render(
      <ButtonNode
        node={button({
          command: 'showRelatedDocuments',
          icon: 'related-hierarchy',
          tooltip: 'Вывести иерархию',
        })}
      />,
    )
    fireEvent.mouseOver(screen.getByRole('button'))
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })

  it('регресс: label-кнопка рендерит текст и диспатчит команду', () => {
    render(<ButtonNode node={button({ label: 'Провести', command: 'post' })} />)
    const btn = screen.getByRole('button', { name: 'Провести' })
    fireEvent.click(btn)
    expect(dispatch).toHaveBeenCalledWith({ type: 'COMMAND', command: 'post' })
  })

  it('неизвестная иконка: fallback на label, svg нет', () => {
    const { container } = render(
      <ButtonNode node={button({ icon: 'nope', label: 'Метка' })} />,
    )
    expect(screen.getByRole('button', { name: 'Метка' })).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('без label и без валидной иконки: fallback на command', () => {
    render(<ButtonNode node={button({ icon: 'nope', command: 'doIt' })} />)
    expect(screen.getByRole('button', { name: 'doIt' })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-node.test.tsx`
Expected: FAIL — иконочные тесты не находят svg/accessible name (реализации ещё нет). Если падает импорт `./button-icons` — это нормально, файла ещё нет; в таком случае тест «регресс: label-кнопка» тоже упадёт из-за модуля — допустимо.

- [ ] **Step 3: Создать `button-icons.tsx`** (код из спеки, как есть)

```tsx
import type { ReactNode } from 'react'

// Inline-SVG: строгий CSP панелей блокирует сетевые ассеты,
// поэтому глифы вшиты в код. Неизвестное имя → null (кнопка
// деградирует до текста, никогда не пустая).
const RelatedHierarchyIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="7.25" y="2.25" width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <rect x="2.25" y="13.75" width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <rect x="12.25" y="13.75" width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M10 6.25v3.5M10 9.75H5v4M10 9.75h5v4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const BUTTON_ICON_MAP: Record<string, () => ReactNode> = {
  'related-hierarchy': RelatedHierarchyIcon,
}

/** Иконка по имени или null для неизвестного (кнопка деградирует до текста). */
export function resolveButtonIcon(name: string | undefined): ReactNode | null {
  if (!name || !Object.hasOwn(BUTTON_ICON_MAP, name)) return null
  const Icon = BUTTON_ICON_MAP[name]
  return <Icon />
}
```

- [ ] **Step 4: Обновить `button-node.tsx`**

Полный новый текст файла (dropdown/selected-row логика идентична текущей):

```tsx
import { useState, type FC, type ReactNode } from 'react'
import { Button, Menu, Tooltip } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import {
  needsSelectedRow,
  refCommandField,
  useRefPickerSelection,
} from '../../../lib/stores/ref-picker-selection-store'
import { NodeRenderer } from '../../node-renderer'
import { resolveButtonIcon } from './button-icons'

export const ButtonNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const variantProp = node.props?.variant as string | undefined
  const iconName = node.props?.icon as string | undefined
  const tooltip = node.props?.tooltip as string | undefined

  const dispatch = useSduiDispatch()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const usesSelectedRow = needsSelectedRow(command)
  const selectedRowId = useRefPickerSelection(
    usesSelectedRow ? refCommandField(command) : null,
  )

  const isDropdown = variantProp === 'dropdown' && !!node.children?.length
  const muiVariant = variantProp === 'primary' ? 'contained' : 'outlined'
  const disabled = !enabled || (usesSelectedRow && selectedRowId == null)

  const icon = resolveButtonIcon(iconName)
  const isIconOnly = !!icon && !label
  // icon-only: глиф в line-box высоты текстовой строки (1.75em), иначе
  // голый 20px svg делает кнопку ~4px ниже соседних текстовых.
  const content: ReactNode = isIconOnly ? (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', height: '1.75em' }}
    >
      {icon}
    </span>
  ) : (
    // Неизвестная иконка → fallback: label, затем command (кнопка не пустая)
    (icon ?? label ?? command ?? '')
  )
  const ariaLabel = isIconOnly ? (tooltip ?? command ?? undefined) : undefined

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDropdown) {
      setMenuAnchor(e.currentTarget)
      return
    }
    if (command) {
      if (usesSelectedRow) {
        if (selectedRowId == null) return
        void dispatch({
          type: 'COMMAND',
          command,
          value: { id: selectedRowId },
          sourceNodeId: node.id,
        })
        return
      }
      void dispatch({ type: 'COMMAND', command })
    }
  }

  const buttonEl = (
    <Button
      variant={muiVariant}
      disabled={disabled}
      onClick={handleClick}
      aria-label={ariaLabel}
      sx={isIconOnly ? { minWidth: 0, px: 1 } : undefined}
    >
      {content}
    </Button>
  )

  return (
    <>
      {tooltip ? (
        // span-обёртка обязательна: без неё tooltip не работает на disabled-кнопке
        <Tooltip title={tooltip}>
          <span style={{ display: 'inline-flex' }}>{buttonEl}</span>
        </Tooltip>
      ) : (
        buttonEl
      )}
      {isDropdown && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
        </Menu>
      )}
    </>
  )
}
```

- [ ] **Step 5: Тесты зелёные**

Run: `npx vitest run src/features/sdui/ui/nodes/action/button-node.test.tsx`
Expected: PASS, 5/5.

- [ ] **Step 6: Коммит**

```bash
git add src/features/sdui/ui/nodes/action/button-icons.tsx src/features/sdui/ui/nodes/action/button-node.tsx src/features/sdui/ui/nodes/action/button-node.test.tsx
git commit -m "feat: SDUI-кнопка с иконкой и tooltip (related-hierarchy)"
```

---

### Task 2: WI-C — панель без сессии читает `childState`

**Files:**
- Modify: `src/features/sdui/ui/dialog-host.tsx:89-94`
- Test: `src/features/sdui/lib/panel-state-provider.test.tsx` (новый)

**Interfaces:**
- Consumes: `PanelStateProvider({ panel, children })` из `src/features/sdui/lib/panel-state-provider.tsx` (уже существует, НЕ создавать); `useSduiSession(): SduiSessionValue` из `src/features/sdui/lib/sdui-session-context.tsx:28`; `PanelEntry` из `src/features/sdui/lib/stores/panel-store.ts` (`{ panelId, node, presentation, viewState, session? … }`).
- Produces: ничего нового — только фикс рендера.

**Баг:** `DialogHost` рендерит панель без `session` голым `<NodeRenderer>` — биндинги не находят значений, диалог пустой.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/sdui/lib/panel-state-provider.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../types/view'
import { PanelStateProvider } from './panel-state-provider'
import { useSduiSession } from './sdui-session-context'
import type { PanelEntry } from './stores/panel-store'

const panel: PanelEntry = {
  panelId: 'p-1',
  node: { id: 'root', type: 'VSTACK' } as ViewNode,
  presentation: 'modal',
  viewState: { 'doc.name': 'Счёт №5' },
}

const Probe = () => {
  const session = useSduiSession()
  return <div>{String(session.getValue('doc.name'))}</div>
}

const MutatingProbe = () => {
  const session = useSduiSession()
  session.setValue('doc.name', 'Другой')
  return null
}

describe('PanelStateProvider (childState-панель без сессии)', () => {
  afterEach(cleanup)

  it('биндинг читает seed-значение из viewState', () => {
    render(
      <PanelStateProvider panel={panel}>
        <Probe />
      </PanelStateProvider>,
    )
    expect(screen.getByText('Счёт №5')).toBeTruthy()
  })

  it('setValue — warn + noop, не бросает', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      render(
        <PanelStateProvider panel={panel}>
          <MutatingProbe />
        </PanelStateProvider>,
      ),
    ).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
```

- [ ] **Step 2: Прогнать тест**

Run: `npx vitest run src/features/sdui/lib/panel-state-provider.test.tsx`
Expected: PASS сразу — `PanelStateProvider` уже существует и корректен. Это фиксация контракта (сам баг — в `DialogHost`, ниже). Если вдруг FAIL — разбираться, не менять провайдер под тест без диагностики.

- [ ] **Step 3: Фикс `dialog-host.tsx`**

Добавить импорт после существующих импортов из `../lib/…`:

```tsx
import { PanelStateProvider } from '../lib/panel-state-provider'
```

Заменить (строки 89–94):

```tsx
        const content = panel.session ? (
          <PanelFormProvider panel={panel} />
        ) : (
          // Панель без сессии: патчей не бывает, статичного снимка достаточно
          <NodeRenderer node={panel.node} />
        )
```

на:

```tsx
        const content = panel.session ? (
          <PanelFormProvider panel={panel} />
        ) : (
          // Панель без сессии (childState): патчей не бывает, но биндинги
          // должны читать значения из снимка viewState — без read-only
          // сессии диалог рендерится пустым.
          <PanelStateProvider panel={panel}>
            <NodeRenderer node={panel.node} />
          </PanelStateProvider>
        )
```

Ветку `if (panel.openInWorkspaceTab) return null`, `if (!panel.node) return null` и presentation-switch (page/drawer/modal) НЕ трогать.

- [ ] **Step 4: Тесты зелёные + smoke соседних**

Run: `npx vitest run src/features/sdui/lib/panel-state-provider.test.tsx src/features/sdui/ui/workspace-panel-host.test.tsx`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/sdui/ui/dialog-host.tsx src/features/sdui/lib/panel-state-provider.test.tsx
git commit -m "fix: childState-панели без сессии читают снимок значений"
```

---

### Task 3: WI-D′ — «Назад» с панельной вкладки на вкладку-опенер

**Files:**
- Modify: `src/features/workspace-tabs/types/workspace-tab.ts`
- Modify: `src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.ts:73-101` (`activateOrCreatePanel`)
- Create: `src/features/workspace-tabs/lib/utils/perform-tab-back.ts`
- Test: `src/features/workspace-tabs/lib/utils/perform-tab-back.test.ts` (новый)
- Modify: `src/features/workspace-tabs/index.ts`
- Modify: `src/app/layout/layout.tsx`

**Interfaces:**
- Consumes: `performTabClose(tabId: string, navigate: NavigateFunction): void` из `./perform-tab-close`; store-методы `setActiveTab(id)`, `tabs`, `activeTabId`.
- Produces: `WorkspaceTab.openerTabId?: string`; `performTabBack(tabId: string, navigate: NavigateFunction): void` (экспорт из барреля `@/features/workspace-tabs`).

Семантика: «Назад» активирует опенер, панель **остаётся** в нижнем баре; опенер закрыт/не найден → fallback `performTabClose` (предсказуемый выход вместо мёртвой кнопки). «✕» — прежний `performTabClose`.

- [ ] **Step 1: Тип — `openerTabId`**

В `src/features/workspace-tabs/types/workspace-tab.ts` в интерфейс `WorkspaceTab` после `panelId?: string` добавить:

```ts
  // Только для pageType 'sdui-panel': id вкладки, из которой панель открыта.
  // «Назад» возвращает на неё, оставляя панель в баре (SCRUM-265).
  openerTabId?: string
```

- [ ] **Step 2: Store — зафиксировать опенер при создании**

В `use-workspace-tabs-store.ts`, метод `activateOrCreatePanel` (строки 73–101):

1. Заменить `const { tabs } = get()` на `const { tabs, activeTabId } = get()`.
2. Ветка `existing` — БЕЗ изменений (reuse не перезаписывает `openerTabId`).
3. В литерал создаваемой вкладки после `panelId,` добавить:

```ts
          // Опенер фиксируется при создании; сама панель опенером быть не может
          openerTabId:
            activeTabId && activeTabId !== id ? activeTabId : undefined,
```

- [ ] **Step 3: Написать падающий тест**

Создать `src/features/workspace-tabs/lib/utils/perform-tab-back.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NavigateFunction } from 'react-router-dom'

import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import type { WorkspaceTab } from '../../types/workspace-tab'
import { performTabBack } from './perform-tab-back'

const navigate = vi.fn() as unknown as NavigateFunction

const routeTab = (id: string): WorkspaceTab => ({
  id,
  path: id,
  search: '?a=1',
  title: 'Документ',
  pageType: 'document-entry',
  createdAt: 1,
})

const panelTab = (id: string, openerTabId?: string): WorkspaceTab => ({
  id,
  path: '',
  search: '',
  title: 'Связанные',
  pageType: 'sdui-panel',
  panelId: `panel-${id}`,
  createdAt: 2,
  openerTabId,
})

describe('performTabBack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('роутовый опенер: активирует его, навигирует, обе вкладки живы', () => {
    useWorkspaceTabsStore.setState({
      tabs: [routeTab('/doc/1'), panelTab('related:1', '/doc/1')],
      activeTabId: 'related:1',
    })

    performTabBack('related:1', navigate)

    const s = useWorkspaceTabsStore.getState()
    expect(s.activeTabId).toBe('/doc/1')
    expect(s.tabs).toHaveLength(2)
    expect(navigate).toHaveBeenCalledWith('/doc/1?a=1')
  })

  it('панельный опенер: setActiveTab без навигации', () => {
    useWorkspaceTabsStore.setState({
      tabs: [panelTab('movements:1'), panelTab('related:1', 'movements:1')],
      activeTabId: 'related:1',
    })

    performTabBack('related:1', navigate)

    expect(useWorkspaceTabsStore.getState().activeTabId).toBe('movements:1')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('опенер отсутствует: fallback на закрытие вкладки', () => {
    useWorkspaceTabsStore.setState({
      tabs: [panelTab('related:1', '/gone')],
      activeTabId: 'related:1',
    })

    performTabBack('related:1', navigate)

    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(0)
    expect(navigate).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 4: Убедиться, что тест падает**

Run: `npx vitest run src/features/workspace-tabs/lib/utils/perform-tab-back.test.ts`
Expected: FAIL — модуль `./perform-tab-back` не существует.

- [ ] **Step 5: Реализация `perform-tab-back.ts`**

```ts
import type { NavigateFunction } from 'react-router-dom'

import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import { performTabClose } from './perform-tab-close'

// «Назад» с панельной вкладки: активирует вкладку-опенер, панель ОСТАЁТСЯ
// в баре (повторный вход — кликом по вкладке). Опенер закрыт/не найден →
// fallback на закрытие панели: предсказуемый выход вместо мёртвой кнопки.
export function performTabBack(
  tabId: string,
  navigate: NavigateFunction,
): void {
  const store = useWorkspaceTabsStore.getState()
  const tab = store.tabs.find((t) => t.id === tabId)
  if (!tab) return

  const opener = tab.openerTabId
    ? store.tabs.find((t) => t.id === tab.openerTabId)
    : undefined
  if (!opener) {
    performTabClose(tabId, navigate)
    return
  }

  store.setActiveTab(opener.id)
  if (opener.pageType !== 'sdui-panel') {
    // Роутовая вкладка: роут под панелью не менялся — восстанавливаем URL
    void navigate(opener.path + opener.search)
  }
}
```

- [ ] **Step 6: Тесты зелёные**

Run: `npx vitest run src/features/workspace-tabs/lib/utils/perform-tab-back.test.ts src/features/workspace-tabs/lib/utils/perform-tab-close.test.ts`
Expected: PASS (обе сюиты).

- [ ] **Step 7: Баррель + layout**

В `src/features/workspace-tabs/index.ts` после строки с `performTabClose`:

```ts
export { performTabBack } from './lib/utils/perform-tab-back'
```

В `src/app/layout/layout.tsx`:

1. Импорт: `import { performTabBack, performTabClose, useWorkspaceTabsStore } from '@/features/workspace-tabs'`.
2. После `handleClosePanelTab` добавить:

```tsx
  // «Назад» — на вкладку-опенер (панель остаётся в баре); «✕» — закрыть
  const handleBackPanelTab = () => {
    if (activePanelTab) performTabBack(activePanelTab.id, navigate)
  }
```

3. В `PageHeader` заменить `onBack={handleClosePanelTab}` на `onBack={handleBackPanelTab}` (`onClose` — прежний). Обновить комментарий над `PageHeader`: «назад» возвращает на вкладку-опенер, крестик закрывает вкладку.

- [ ] **Step 8: Коммит**

```bash
git add src/features/workspace-tabs/types/workspace-tab.ts src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.ts src/features/workspace-tabs/lib/utils/perform-tab-back.ts src/features/workspace-tabs/lib/utils/perform-tab-back.test.ts src/features/workspace-tabs/index.ts src/app/layout/layout.tsx
git commit -m "feat: возврат с панельной вкладки на вкладку-опенер"
```

---

### Task 4: WI-E — легаси `/new?basisId=`

**Files:**
- Modify: `src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.ts`
- Test: `src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.test.tsx` (новый)

**Interfaces:**
- Consumes: `getNewDocumentEntry(moduleCode, params?)`, `getDocumentEntry(id)` из `@/entities/document-entry`.
- Produces: ничего нового — хук зеркалит существующий `VidOperatsii`-плюмбинг для `basisId`.

**Зона: легаси** — минимальные правки, без рефакторинга. Отсутствующий/удалённый basis — забота сервера (warning + пустая форма), клиент не валидирует.

- [ ] **Step 1: Написать падающий тест**

Создать `src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getDocumentEntry,
  getNewDocumentEntry,
} from '@/entities/document-entry'
import { useDocumentEntryForm } from './use-document-entry-form'

vi.mock('@/entities/document-entry', () => ({
  getDocumentEntry: vi.fn(),
  getNewDocumentEntry: vi.fn(),
}))

const router = vi.hoisted(() => ({ search: '' }))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ moduleCode: 'SchetKOplate', entryId: 'new' }),
  useLocation: () => ({ pathname: '/documents/SchetKOplate/new' }),
  useSearchParams: () => [new URLSearchParams(router.search)],
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
)

describe('useDocumentEntryForm: basisId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    vi.mocked(getNewDocumentEntry).mockResolvedValue({
      data: { data: { attributes: { Postavshchik: 'X' } } },
    } as never)
  })

  it('с basisId=5 зовёт /new с { basisId: "5" }, copyFrom-путь не зовётся', async () => {
    router.search = 'basisId=5'

    renderHook(() => useDocumentEntryForm(), { wrapper })

    await waitFor(() =>
      expect(getNewDocumentEntry).toHaveBeenCalledWith('SchetKOplate', {
        basisId: '5',
      }),
    )
    expect(getDocumentEntry).not.toHaveBeenCalled()
  })

  it('без параметров /new не зовётся', async () => {
    const { result } = renderHook(() => useDocumentEntryForm(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(getNewDocumentEntry).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.test.tsx`
Expected: FAIL — первый тест: `getNewDocumentEntry` не вызывается (нет `basisId`-плюмбинга); второй — PASS.

- [ ] **Step 3: Реализация в `use-document-entry-form.ts`**

Заменить (строки 32–36):

```ts
  const vidOperatsii = searchParams.get('VidOperatsii')
  const copyFrom = searchParams.get('copyFrom')
  const newEntryParams = vidOperatsii
    ? { VidOperatsii: vidOperatsii }
    : undefined
```

на:

```ts
  const vidOperatsii = searchParams.get('VidOperatsii')
  const copyFrom = searchParams.get('copyFrom')
  const basisId = searchParams.get('basisId')
  const newEntryParams =
    vidOperatsii || basisId
      ? {
          ...(vidOperatsii && { VidOperatsii: vidOperatsii }),
          ...(basisId && { basisId }),
        }
      : undefined
```

В query (строки 38–43) заменить `queryKey` и `enabled`:

```ts
    queryKey: ['document-entry-new', moduleCode, vidOperatsii, basisId],
    ...
    enabled: isNew && (!!vidOperatsii || !!basisId) && !copyFrom,
```

Ветку «reset to empty» (строка 81) заменить:

```ts
    } else if (isNew && !vidOperatsii && !copyFrom && !basisId) {
```

Deps эффекта (строка 109) — добавить `basisId`:

```ts
  }, [isNew, existingEntry, newEntryData, copyFromData, vidOperatsii, copyFrom, basisId, form, pathname])
```

Больше в файле НИЧЕГО не менять (легаси).

- [ ] **Step 4: Тесты зелёные**

Run: `npx vitest run src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.test.tsx`
Expected: PASS, 2/2.

- [ ] **Step 5: Коммит**

```bash
git add src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.ts src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.test.tsx
git commit -m "fix: basisId при открытии нового документа (легаси)"
```

---

### Task 5: Финальная верификация

**Files:** без изменений кода (только фиксы, если проверки красные).

- [ ] **Step 1: Вся сюита**

Run: `npx vitest run`
Expected: все тесты PASS (включая существовавшие до ветки).

- [ ] **Step 2: Типы**

Run: `npx tsc --noEmit`
Expected: 0 ошибок.

- [ ] **Step 3: ESLint по изменённым файлам**

Run:
```bash
npx eslint src/features/sdui/ui/nodes/action/button-icons.tsx src/features/sdui/ui/nodes/action/button-node.tsx src/features/sdui/ui/nodes/action/button-node.test.tsx src/features/sdui/ui/dialog-host.tsx src/features/sdui/lib/panel-state-provider.test.tsx src/features/workspace-tabs/types/workspace-tab.ts src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.ts src/features/workspace-tabs/lib/utils/perform-tab-back.ts src/features/workspace-tabs/lib/utils/perform-tab-back.test.ts src/features/workspace-tabs/index.ts src/app/layout/layout.tsx src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.ts src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.test.tsx
```
Expected: 0 ошибок/warnings. Pre-existing ошибки в НЕизменённых файлах не чинить.

- [ ] **Step 4: При красных проверках** — фикс в рамках соответствующего WI, коммит `fix: …` с описанием, повтор проверок.

---

## Ручная приёмка (после мержа задач, вне субагентов)

На стенде (`npm run dev` + dev-api.qazyna.ai), пилот: «Счёт к оплате» ← «Заявка на регистрацию ГП сделки»:

1. В командной панели документа — иконка related-hierarchy с tooltip, высота = соседним кнопкам.
2. Клик → панель «Связанные документы» с данными (childState) и chrome (title + стрелки + ✕).
3. «Назад» → возврат на вкладку документа, панель остаётся в нижнем баре; «✕» → панель закрывается.
4. «Создать на основании» (dropdown) → выбор цели → новый документ предзаполнен от basis.
5. Регресс: движения документа (из списка и из формы) работают как прежде.
